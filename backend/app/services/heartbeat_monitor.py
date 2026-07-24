import asyncio
import datetime
import logging
from sqlalchemy.orm import Session
from backend.app.database.connection import SessionLocal
from backend.app.models.models import Device, UserSession
from backend.app.services.notification_service import NotificationService

logger = logging.getLogger("cat_heartbeat_monitor")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(ch)

async def monitor_heartbeats():
    """Background task running every 30 seconds to check for offline devices and notify other active devices."""
    while True:
        try:
            await asyncio.sleep(30)
            db = SessionLocal()
            try:
                now = datetime.datetime.utcnow()
                # Check devices that have not sent a heartbeat in the last 60 seconds
                cutoff = now - datetime.timedelta(seconds=60)
                offline_devices = db.query(Device).filter(
                    Device.status == "ONLINE",
                    Device.last_seen < cutoff
                ).all()

                for device in offline_devices:
                    logger.info(f"Device {device.id} ({device.device_name or 'Unknown'}) is detected as OFFLINE")
                    device.status = "OFFLINE"
                    db.commit()

                    # Find user session to see if there is an active session
                    # Retrieve the last active session for this user that was active on the offline device
                    active_session = db.query(UserSession).filter(
                        UserSession.user_id == device.user_id,
                        UserSession.active_device == device.id
                    ).order_by(UserSession.last_updated.desc()).first()

                    if not active_session:
                        # Fallback: check any session associated with this user
                        active_session = db.query(UserSession).filter(
                            UserSession.user_id == device.user_id
                        ).order_by(UserSession.last_updated.desc()).first()

                    if active_session:
                        # Find other ONLINE devices for the same user
                        other_online_devices = db.query(Device).filter(
                            Device.user_id == device.user_id,
                            Device.id != device.id,
                            Device.status == "ONLINE"
                        ).all()

                        if other_online_devices:
                            logger.info(f"Notifying user {device.user_id} other online devices about session {active_session.session_id}")
                            
                            title = "Session Interrupted"
                            device_name = device.device_name or f"{device.browser or 'Browser'} on {device.operating_system or 'OS'}"
                            body = f"{device_name} is offline. Resume monitoring on this device?"
                            
                            # Custom FCM payload data containing the session and resume url
                            # In browser, notifications require payload properties as string values
                            payload_data = {
                                "session_id": str(active_session.session_id),
                                "device_id": str(device.id),
                                "resume_url": f"/dashboard/resume?session={active_session.session_id}",
                                "category": "Warning",
                                "severity": "Warning"
                            }

                            for target_device in other_online_devices:
                                # We can dispatch to this target device using the stored fcm_token or mock dispatch
                                NotificationService.send_push_notification(
                                    db=db,
                                    user_id=device.user_id,
                                    title=title,
                                    body=body,
                                    category="Warning",
                                    data=payload_data
                                )
            except Exception as e:
                logger.error(f"Error in heartbeat monitor database operation: {e}")
                db.rollback()
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Heartbeat monitor task cancelled.")
            break
        except Exception as e:
            logger.error(f"Unexpected error in heartbeat monitor: {e}")
