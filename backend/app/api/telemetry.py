from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, CurrentConfiguration, ReferenceConfiguration, DiagnosticResult, ActivityLog, Alert
from backend.app.diagnostic_engine.engine import DiagnosticEngine
from backend.app.diagnostic_engine.predictive_engine import PredictiveEngine

router = APIRouter(prefix="/telemetry", tags=["Live Remote Telemetry Ingestion"])

class TelemetryIngestPayload(BaseModel):
    machine_id: str
    temperature: float  # Engine / System temp in °C
    power_status: Optional[str] = "Stable"  # "Stable", "Fluctuating", "Low Voltage"
    operating_hours: Optional[float] = None
    battery_voltage: Optional[float] = 24.0
    oil_pressure: Optional[float] = 40.0
    hydraulic_pressure: Optional[float] = 3200.0
    error_codes: Optional[List[str]] = []

@router.post("/ingest")
def ingest_remote_telemetry(
    payload: TelemetryIngestPayload,
    db: Session = Depends(get_db)
):
    """
    Public / Device Ingestion API for remote machines, IoT Gateways, PLCs, and Edge nodes.
    Accepts live sensor feeds and automatically computes AI diagnostics and predictive RUL.
    """
    machine = db.query(Machine).filter(Machine.machine_id == payload.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine '{payload.machine_id}' not registered in fleet database.")

    # 1. Update machine status to Connected & update operating hours if provided
    machine.status = "Connected"
    if payload.operating_hours is not None:
        machine.operating_hours = payload.operating_hours

    # 2. Update Current Configuration telemetry values
    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == payload.machine_id).first()
    if curr:
        curr.temperature = payload.temperature
        curr.power_status = payload.power_status or "Stable"

    ref = db.query(ReferenceConfiguration).filter(ReferenceConfiguration.machine_id == payload.machine_id).first()

    # 3. Perform diagnostic evaluation
    ref_dict = {
        "firmware": ref.firmware if ref else "v4.2",
        "plc_version": ref.plc_version if ref else "v3.1",
        "cpu": ref.cpu if ref else "Intel",
        "ram": ref.ram if ref else "8GB",
        "storage": ref.storage if ref else "64GB",
        "communication_ports": ref.communication_ports if ref else ["Ethernet"],
        "installed_modules": ref.installed_modules if ref else ["IO"],
        "sensor_count": ref.sensor_count if ref else 8
    }

    curr_dict = {
        "firmware": curr.firmware if curr else "v4.2",
        "plc_version": curr.plc_version if curr else "v3.1",
        "cpu": curr.cpu if curr else "Intel",
        "ram": curr.ram if curr else "8GB",
        "storage": curr.storage if curr else "64GB",
        "communication_ports": curr.communication_ports if curr else ["Ethernet"],
        "installed_modules": curr.installed_modules if curr else ["IO"],
        "sensor_count": curr.sensor_count if curr else 8,
        "temperature": payload.temperature,
        "power_status": payload.power_status or "Stable"
    }

    diag_data = DiagnosticEngine.run_diagnostics(ref_dict, curr_dict)
    
    # Extra sensor checks
    extra_issues = []
    if payload.oil_pressure and payload.oil_pressure < 25.0:
        extra_issues.append({"parameter": "Oil Pressure", "severity": "Critical", "message": f"Low oil pressure: {payload.oil_pressure} PSI"})
        diag_data["health_score"] = max(0, diag_data["health_score"] - 30)
    
    if payload.battery_voltage and payload.battery_voltage < 22.0:
        extra_issues.append({"parameter": "Battery Voltage", "severity": "Critical", "message": f"Low battery voltage: {payload.battery_voltage}V"})
        diag_data["health_score"] = max(0, diag_data["health_score"] - 30)

    if payload.error_codes:
        for err in payload.error_codes:
            extra_issues.append({"parameter": "Remote DTC Code", "severity": "Warning", "message": f"Remote DTC code: {err}"})
            diag_data["health_score"] = max(0, diag_data["health_score"] - 10)

    if extra_issues:
        diag_data["issues"].extend(extra_issues)
        diag_data["status"] = "Healthy" if diag_data["health_score"] >= 85 else ("Warning" if diag_data["health_score"] >= 50 else "Fault")

    # Save Diagnostic Result
    result = DiagnosticResult(
        machine_id=payload.machine_id,
        timestamp=datetime.utcnow(),
        status=diag_data["status"],
        health_score=diag_data["health_score"],
        details=diag_data,
        notes=f"Remote telemetry feed ingested from external IoT Gateway/Computer."
    )
    db.add(result)

    # 4. Calculate & update Predictive RUL
    predictive = PredictiveEngine.calculate_predictive_metrics(
        {"operating_hours": machine.operating_hours},
        curr_dict,
        {"health_score": diag_data["health_score"]}
    )
    machine.rul_hours = predictive["rul_hours"]
    machine.risk_score = predictive["overall_risk_score"]

    # Trigger alert if critical
    if diag_data["health_score"] <= 20:
        new_alert = Alert(
            machine_id=payload.machine_id,
            health_score=diag_data["health_score"],
            message=f"REMOTE TELEMETRY CRITICAL FAULT: {machine.name} ({payload.machine_id}) Health Score: {diag_data['health_score']}%.",
            is_resolved=False
        )
        db.add(new_alert)

    log = ActivityLog(
        employee_id="REMOTE-IOT-GW",
        action="Telemetry Ingested",
        details=f"Remote telemetry packet ingested for {payload.machine_id}. Temp: {payload.temperature}°C, Health: {diag_data['health_score']}%."
    )
    db.add(log)
    db.commit()

    return {
        "status": "success",
        "machine_id": payload.machine_id,
        "health_score": diag_data["health_score"],
        "machine_status": diag_data["status"],
        "rul_hours": predictive["rul_hours"],
        "overall_risk_score": predictive["overall_risk_score"]
    }
