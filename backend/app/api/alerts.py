from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.connection import get_db
from backend.app.models.models import Alert, ActivityLog
from backend.app.schemas.schemas import AlertOut
from backend.app.api.deps import get_current_user, require_role
import datetime

router = APIRouter(prefix="/alerts", tags=["Alerts Management"])

# Any logged in user can view alerts
@router.get("", response_model=List[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Retrieve all alerts ordered by timestamp descending
    return db.query(Alert).order_by(Alert.timestamp.desc()).all()

# Administrator or Maintenance Engineer can resolve alerts
@router.post("/{id}/resolve", response_model=AlertOut)
def resolve_alert(
    id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(["Administrator", "Maintenance Engineer"]))
):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert record not found.")
        
    # Toggle resolution status
    alert.is_resolved = not alert.is_resolved
    if alert.is_resolved:
        alert.resolved_at = datetime.datetime.utcnow()
        details = f"Alert #{id} for machine {alert.machine_id} was resolved."
    else:
        alert.resolved_at = None
        details = f"Alert #{id} for machine {alert.machine_id} was reopened/unresolved."
        
    # Add activity log
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Alert Updated",
        details=details
    )
    db.add(log)
    
    db.commit()
    db.refresh(alert)
    return alert

from typing import Optional

@router.post("/{id}/email")
def send_alert_email_manually(
    id: int,
    email: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from backend.app.models.models import Machine, DiagnosticResult, User
    from backend.app.utils.email_service import send_risk_alert_email
    
    # 1. Fetch Alert
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert record not found.")
        
    # 2. Fetch Machine details
    machine = db.query(Machine).filter(Machine.machine_id == alert.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine profile not found.")
        
    # 3. Fetch latest diagnostic run for this machine
    diag = db.query(DiagnosticResult).filter(
        DiagnosticResult.machine_id == alert.machine_id
    ).order_by(DiagnosticResult.timestamp.desc()).first()
    
    # 4. Resolve recipient list
    if email and email.strip():
        recipient_emails = [email.strip()]
    else:
        supervisors = db.query(User).filter(User.role == "Supervisor").all()
        recipient_emails = []
        for sup in supervisors:
            if sup.email and sup.email.strip():
                recipient_emails.append(sup.email.strip())
                
        if not recipient_emails:
            recipient_emails = ["workwiththarun@gmail.com"]
        
    # 5. Compile payload
    machine_info = {
        "machine_id": machine.machine_id,
        "name": machine.name,
        "model": machine.model
    }
    
    diag_data = diag.details if diag else {
        "health_score": alert.health_score,
        "status": "Fault",
        "details": {"issues": [{"parameter": "Alarm", "severity": "Critical", "message": alert.message}]}
    }
    
    # 6. Dispatch
    success = send_risk_alert_email(
        recipient_emails=recipient_emails,
        machine_info=machine_info,
        diagnostic_result=diag_data
    )
    
    # 7. Log action
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Email Dispatched",
        details=f"Manually sent critical risk report for alert #{id} ({alert.machine_id}) to {recipient_emails}."
    )
    db.add(log)
    db.commit()
    
    if not success:
        raise HTTPException(status_code=500, detail="SMTP server failed to send email. Check backend log for details.")
        
    return {"message": "Email dispatched successfully!", "recipients": recipient_emails}

@router.delete("/{id}")
def delete_alert(
    id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(["Administrator", "Maintenance Engineer"]))
):
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert record not found.")
        
    db.delete(alert)
    
    # Log deletion action
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Alert Deleted",
        details=f"Permanently deleted Alert #{id} for machine {alert.machine_id}."
    )
    db.add(log)
    db.commit()
    return {"message": "Alert deleted successfully!"}
