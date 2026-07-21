from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, ReferenceConfiguration, CurrentConfiguration, DiagnosticResult, ActivityLog, User
from backend.app.schemas.schemas import DiagnosticResultOut, DiagnosticRunRequest
from backend.app.api.deps import get_current_user, require_role
from backend.app.diagnostic_engine.engine import DiagnosticEngine

router = APIRouter(prefix="/diagnostic", tags=["Diagnostic Engine"])

@router.post("/run", response_model=DiagnosticResultOut)
def run_diagnostic(
    req: DiagnosticRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Operator"]))
):
    # 1. Verify machine exists
    machine = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # 2. Check if connected
    if machine.status != "Connected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Machine {req.machine_id} is '{machine.status}'. Diagnostics can only be executed on 'Connected' machines."
        )

    # 3. Pull reference and current configurations
    ref = db.query(ReferenceConfiguration).filter(ReferenceConfiguration.machine_id == req.machine_id).first()
    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == req.machine_id).first()
    
    if not ref or not curr:
        raise HTTPException(
            status_code=500,
            detail="Machine is missing reference or current configurations. Cannot run diagnostics."
        )

    # 4. Serialize to dict for engine
    ref_dict = {
        "firmware": ref.firmware,
        "plc_version": ref.plc_version,
        "cpu": ref.cpu,
        "ram": ref.ram,
        "storage": ref.storage,
        "communication_ports": ref.communication_ports,
        "installed_modules": ref.installed_modules,
        "sensor_count": ref.sensor_count
    }

    curr_dict = {
        "firmware": curr.firmware,
        "plc_version": curr.plc_version,
        "cpu": curr.cpu,
        "ram": curr.ram,
        "storage": curr.storage,
        "communication_ports": curr.communication_ports,
        "installed_modules": curr.installed_modules,
        "sensor_count": curr.sensor_count,
        "temperature": curr.temperature,
        "power_status": curr.power_status
    }

    # 5. Execute diagnostic engine (Deterministic Python logic)
    diag_data = DiagnosticEngine.run_diagnostics(ref_dict, curr_dict)

    # 6. Save diagnostic result
    result = DiagnosticResult(
        machine_id=req.machine_id,
        timestamp=datetime.utcnow(),
        status=diag_data["status"],
        health_score=diag_data["health_score"],
        details=diag_data,
        notes=f"Diagnostic checked by {current_user.username} via connection interface."
    )
    db.add(result)

    # 6b. Check for risk threshold alarm (Health Score <= 20% indicates >= 80% Risk)
    if result.health_score <= 20:
        issue_count = len(diag_data.get("issues", []))
        message = f"CRITICAL FAULT DETECTED: {machine.name} Health Score is {result.health_score}% with {issue_count} mismatch code failures."
        
        from backend.app.models.models import Alert
        existing_alert = db.query(Alert).filter(
            Alert.machine_id == req.machine_id,
            Alert.is_resolved == False
        ).first()
        
        if not existing_alert:
            new_alert = Alert(
                machine_id=req.machine_id,
                health_score=result.health_score,
                message=message,
                is_resolved=False
            )
            db.add(new_alert)
            
            # Fetch all supervisor emails
            supervisors = db.query(User).filter(User.role == "Supervisor").all()
            recipient_emails = []
            for sup in supervisors:
                if sup.email and sup.email.strip():
                    recipient_emails.append(sup.email.strip())
            
            if not recipient_emails:
                recipient_emails = ["workwiththarun@gmail.com"]
                
            machine_info = {
                "machine_id": machine.machine_id,
                "name": machine.name,
                "model": machine.model
            }
            
            from backend.app.utils.email_service import send_risk_alert_email
            send_risk_alert_email(
                recipient_emails=recipient_emails,
                machine_info=machine_info,
                diagnostic_result=diag_data
            )

    # 7. Write to system logs
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Diagnostic Completed",
        details=f"Ran diagnosis on {machine.machine_id}. Health Score: {result.health_score}%. Status: {result.status}."
    )
    db.add(log)
    db.commit()
    db.refresh(result)

    return result

@router.get("/history", response_model=List[DiagnosticResultOut])
def get_diagnostic_history(
    db: Session = Depends(get_db),
    machine_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = db.query(DiagnosticResult)
    if machine_id:
        query = query.filter(DiagnosticResult.machine_id == machine_id)
    if status:
        query = query.filter(DiagnosticResult.status == status)
    
    # Order by timestamp desc
    return query.order_by(DiagnosticResult.timestamp.desc()).all()

@router.get("/{id}", response_model=DiagnosticResultOut)
def get_diagnostic_result(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = db.query(DiagnosticResult).filter(DiagnosticResult.id == id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Diagnostic result not found")
    return result

@router.delete("/{id}")
def delete_diagnostic_result(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Supervisor"]))
):
    result = db.query(DiagnosticResult).filter(DiagnosticResult.id == id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Diagnostic result not found")
    
    db.delete(result)
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Admin Changes",
        details=f"Deleted diagnostic record ID {id} for machine {result.machine_id}."
    )
    db.add(log)
    db.commit()
    return {"message": "Diagnostic result deleted successfully"}
