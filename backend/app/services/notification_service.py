import os
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import UserFCMToken, UserNotificationSettings, NotificationHistory, User

# Configure logger
logger = logging.getLogger("cat_notifications")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(ch)

# Try importing Firebase Admin SDK
firebase_available = False
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    firebase_available = True
except ImportError:
    logger.warning("firebase-admin package is not installed. Running in Mock Notification Mode.")

# Initialize Firebase App if credentials are provided
firebase_initialized = False
if firebase_available:
    try:
        # Check for service account path or raw credentials JSON
        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")

        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            firebase_initialized = True
            logger.info("Firebase Admin SDK successfully initialized from path.")
        elif cred_json:
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            firebase_initialized = True
            logger.info("Firebase Admin SDK successfully initialized from JSON string.")
        else:
            # Try default initialization
            try:
                firebase_admin.initialize_app()
                firebase_initialized = True
                logger.info("Firebase Admin SDK initialized with default credentials.")
            except Exception:
                logger.warning("No Firebase credentials configured. FCM service will operate in Mock Mode.")
    except Exception as e:
        logger.error(f"Error initializing Firebase Admin SDK: {e}. Falling back to Mock Mode.")

class NotificationService:
    @staticmethod
    def _is_quiet_hours(settings: UserNotificationSettings) -> bool:
        """Check if current time is within user's quiet hours."""
        if not settings or not settings.quiet_hours_start or not settings.quiet_hours_end:
            return False

        try:
            now_time = datetime.utcnow().time()
            start_time = datetime.strptime(settings.quiet_hours_start, "%H:%M").time()
            end_time = datetime.strptime(settings.quiet_hours_end, "%H:%M").time()

            if start_time <= end_time:
                return start_time <= now_time <= end_time
            else:  # Quiet hours span across midnight (e.g. 22:00 to 06:00)
                return now_time >= start_time or now_time <= end_time
        except Exception as e:
            logger.error(f"Error parsing quiet hours: {e}")
            return False

    @classmethod
    def should_send_notification(cls, db: Session, user_id: int, category: str) -> bool:
        """Determine if notification should be sent based on user settings and quiet hours."""
        settings = db.query(UserNotificationSettings).filter(UserNotificationSettings.user_id == user_id).first()
        if not settings:
            # If no settings exist, default to True for all notifications
            return True

        # Check quiet hours
        if cls._is_quiet_hours(settings):
            logger.info(f"Notification suppressed for User #{user_id} due to Active Quiet Hours.")
            return False

        category_lower = category.lower()
        if category_lower == "critical":
            return settings.critical_enabled
        elif category_lower == "warning":
            return settings.warning_enabled
        elif category_lower == "maintenance":
            return settings.maintenance_enabled
        elif category_lower == "inspection":
            return settings.inspection_enabled
        elif category_lower == "information" or category_lower == "info":
            return settings.info_enabled

        return True

    @classmethod
    def send_push_notification(cls, db: Session, user_id: int, title: str, body: str, category: str, data: dict = None) -> dict:
        """
        Sends a push notification to a single user on all their registered browser tokens.
        Stores the notification in NotificationHistory.
        """
        # Validate settings first
        if not cls.should_send_notification(db, user_id, category):
            return {"status": "suppressed", "reason": "user_settings_or_quiet_hours"}

        # Fetch FCM tokens
        tokens_records = db.query(UserFCMToken).filter(UserFCMToken.user_id == user_id).all()
        if not tokens_records:
            logger.info(f"No FCM tokens found for User #{user_id}. Logged to history only.")
            cls._save_to_history(db, user_id, title, body, category, data)
            return {"status": "logged", "reason": "no_registered_tokens"}

        tokens = [t.fcm_token for t in tokens_records]
        
        # Save to history
        hist = cls._save_to_history(db, user_id, title, body, category, data)

        # Build payload data
        payload_data = data.copy() if data else {}
        payload_data.update({
            "title": title,
            "body": body,
            "category": category,
            "alert_id": str(payload_data.get("alert_id", hist.alert_id or "")),
            "machine_id": str(payload_data.get("machine_id", hist.machine_id or "")),
            "sent_at": datetime.utcnow().isoformat()
        })

        # Send notifications
        results = cls._dispatch_tokens(db, tokens, title, body, payload_data)
        return {"status": "success", "dispatched_devices": results}

    @classmethod
    def send_multicast_notification(cls, db: Session, user_ids: list[int], title: str, body: str, category: str, data: dict = None) -> dict:
        """Sends push notification to multiple users."""
        dispatch_results = {}
        for uid in user_ids:
            res = cls.send_push_notification(db, uid, title, body, category, data)
            dispatch_results[uid] = res
        return {"status": "completed", "results": dispatch_results}

    @classmethod
    def send_to_role(cls, db: Session, role: str, title: str, body: str, category: str, data: dict = None) -> dict:
        """Sends notification to all users belonging to a specific role (e.g. Maintenance Engineer)."""
        users = db.query(User).filter(User.role == role).all()
        user_ids = [u.id for u in users]
        if not user_ids:
            logger.info(f"No users found with role: {role}")
            return {"status": "no_users_with_role"}
        return cls.send_multicast_notification(db, user_ids, title, body, category, data)

    @classmethod
    def _save_to_history(cls, db: Session, user_id: int, title: str, body: str, category: str, data: dict = None) -> NotificationHistory:
        """Saves a notification to the history table."""
        machine_id = data.get("machine_id") if data else None
        alert_id = int(data.get("alert_id")) if data and data.get("alert_id") else None

        hist = NotificationHistory(
            user_id=user_id,
            title=title,
            body=body,
            category=category,
            machine_id=machine_id,
            alert_id=alert_id,
            sent_at=datetime.utcnow(),
            is_read=False
        )
        db.add(hist)
        db.commit()
        db.refresh(hist)
        return hist

    @classmethod
    def _dispatch_tokens(cls, db: Session, tokens: list[str], title: str, body: str, payload_data: dict) -> list[dict]:
        """Dispatches notification via FCM or fallback mock implementation."""
        results = []
        invalid_tokens = []

        if firebase_initialized:
            # We use Multicast message to send to multiple tokens
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=payload_data,
                tokens=tokens
            )
            try:
                if hasattr(messaging, 'send_each_for_multicast'):
                    response = messaging.send_each_for_multicast(message)
                else:
                    response = messaging.send_multicast(message)
                for index, resp in enumerate(response.responses):
                    token = tokens[index]
                    if resp.success:
                        results.append({"token": token[:15] + "...", "status": "success", "message_id": resp.message_id})
                    else:
                        # Token is invalid or expired
                        results.append({"token": token[:15] + "...", "status": "failed", "error": str(resp.exception)})
                        invalid_tokens.append(token)
            except Exception as e:
                logger.error(f"FCM Multicast delivery failed: {e}. Falling back to mock dispatch.")
                # If Firebase SDK fails unexpectedly, fallback to mock logs
                for token in tokens:
                    results.append({"token": token[:15] + "...", "status": "mock_success"})
        else:
            # Mock Dispatch
            logger.info("=== [MOCK NOTIFICATION DISPATCH] ===")
            logger.info(f"Title: {title}")
            logger.info(f"Body: {body}")
            logger.info(f"Payload: {json.dumps(payload_data)}")
            logger.info(f"Targeting Tokens: {tokens}")
            logger.info("====================================")
            for token in tokens:
                results.append({"token": token[:15] + "...", "status": "mock_success"})

        # Clean up invalid tokens
        if invalid_tokens:
            cls.clean_expired_tokens(db, invalid_tokens)

        return results

    @classmethod
    def clean_expired_tokens(cls, db: Session, invalid_tokens: list[str]):
        """Automatically removes invalid or expired FCM tokens from database."""
        try:
            deleted_count = db.query(UserFCMToken).filter(UserFCMToken.fcm_token.in_(invalid_tokens)).delete(synchronize_session=False)
            db.commit()
            logger.info(f"Cleaned {deleted_count} expired FCM tokens from database.")
        except Exception as e:
            logger.error(f"Error cleaning expired tokens: {e}")
            db.rollback()

    @classmethod
    def notify_alert_created(cls, db: Session, alert, severity: str = "Critical"):
        """Automatically called when an alert is created. Dispatches to all relevant staff."""
        # Query all Maintenance Engineers, Supervisors, and Administrators
        staff_users = db.query(User).filter(User.role.in_(["Maintenance Engineer", "Supervisor", "Administrator"])).all()
        user_ids = [u.id for u in staff_users]
        if not user_ids:
            return

        title = f"{severity} Machine Alert"
        body = alert.message

        data = {
            "machine_id": str(alert.machine_id),
            "alert_id": str(alert.id),
            "severity": severity,
            "category": severity,
            "dashboard_url": f"/dashboard/machines?machine_id={alert.machine_id}&alert_id={alert.id}"
        }

        cls.send_multicast_notification(db, user_ids, title, body, severity, data)
