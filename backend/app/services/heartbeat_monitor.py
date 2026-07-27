import asyncio
import datetime
import logging
from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.models import Device, UserSession, User, SessionAuditLog
from app.api.recovery_ws import manager

logger = logging.getLogger("cat_heartbeat_monitor")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(ch)

async def monitor_heartbeats():
    """Background task running every 10 seconds to check for offline devices/sessions."""
    while True:
        try:
            await asyncio.sleep(10)
            db = SessionLocal()
            try:
                now = datetime.datetime.utcnow()
                
                # A. Identify and process interrupted user sessions
                # Check sessions that are ACTIVE and have not sent a heartbeat in the last 30 seconds
                cutoff_30s = now - datetime.timedelta(seconds=30)
                interrupted_sessions = db.query(UserSession).filter(
                    UserSession.status == "ACTIVE",
                    UserSession.last_activity_time < cutoff_30s
                ).all()

                for session in interrupted_sessions:
                    owner = db.query(User).filter(User.id == session.user_id).first()
                    owner_name = owner.username if owner else "Unknown"
                    
                    logger.info(f"Session {session.session_id} belonging to {owner_name} is detected as INTERRUPTED (No heartbeat for 30s)")
                    session.status = "INTERRUPTED"
                    
                    # Log audit events
                    audit1 = SessionAuditLog(
                        session_id=session.session_id,
                        user_id=session.user_id,
                        username=owner_name,
                        department=session.department,
                        device=session.device_id or "Unknown",
                        timestamp=datetime.datetime.utcnow(),
                        action="Heartbeat Lost",
                        status="Failed"
                    )
                    audit2 = SessionAuditLog(
                        session_id=session.session_id,
                        user_id=session.user_id,
                        username=owner_name,
                        department=session.department,
                        device=session.device_id or "Unknown",
                        timestamp=datetime.datetime.utcnow(),
                        action="Session Interrupted",
                        status="Waiting for Recovery"
                    )
                    db.add(audit1)
                    db.add(audit2)
                    db.commit()

                    # Notify department via WebSockets
                    ws_message = {
                        "type": "SESSION_INTERRUPTED",
                        "session_id": session.session_id,
                        "employee": owner_name,
                        "department": session.department or "Vendor Management",
                        "task": session.current_task or "Vendor Approval",
                        "module": session.current_module or "Vendor Approval",
                        "device": session.device_id or "Laptop A",
                        "step_progress": session.step_progress or "5 of 8",
                        "unsaved_changes": session.unsaved_changes_count or 0,
                        "interrupted_at": now.strftime("%I:%M %p"),
                        "time_since_failure": "30 Seconds"
                    }
                    
                    # Log that admin and backup users are notified
                    log_session_audit_silent(db, session.session_id, session.user_id, owner_name, session.department, session.device_id, "Department Admin Notified", "Sent")
                    log_session_audit_silent(db, session.session_id, session.user_id, owner_name, session.department, session.device_id, "Employee B Notified", "Sent")
                    
                    await manager.broadcast_to_department(
                        department=session.department,
                        message=ws_message,
                        exclude_user_id=session_record.user_id
                    )

                # B. Handle recovery timeout after 5 minutes (300 seconds)
                cutoff_5m = now - datetime.timedelta(seconds=300)
                timeout_sessions = db.query(UserSession).filter(
                    UserSession.status == "INTERRUPTED",
                    UserSession.last_activity_time < cutoff_5m,
                    (UserSession.timeout_alert_sent == False) | (UserSession.timeout_alert_sent == None)
                ).all()

                for session in timeout_sessions:
                    owner = db.query(User).filter(User.id == session.user_id).first()
                    owner_name = owner.username if owner else "Unknown"
                    logger.info(f"Session {session.session_id} has exceeded the 5-minute recovery timeout threshold")
                    session.timeout_alert_sent = True
                    db.commit()

                    ws_message = {
                        "type": "RECOVERY_TIMEOUT",
                        "session_id": session.session_id,
                        "employee": owner_name,
                        "department": session.department or "Vendor Management",
                        "message": "Session has not been recovered. Would you like to Assign Another Employee or Close Session?"
                    }
                    
                    # Log warning
                    log_session_audit_silent(db, session.session_id, session.user_id, owner_name, session.department, session.device_id, "Recovery Timeout Warning", "Sent")

                    await manager.broadcast_to_department(
                        department=session.department,
                        message=ws_message,
                        exclude_user_id=session_record.user_id
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

def log_session_audit_silent(db: Session, session_id: str, user_id: int, username: str, department: str, device: str, action: str, status: str):
    try:
        audit = SessionAuditLog(
            session_id=session_id,
            user_id=user_id,
            username=username,
            department=department,
            device=device or "Unknown",
            timestamp=datetime.datetime.utcnow(),
            action=action,
            status=status
        )
        db.add(audit)
        db.commit()
    except Exception:
        pass
