from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.database.connection import get_db
from app.models.models import UserFCMToken, UserNotificationSettings, NotificationHistory, User
from app.api.deps import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications Management"])

# Pydantic request / response schemas
class TokenRegisterRequest(BaseModel):
    fcm_token: str
    browser_name: Optional[str] = None
    device_name: Optional[str] = None

class TokenRemoveRequest(BaseModel):
    fcm_token: str

class NotificationSettingsUpdate(BaseModel):
    critical_enabled: Optional[bool] = None
    warning_enabled: Optional[bool] = None
    maintenance_enabled: Optional[bool] = None
    inspection_enabled: Optional[bool] = None
    info_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None  # HH:MM
    quiet_hours_end: Optional[str] = None    # HH:MM

class NotificationSettingsOut(BaseModel):
    user_id: int
    critical_enabled: bool
    warning_enabled: bool
    maintenance_enabled: bool
    inspection_enabled: bool
    info_enabled: bool
    quiet_hours_start: Optional[str]
    quiet_hours_end: Optional[str]

    class Config:
        from_attributes = True

class NotificationHistoryOut(BaseModel):
    id: int
    user_id: int
    title: str
    body: str
    category: str
    machine_id: Optional[str]
    alert_id: Optional[int]
    sent_at: datetime
    is_read: bool

    class Config:
        from_attributes = True

@router.post("/register-token", status_code=status.HTTP_201_CREATED)
def register_token(
    payload: TokenRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Register a new FCM device token for the logged-in user."""
    # Check if this token is already registered to someone else or the same user
    token_record = db.query(UserFCMToken).filter(UserFCMToken.fcm_token == payload.fcm_token).first()
    if token_record:
        if token_record.user_id == current_user.id:
            # Update updated timestamp and details
            token_record.browser_name = payload.browser_name
            token_record.device_name = payload.device_name
            token_record.updated_at = datetime.utcnow()
            db.commit()
            return {"message": "FCM Token updated successfully.", "token": payload.fcm_token}
        else:
            # Reassign token to the new user who just logged in
            token_record.user_id = current_user.id
            token_record.browser_name = payload.browser_name
            token_record.device_name = payload.device_name
            token_record.updated_at = datetime.utcnow()
            db.commit()
            return {"message": "FCM Token reassigned to current user.", "token": payload.fcm_token}

    # Otherwise create a new record
    new_token = UserFCMToken(
        user_id=current_user.id,
        fcm_token=payload.fcm_token,
        browser_name=payload.browser_name,
        device_name=payload.device_name,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_token)
    db.commit()
    return {"message": "FCM Token registered successfully.", "token": payload.fcm_token}

@router.post("/remove-token")
def remove_token(
    payload: TokenRemoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unregister/Remove FCM token during logout or disabling notifications."""
    token_record = db.query(UserFCMToken).filter(
        UserFCMToken.fcm_token == payload.fcm_token,
        UserFCMToken.user_id == current_user.id
    ).first()
    
    if not token_record:
        # Gracefully handle if token doesn't exist
        return {"message": "FCM Token was not registered or already removed."}

    db.delete(token_record)
    db.commit()
    return {"message": "FCM Token removed successfully."}

@router.get("/settings", response_model=NotificationSettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve notification settings. Creates a default setting entry if none exists."""
    settings = db.query(UserNotificationSettings).filter(UserNotificationSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserNotificationSettings(
            user_id=current_user.id,
            critical_enabled=True,
            warning_enabled=True,
            maintenance_enabled=True,
            inspection_enabled=True,
            info_enabled=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=NotificationSettingsOut)
def update_settings(
    payload: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update notification settings/preferences."""
    settings = db.query(UserNotificationSettings).filter(UserNotificationSettings.user_id == current_user.id).first()
    if not settings:
        settings = UserNotificationSettings(user_id=current_user.id)
        db.add(settings)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings

@router.get("/history", response_model=List[NotificationHistoryOut])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve the user's notification history (up to last 50 entries)."""
    return db.query(NotificationHistory).filter(
        NotificationHistory.user_id == current_user.id
    ).order_by(NotificationHistory.sent_at.desc()).limit(50).all()

@router.post("/history/{id}/read")
def mark_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification in history as read."""
    hist = db.query(NotificationHistory).filter(
        NotificationHistory.id == id,
        NotificationHistory.user_id == current_user.id
    ).first()
    if not hist:
        raise HTTPException(status_code=404, detail="Notification history entry not found.")
    hist.is_read = True
    db.commit()
    return {"status": "success"}

@router.post("/test")
def send_test_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a test push notification to the current user's registered devices."""
    res = NotificationService.send_push_notification(
        db=db,
        user_id=current_user.id,
        title="Test Push Notification",
        body="This is a test notification from the Heavy Industrial Machine Monitoring Platform.",
        category="Information",
        data={"machine_id": "CAT-TEST-99", "alert_id": "0", "severity": "Information", "dashboard_url": "/dashboard"}
    )
    return {
        "message": "Test notification command dispatched.",
        "details": res
    }
