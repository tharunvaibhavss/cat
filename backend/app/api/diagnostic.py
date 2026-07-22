from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, ReferenceConfiguration, CurrentConfiguration, DiagnosticResult, ActivityLog, User, ManualInspection
from backend.app.schemas.schemas import DiagnosticResultOut, DiagnosticRunRequest
from backend.app.api.deps import get_current_user, require_role
from backend.app.diagnostic_engine.engine import DiagnosticEngine
from backend.app.diagnostic_engine.historical_model import HistoricalDiagnosticModel

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

    # 4. Fetch manual inspections for latest telemetry parameters
    latest_inspection = db.query(ManualInspection).filter(
        ManualInspection.machine_id == req.machine_id
    ).order_by(ManualInspection.timestamp.desc()).first()

    prev_inspection = db.query(ManualInspection).filter(
        ManualInspection.machine_id == req.machine_id
    ).order_by(ManualInspection.timestamp.desc()).offset(1).first()

    if latest_inspection:
        curr_engine_temp = latest_inspection.engine_temp
        curr_battery_voltage = latest_inspection.battery_voltage
        curr_oil_pressure = latest_inspection.oil_pressure
        curr_hydraulic_pressure = latest_inspection.hydraulic_pressure
        curr_operating_hours = latest_inspection.operating_hours
        curr_error_codes = latest_inspection.error_codes or []
        curr_observations = latest_inspection.observations or "None"
    else:
        curr_engine_temp = curr.temperature
        curr_battery_voltage = 24.0  # nominal default
        curr_oil_pressure = 40.0    # nominal default
        curr_hydraulic_pressure = 3000.0  # nominal default
        curr_operating_hours = machine.operating_hours or 1200.0
        curr_error_codes = []
        curr_observations = "None"

    if prev_inspection:
        old_engine_temp = f"{prev_inspection.engine_temp} °C"
        old_battery_voltage = f"{prev_inspection.battery_voltage} V"
        old_oil_pressure = f"{prev_inspection.oil_pressure} PSI"
        old_hydraulic_pressure = f"{prev_inspection.hydraulic_pressure} PSI"
        old_operating_hours = f"{prev_inspection.operating_hours} hrs"
        old_error_codes = ", ".join(prev_inspection.error_codes) if prev_inspection.error_codes else "None"
    else:
        # Requirement 4: Default Previous Value Data for Telemetry & Historical Audit
        old_engine_temp = "44.8 °C"
        old_battery_voltage = "24.0 V"
        old_oil_pressure = "40.0 PSI"
        old_hydraulic_pressure = "3000.0 PSI"
        old_operating_hours = f"{max(0, curr_operating_hours - 24.0):.1f} hrs" if curr_operating_hours else "1200.0 hrs"
        old_error_codes = "None"

    # 5. Serialize to dict for diagnostic engine
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
        "temperature": curr_engine_temp,
        "power_status": curr.power_status
    }

    # Initialize diagnostic result dict focused purely on Real-Time Telemetry
    diag_data = {
        "metrics": {
            "temperature": curr_engine_temp,
            "power_status": curr.power_status
        }
    }

    # 6. Telemetry comparison table & Real-Time Telemetry anomaly detection
    telemetry_comparison = [
        {
            "parameter": "Operating Hours",
            "normal": "--",
            "realtime": f"{curr_operating_hours} hrs",
            "old": old_operating_hours,
            "status": "Info"
        },
        {
            "parameter": "Engine Temperature",
            "normal": "< 85 °C",
            "realtime": f"{curr_engine_temp} °C",
            "old": old_engine_temp,
            "status": "Critical" if curr_engine_temp > 95.0 else "Warning" if curr_engine_temp > 85.0 else "Matched"
        },
        {
            "parameter": "Battery Voltage",
            "normal": ">= 23.5 V",
            "realtime": f"{curr_battery_voltage} V",
            "old": old_battery_voltage,
            "status": "Critical" if curr_battery_voltage < 22.0 else "Warning" if curr_battery_voltage < 23.5 else "Matched"
        },
        {
            "parameter": "Oil Pressure",
            "normal": ">= 35 PSI",
            "realtime": f"{curr_oil_pressure} PSI",
            "old": old_oil_pressure,
            "status": "Critical" if curr_oil_pressure < 25.0 else "Warning" if curr_oil_pressure < 35.0 else "Matched"
        },
        {
            "parameter": "Hydraulic Pressure",
            "normal": ">= 2200 PSI",
            "realtime": f"{curr_hydraulic_pressure} PSI",
            "old": old_hydraulic_pressure,
            "status": "Warning" if curr_hydraulic_pressure < 2200.0 else "Matched"
        },
        {
            "parameter": "Error Codes",
            "normal": "No active codes",
            "realtime": ", ".join(curr_error_codes) if curr_error_codes else "None",
            "old": old_error_codes,
            "status": "Warning" if curr_error_codes else "Matched"
        }
    ]

    telemetry_deductions = 0
    telemetry_issues = []

    if curr_engine_temp > 95.0:
        telemetry_deductions += 30
        telemetry_issues.append({
            "parameter": "Engine Temperature",
            "severity": "Critical",
            "expected": "< 85 °C",
            "current": f"{curr_engine_temp} °C",
            "message": f"Engine temperature critical overheat: {curr_engine_temp}°C (Nominal < 85°C)."
        })
    elif curr_engine_temp > 85.0:
        telemetry_deductions += 15
        telemetry_issues.append({
            "parameter": "Engine Temperature",
            "severity": "Warning",
            "expected": "< 85 °C",
            "current": f"{curr_engine_temp} °C",
            "message": f"Engine temperature elevated: {curr_engine_temp}°C (Nominal < 85°C)."
        })

    if curr_battery_voltage < 22.0:
        telemetry_deductions += 25
        telemetry_issues.append({
            "parameter": "Battery Voltage",
            "severity": "Critical",
            "expected": ">= 23.5 V",
            "current": f"{curr_battery_voltage} V",
            "message": f"Low battery system voltage: {curr_battery_voltage}V (Nominal >= 23.5V)."
        })
    elif curr_battery_voltage < 23.5:
        telemetry_deductions += 15
        telemetry_issues.append({
            "parameter": "Battery Voltage",
            "severity": "Warning",
            "expected": ">= 23.5 V",
            "current": f"{curr_battery_voltage} V",
            "message": f"Slightly low battery voltage: {curr_battery_voltage}V (Nominal >= 23.5V)."
        })

    if curr_oil_pressure < 25.0:
        telemetry_deductions += 25
        telemetry_issues.append({
            "parameter": "Oil Pressure",
            "severity": "Critical",
            "expected": ">= 35 PSI",
            "current": f"{curr_oil_pressure} PSI",
            "message": f"Critical low engine oil pressure: {curr_oil_pressure} PSI (Nominal >= 35 PSI)."
        })
    elif curr_oil_pressure < 35.0:
        telemetry_deductions += 15
        telemetry_issues.append({
            "parameter": "Oil Pressure",
            "severity": "Warning",
            "expected": ">= 35 PSI",
            "current": f"{curr_oil_pressure} PSI",
            "message": f"Sub-nominal engine oil pressure: {curr_oil_pressure} PSI (Nominal >= 35 PSI)."
        })

    if curr_hydraulic_pressure < 2200.0:
        telemetry_deductions += 15
        telemetry_issues.append({
            "parameter": "Hydraulic Pressure",
            "severity": "Warning",
            "expected": ">= 2200 PSI",
            "current": f"{curr_hydraulic_pressure} PSI",
            "message": f"Low auxiliary hydraulic pressure: {curr_hydraulic_pressure} PSI (Nominal >= 2200 PSI)."
        })

    if curr_error_codes:
        for err in curr_error_codes:
            telemetry_deductions += 15
            telemetry_issues.append({
                "parameter": "Diagnostic Code",
                "severity": "Warning",
                "expected": "No active codes",
                "current": err,
                "message": f"Active ECU/PLC diagnostic fault code recorded: {err}."
            })

    diag_data["issues"] = telemetry_issues
    diag_data["health_score"] = max(0, 100 - telemetry_deductions)

    has_critical = any(i.get("severity") == "Critical" for i in diag_data["issues"])
    has_warning = any(i.get("severity") == "Warning" for i in diag_data["issues"])

    if has_critical or diag_data["health_score"] < 50:
        diag_data["status"] = "Fault"
    elif has_warning or diag_data["health_score"] < 85:
        diag_data["status"] = "Warning"
    else:
        diag_data["status"] = "Healthy"

    diag_data["telemetry_comparison"] = telemetry_comparison
    diag_data["observations"] = curr_observations

    # 6c. Fetch past historical inspection records for AI time-series trend analysis
    past_results = db.query(DiagnosticResult).filter(
        DiagnosticResult.machine_id == req.machine_id
    ).order_by(DiagnosticResult.timestamp.desc()).limit(10).all()

    history_list = []
    for r in past_results:
        metrics = r.details.get("metrics", {}) if isinstance(r.details, dict) else {}
        history_list.append({
            "temperature": metrics.get("temperature", 45.0),
            "health_score": r.health_score,
            "status": r.status,
            "timestamp": str(r.timestamp)
        })

    # Evaluate machine health & operational decision against historical readings and baseline spec audit
    hist_evaluation = HistoricalDiagnosticModel.evaluate_machine_condition(
        machine_info={"name": machine.name, "model": machine.model, "category": machine.category},
        ref_config=ref_dict,
        curr_config=curr_dict,
        current_health_score=diag_data["health_score"],
        current_issues=diag_data["issues"],
        history_records=history_list
    )

    diag_data["historical_evaluation"] = hist_evaluation

    # 6. Save diagnostic result
    result = DiagnosticResult(
        machine_id=req.machine_id,
        timestamp=datetime.utcnow(),
        status=diag_data["status"],
        health_score=diag_data["health_score"],
        details=diag_data,
        notes=f"Diagnostic checked by {current_user.username}. Operational Decision: {hist_evaluation['status_display']}."
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
        details=f"Ran diagnosis on {machine.machine_id}. Health Score: {result.health_score}%. Decision: {hist_evaluation['status_display']}."
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
