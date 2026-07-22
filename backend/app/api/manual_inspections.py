from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, ManualInspection, DiagnosticResult, ActivityLog, User, Alert
from backend.app.schemas.schemas import ManualInspectionCreate, ManualInspectionOut
from backend.app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/manual-inspections", tags=["Manual Data Collection"])

@router.post("", response_model=ManualInspectionOut, status_code=status.HTTP_201_CREATED)
def create_manual_inspection(
    req: ManualInspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Operator"]))
):
    machine = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Fetch previous manual inspection BEFORE adding the new record
    prev_inspection = db.query(ManualInspection).filter(
        ManualInspection.machine_id == req.machine_id
    ).order_by(ManualInspection.timestamp.desc()).first()

    inspection = ManualInspection(
        machine_id=req.machine_id,
        timestamp=datetime.utcnow(),
        operating_hours=req.operating_hours,
        engine_temp=req.engine_temp,
        battery_voltage=req.battery_voltage,
        oil_pressure=req.oil_pressure,
        hydraulic_pressure=req.hydraulic_pressure,
        error_codes=req.error_codes or [],
        observations=req.observations,
        image_url=req.image_url
    )
    db.add(inspection)

    # Update machine operating hours
    machine.operating_hours = req.operating_hours

    # Perform AI Health Analysis based on manual inspection metrics
    health_deductions = 0
    issues = []

    if req.engine_temp > 95.0:
        health_deductions += 40
        issues.append({"parameter": "Engine Temperature", "severity": "Critical", "message": f"Engine temp high: {req.engine_temp}°C (Nominal < 90°C)"})
    elif req.engine_temp > 85.0:
        health_deductions += 15
        issues.append({"parameter": "Engine Temperature", "severity": "Warning", "message": f"Engine temp elevated: {req.engine_temp}°C"})

    if req.battery_voltage < 22.0:
        health_deductions += 35
        issues.append({"parameter": "Battery Voltage", "severity": "Critical", "message": f"Low battery voltage: {req.battery_voltage}V (Nominal 24V)"})
    elif req.battery_voltage < 23.5:
        health_deductions += 15
        issues.append({"parameter": "Battery Voltage", "severity": "Warning", "message": f"Slightly low voltage: {req.battery_voltage}V"})

    if req.oil_pressure < 25.0:
        health_deductions += 35
        issues.append({"parameter": "Oil Pressure", "severity": "Critical", "message": f"Low engine oil pressure: {req.oil_pressure} PSI"})
    elif req.oil_pressure < 35.0:
        health_deductions += 15
        issues.append({"parameter": "Oil Pressure", "severity": "Warning", "message": f"Sub-nominal oil pressure: {req.oil_pressure} PSI"})

    if req.hydraulic_pressure < 2200.0:
        health_deductions += 30
        issues.append({"parameter": "Hydraulic Pressure", "severity": "Warning", "message": f"Low hydraulic pressure: {req.hydraulic_pressure} PSI"})

    if req.error_codes:
        for err in req.error_codes:
            health_deductions += 10
            issues.append({"parameter": "Diagnostic Code", "severity": "Warning", "message": f"Error code recorded: {err}"})

    health_score = max(0, 100 - health_deductions)
    diag_status = "Healthy" if health_score >= 85 else ("Warning" if health_score >= 50 else "Fault")

    if prev_inspection:
        old_engine_temp = f"{prev_inspection.engine_temp} °C"
        old_battery_voltage = f"{prev_inspection.battery_voltage} V"
        old_oil_pressure = f"{prev_inspection.oil_pressure} PSI"
        old_hydraulic_pressure = f"{prev_inspection.hydraulic_pressure} PSI"
        old_operating_hours = f"{prev_inspection.operating_hours} hrs"
        old_error_codes = ", ".join(prev_inspection.error_codes) if prev_inspection.error_codes else "None"
    else:
        old_engine_temp = "N/A"
        old_battery_voltage = "N/A"
        old_oil_pressure = "N/A"
        old_hydraulic_pressure = "N/A"
        old_operating_hours = "N/A"
        old_error_codes = "N/A"

    telemetry_comparison = [
        {
            "parameter": "Operating Hours",
            "normal": "--",
            "realtime": f"{req.operating_hours} hrs",
            "old": old_operating_hours,
            "status": "Info"
        },
        {
            "parameter": "Engine Temperature",
            "normal": "< 85 °C",
            "realtime": f"{req.engine_temp} °C",
            "old": old_engine_temp,
            "status": "Critical" if req.engine_temp > 95.0 else "Warning" if req.engine_temp > 85.0 else "Matched"
        },
        {
            "parameter": "Battery Voltage",
            "normal": ">= 23.5 V",
            "realtime": f"{req.battery_voltage} V",
            "old": old_battery_voltage,
            "status": "Critical" if req.battery_voltage < 22.0 else "Warning" if req.battery_voltage < 23.5 else "Matched"
        },
        {
            "parameter": "Oil Pressure",
            "normal": ">= 35 PSI",
            "realtime": f"{req.oil_pressure} PSI",
            "old": old_oil_pressure,
            "status": "Critical" if req.oil_pressure < 25.0 else "Warning" if req.oil_pressure < 35.0 else "Matched"
        },
        {
            "parameter": "Hydraulic Pressure",
            "normal": ">= 2200 PSI",
            "realtime": f"{req.hydraulic_pressure} PSI",
            "old": old_hydraulic_pressure,
            "status": "Warning" if req.hydraulic_pressure < 2200.0 else "Matched"
        },
        {
            "parameter": "Error Codes",
            "normal": "No active codes",
            "realtime": ", ".join(req.error_codes) if req.error_codes else "None",
            "old": old_error_codes,
            "status": "Warning" if req.error_codes else "Matched"
        }
    ]

    diag_result = DiagnosticResult(
        machine_id=req.machine_id,
        timestamp=datetime.utcnow(),
        status=diag_status,
        health_score=health_score,
        details={
            "mode": "Manual Fallback Inspection",
            "health_score": health_score,
            "status": diag_status,
            "issues": issues,
            "metrics": {
                "operating_hours": req.operating_hours,
                "engine_temp": req.engine_temp,
                "battery_voltage": req.battery_voltage,
                "oil_pressure": req.oil_pressure,
                "hydraulic_pressure": req.hydraulic_pressure
            },
            "telemetry_comparison": telemetry_comparison,
            "observations": req.observations or "None"
        },
        notes=f"Manual telemetry submitted by technician {current_user.username} ({current_user.employee_id})."
    )
    db.add(diag_result)

    if health_score <= 20:
        message = f"MANUAL INSPECTION ALERT: {machine.name} Health Score dropped to {health_score}%."
        new_alert = Alert(
            machine_id=req.machine_id,
            health_score=health_score,
            message=message,
            is_resolved=False
        )
        db.add(new_alert)

    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Manual Inspection Submitted",
        details=f"Manual data entry recorded for {req.machine_id}. Calculated Health Score: {health_score}%."
    )
    db.add(log)
    db.commit()
    db.refresh(inspection)
    return inspection

@router.get("", response_model=List[ManualInspectionOut])
def list_manual_inspections(
    machine_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ManualInspection)
    if machine_id:
        query = query.filter(ManualInspection.machine_id == machine_id)
    return query.order_by(ManualInspection.timestamp.desc()).all()
