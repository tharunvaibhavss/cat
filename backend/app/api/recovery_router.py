from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import datetime
from typing import List, Optional

from app.database.connection import get_db
from app.models.models import User, UserSession, SessionAuditLog
from app.api.deps import get_current_user
from app.schemas.schemas import (
    SessionRecoveryHeartbeatPayload,
    SessionRecoveryStateSavePayload,
    SessionRecoveryOut,
    AuditLogOut,
    AssignEmployeePayload,
    HandoverPayload
)
from app.api.recovery_ws import manager

router = APIRouter(prefix="/session-recovery", tags=["Session Recovery & Handover"])

# Utility to log session audits
def log_session_audit(db: Session, session_id: str, user: User, action: str, status_msg: str, device: str = None, ip: str = None):
    audit = SessionAuditLog(
        session_id=session_id,
        user_id=user.id,
        username=user.username,
        department=user.department,
        device=device or "Unknown",
        timestamp=datetime.datetime.utcnow(),
        ip_address=ip,
        action=action,
        status=status_msg
    )
    db.add(audit)
    db.commit()

@router.post("/heartbeat")
def session_heartbeat(
    payload: SessionRecoveryHeartbeatPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ip = request.client.host if request.client else "127.0.0.1"
    session_record = db.query(UserSession).filter(UserSession.session_id == payload.session_id).first()
    
    if session_record:
        # Check if session is locked/resumed by another employee
        if session_record.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your previous session has already been recovered by another authorized employee. Please contact your department administrator if you need access."
            )
            
        if session_record.status == "INTERRUPTED":
            session_record.status = "ACTIVE"
            log_session_audit(
                db=db,
                session_id=payload.session_id,
                user=current_user,
                action="Session Restored",
                status_msg="Recovered by Original User",
                device=payload.device_id,
                ip=ip
            )
            
            # Notify department to remove recovery notifications
            ws_message = {
                "type": "SESSION_RECONNECTED",
                "session_id": payload.session_id,
                "message": f"Session restored by original user {current_user.username}"
            }
            import asyncio
            asyncio.run(manager.broadcast_to_department(current_user.department, ws_message, exclude_user_id=current_user.id))
            
        session_record.last_activity_time = datetime.datetime.utcnow()
        session_record.last_updated = datetime.datetime.utcnow()
        session_record.current_page = payload.current_page
        session_record.current_module = payload.current_module
        session_record.current_task = payload.current_task
        session_record.current_form_state = payload.current_form_state
        session_record.unsaved_changes_count = payload.unsaved_changes_count
        session_record.step_progress = payload.step_progress
        session_record.device_id = payload.device_id
    else:
        # Create brand new session
        session_record = UserSession(
            session_id=payload.session_id,
            user_id=current_user.id,
            department=current_user.department,
            device_id=payload.device_id,
            current_page=payload.current_page,
            current_module=payload.current_module,
            current_task=payload.current_task,
            current_form_state=payload.current_form_state,
            unsaved_changes_count=payload.unsaved_changes_count,
            step_progress=payload.step_progress,
            status="ACTIVE",
            last_activity_time=datetime.datetime.utcnow(),
            last_updated=datetime.datetime.utcnow()
        )
        db.add(session_record)
        db.commit()
        
        log_session_audit(
            db=db,
            session_id=payload.session_id,
            user=current_user,
            action="User Logged In",
            status_msg="Active",
            device=payload.device_id,
            ip=ip
        )
        
    db.commit()
    return {"status": "success", "session_status": session_record.status}

@router.post("/save-state")
def save_recovery_state(
    payload: SessionRecoveryStateSavePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(UserSession).filter(UserSession.session_id == payload.session_id).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session_record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit this session"
        )
        
    session_record.current_page = payload.current_page
    session_record.current_module = payload.current_module
    session_record.current_task = payload.current_task
    session_record.current_form_state = payload.current_form_state
    session_record.unsaved_changes_count = payload.unsaved_changes_count
    session_record.step_progress = payload.step_progress
    session_record.selected_machine = payload.selected_machine
    session_record.selected_site = payload.selected_site
    session_record.filters = payload.filters
    session_record.dashboard_state = payload.dashboard_state
    session_record.last_activity_time = datetime.datetime.utcnow()
    session_record.last_updated = datetime.datetime.utcnow()
    
    db.commit()
    return {"status": "success"}

@router.get("/department-employees", response_model=List[dict])
def get_department_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.query(User).filter(User.department == current_user.department).all()
    return [{"employee_id": u.employee_id, "username": u.username, "role": u.role} for u in users]

@router.get("/{sessionId}", response_model=SessionRecoveryOut)
def get_recovery_session(
    sessionId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(UserSession).filter(UserSession.session_id == sessionId).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Security Rule: Only allow Department Admin, same department authorized users, or Super Admin
    is_super_admin = current_user.role == "Administrator"
    is_same_dept = session_record.department == current_user.department
    is_dept_admin = current_user.is_department_admin or False
    
    if not (is_super_admin or (is_same_dept and (is_dept_admin or current_user.role in ["Supervisor", "Operator", "Maintenance Engineer"]))):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to access this session.")
        
    owner = db.query(User).filter(User.id == session_record.user_id).first()
    session_data = SessionRecoveryOut.from_orm(session_record)
    session_data.username = owner.username if owner else "Unknown"
    return session_data

@router.post("/{sessionId}/resume")
def resume_recovery_session(
    sessionId: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ip = request.client.host if request.client else "127.0.0.1"
    session_record = db.query(UserSession).filter(UserSession.session_id == sessionId).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
        
    is_super_admin = current_user.role == "Administrator"
    is_same_dept = session_record.department == current_user.department
    
    if not (is_super_admin or is_same_dept):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to resume this session.")
        
    if session_record.locked_by is not None and session_record.locked_by != current_user.id:
        raise HTTPException(
            status_code=400,
            detail="This session is already being recovered by another authorized user."
        )
        
    session_record.locked_by = current_user.id
    session_record.status = "RECOVERING"
    session_record.user_id = current_user.id
    session_record.last_activity_time = datetime.datetime.utcnow()
    session_record.last_updated = datetime.datetime.utcnow()
    
    log_session_audit(
        db=db,
        session_id=sessionId,
        user=current_user,
        action="Employee Opened Recovery Page",
        status_msg="In Progress",
        device=session_record.device_id,
        ip=ip
    )
    
    log_session_audit(
        db=db,
        session_id=sessionId,
        user=current_user,
        action="Session Restored",
        status_msg="Success",
        device=session_record.device_id,
        ip=ip
    )
    
    db.commit()
    return {"status": "success", "session": session_record}

@router.get("/{sessionId}/read-only", response_model=SessionRecoveryOut)
def read_only_session(
    sessionId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(UserSession).filter(UserSession.session_id == sessionId).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
        
    is_super_admin = current_user.role == "Administrator"
    is_same_dept = session_record.department == current_user.department
    
    if not (is_super_admin or is_same_dept):
        raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this session.")
        
    owner = db.query(User).filter(User.id == session_record.user_id).first()
    session_data = SessionRecoveryOut.from_orm(session_record)
    session_data.username = owner.username if owner else "Unknown"
    return session_data

@router.post("/{sessionId}/assign")
def assign_another_employee(
    sessionId: str,
    payload: AssignEmployeePayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ip = request.client.host if request.client else "127.0.0.1"
    session_record = db.query(UserSession).filter(UserSession.session_id == sessionId).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
        
    is_super_admin = current_user.role == "Administrator"
    is_dept_admin = current_user.is_department_admin or False
    is_same_dept = session_record.department == current_user.department
    
    if not (is_super_admin or (is_dept_admin and is_same_dept)):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Only Department Administrators can assign another employee."
        )
        
    target_user = db.query(User).filter(User.employee_id == payload.employee_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target employee not found.")
        
    if target_user.department != session_record.department:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign to an employee from a different department."
        )
        
    session_record.user_id = target_user.id
    session_record.locked_by = target_user.id
    session_record.status = "RECOVERED"
    session_record.last_activity_time = datetime.datetime.utcnow()
    session_record.last_updated = datetime.datetime.utcnow()
    
    log_session_audit(
        db=db,
        session_id=sessionId,
        user=current_user,
        action="Ownership Transferred",
        status_msg=f"Transferred to {target_user.username} ({target_user.employee_id})",
        device=session_record.device_id,
        ip=ip
    )
    
    ws_message = {
        "type": "SESSION_ASSIGNED",
        "session_id": sessionId,
        "assigned_to": target_user.employee_id,
        "message": f"Session recovery has been assigned to you by Department Admin {current_user.username}."
    }
    
    import asyncio
    asyncio.run(manager.broadcast_to_department(current_user.department, ws_message))
    
    db.commit()
    return {"status": "success", "message": f"Session assigned to {target_user.username}"}

@router.get("/{sessionId}/audit-logs", response_model=List[AuditLogOut])
def get_session_audit_logs(
    sessionId: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(UserSession).filter(UserSession.session_id == sessionId).first()
    is_super_admin = current_user.role == "Administrator"
    is_same_dept = session_record.department == current_user.department if session_record else True
    
    if not (is_super_admin or is_same_dept):
        raise HTTPException(status_code=403, detail="Forbidden: You do not have permission to view audit logs for this department.")
        
    logs = db.query(SessionAuditLog).filter(SessionAuditLog.session_id == sessionId).order_by(SessionAuditLog.timestamp.asc()).all()
    return logs

@router.get("/user/active-devices", response_model=List[SessionRecoveryOut])
def get_my_active_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sessions = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.status == "ACTIVE"
    ).all()
    
    result = []
    for s in sessions:
        out = SessionRecoveryOut.from_orm(s)
        out.username = current_user.username
        result.append(out)
    return result

@router.post("/{target_session_id}/handover")
def handover_to_device(
    target_session_id: str,
    payload: HandoverPayload,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve target session
    target_session = db.query(UserSession).filter(UserSession.session_id == target_session_id).first()
    if not target_session or target_session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Target device/session not found or unauthorized")
        
    # Send WebSocket message to push the user's current session to the target session
    # We broadcast to department, but we want ONLY the target device to react.
    # However, since they are the same user, we can send a custom event type that target session will catch.
    ws_message = {
        "type": "SESSION_HANDOVER_REQUESTED",
        "session_id": payload.current_session_id, # Session to be recovered
        "target_session_id": target_session_id,   # Only this session should react
        "message": "You have been assigned as the backup device. Taking over session now..."
    }
    
    import asyncio
    asyncio.run(manager.broadcast_to_department(current_user.department, ws_message))
    
    return {"status": "success"}
