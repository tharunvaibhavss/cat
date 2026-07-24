from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
import datetime

from backend.app.database.connection import get_db
from backend.app.models.models import Device, UserSession, User
from backend.app.api.deps import get_current_user
from backend.app.services.notification_service import NotificationService

router = APIRouter(prefix="", tags=["Session Handover Management"])

# Pydantic Schemas for Handover
class DeviceRegisterPayload(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    browser_name: Optional[str] = None
    operating_system: Optional[str] = None
    fcm_token: Optional[str] = None

class HeartbeatPayload(BaseModel):
    device_id: str
    session_id: str
    timestamp: str

class SessionSavePayload(BaseModel):
    session_id: str
    device_id: str
    current_page: Optional[str] = None
    selected_machine: Optional[str] = None
    selected_site: Optional[str] = None
    filters: Optional[dict] = None
    dashboard_state: Optional[dict] = None

class SessionResumePayload(BaseModel):
    session_id: str
    device_id: str

class DeviceOut(BaseModel):
    id: str
    device_name: Optional[str]
    browser: Optional[str]
    operating_system: Optional[str]
    status: str
    last_seen: datetime.datetime

    class Config:
        from_attributes = True

class SessionOut(BaseModel):
    session_id: str
    user_id: int
    active_device: Optional[str]
    current_page: Optional[str]
    selected_machine: Optional[str]
    selected_site: Optional[str]
    filters: Optional[Any]
    dashboard_state: Optional[Any]
    last_updated: datetime.datetime

    class Config:
        from_attributes = True


@router.post("/devices/register")
def register_device(
    payload: DeviceRegisterPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == payload.device_id).first()
    if device:
        device.user_id = current_user.id
        device.device_name = payload.device_name
        device.browser = payload.browser_name
        device.operating_system = payload.operating_system
        device.fcm_token = payload.fcm_token
        device.status = "ONLINE"
        device.last_seen = datetime.datetime.utcnow()
    else:
        device = Device(
            id=payload.device_id,
            user_id=current_user.id,
            device_name=payload.device_name,
            browser=payload.browser_name,
            operating_system=payload.operating_system,
            fcm_token=payload.fcm_token,
            status="ONLINE",
            last_seen=datetime.datetime.utcnow()
        )
        db.add(device)
    
    db.commit()
    return {"status": "success", "device_id": device.id}


@router.post("/heartbeat")
def update_heartbeat(
    payload: HeartbeatPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == payload.device_id).first()
    if not device:
        # Auto register device if missing
        device = Device(
            id=payload.device_id,
            user_id=current_user.id,
            status="ONLINE",
            last_seen=datetime.datetime.utcnow()
        )
        db.add(device)
    else:
        device.status = "ONLINE"
        device.last_seen = datetime.datetime.utcnow()
    
    db.commit()
    return {"status": "success"}


@router.post("/session/save")
def save_session(
    payload: SessionSavePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(UserSession).filter(UserSession.session_id == payload.session_id).first()
    if session_record:
        # Verify ownership
        if session_record.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this session")
        
        session_record.current_page = payload.current_page
        session_record.selected_machine = payload.selected_machine
        session_record.selected_site = payload.selected_site
        session_record.filters = payload.filters
        session_record.dashboard_state = payload.dashboard_state
        # Only update active_device if it's the registered owner
        if not session_record.active_device:
            session_record.active_device = payload.device_id
    else:
        session_record = UserSession(
            session_id=payload.session_id,
            user_id=current_user.id,
            active_device=payload.device_id,
            current_page=payload.current_page,
            selected_machine=payload.selected_machine,
            selected_site=payload.selected_site,
            filters=payload.filters,
            dashboard_state=payload.dashboard_state,
            last_updated=datetime.datetime.utcnow()
        )
        db.add(session_record)
    
    db.commit()
    return {"status": "success"}


@router.get("/session/{id}", response_model=SessionOut)
def get_session(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(UserSession).filter(UserSession.session_id == id).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")
    return session_record


@router.post("/session/resume")
def resume_session(
    payload: SessionResumePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_record = db.query(UserSession).filter(UserSession.session_id == payload.session_id).first()
    if not session_record:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_record.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to resume this session")
    
    # Invalidate previous device's active session role
    session_record.active_device = payload.device_id
    db.commit()
    return {"status": "success", "session_id": session_record.session_id}


@router.get("/devices", response_model=List[DeviceOut])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Device).filter(Device.user_id == current_user.id).all()


@router.delete("/devices/{id}")
def remove_device(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    device = db.query(Device).filter(Device.id == id, Device.user_id == current_user.id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"status": "success"}


@router.post("/notifications/send")
def send_browser_notification(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Utility endpoint to dispatch a direct browser notification to a user's device."""
    user_id = payload.get("user_id", current_user.id)
    title = payload.get("title", "Industrial Machine Alert")
    body = payload.get("body", "Notification content")
    category = payload.get("category", "Information")
    data = payload.get("data", {})
    
    res = NotificationService.send_push_notification(
        db=db,
        user_id=user_id,
        title=title,
        body=body,
        category=category,
        data=data
    )
    return {"status": "success", "details": res}
