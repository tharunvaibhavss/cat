from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, CurrentConfiguration, DiagnosticResult, User, ActivityLog
from backend.app.api.deps import get_current_user, require_role
from backend.app.diagnostic_engine.predictive_engine import PredictiveEngine

router = APIRouter(prefix="/digital-twin", tags=["Digital Twin Visualization"])

class SimulationRequest(BaseModel):
    machine_id: str
    scenario: str  # Thermal Spike, Low Power Voltage, Hydraulic Failure, Overload

@router.get("/{machine_id}")
def get_digital_twin(
    machine_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == machine_id).first()
    latest_diag = db.query(DiagnosticResult).filter(DiagnosticResult.machine_id == machine_id).order_by(DiagnosticResult.timestamp.desc()).first()

    machine_dict = {
        "operating_hours": machine.operating_hours,
        "rul_hours": machine.rul_hours,
        "risk_score": machine.risk_score
    }
    curr_dict = {
        "temperature": curr.temperature if curr else 45.0,
        "power_status": curr.power_status if curr else "Stable",
        "plc_version": curr.plc_version if curr else "v2.4",
        "installed_modules": curr.installed_modules if curr else []
    }
    diag_dict = {
        "health_score": latest_diag.health_score if latest_diag else 95
    }

    predictive_metrics = PredictiveEngine.calculate_predictive_metrics(machine_dict, curr_dict, diag_dict)

    # Component health scores
    temp = curr.temperature if curr else 45.0
    engine_health = max(10, min(100, int(100 - (temp - 30) * 1.2)))
    hydraulic_health = max(10, min(100, int(predictive_metrics["component_risk"]["hydraulics"] * -1 + 100)))
    electrical_health = 100 if (curr and curr.power_status == "Stable") else (70 if curr and curr.power_status == "Fluctuating" else 40)
    cooling_health = max(10, min(100, int(100 - (temp - 40) * 1.5)))

    return {
        "machine_id": machine.machine_id,
        "name": machine.name,
        "category": machine.category,
        "model": machine.model,
        "status": machine.status,
        "location": machine.location_name,
        "site_id": machine.site_id,
        "telemetry": {
            "operating_hours": machine.operating_hours,
            "temperature": temp,
            "power_status": curr.power_status if curr else "Stable",
            "plc_version": curr.plc_version if curr else "v2.4",
            "sensor_count": curr.sensor_count if curr else 12
        },
        "components": [
            {"name": "Diesel Engine & Turbocharger", "health": engine_health, "temp": temp, "status": "Nominal" if engine_health > 75 else "Warning"},
            {"name": "Main Hydraulic Pump & Valves", "health": hydraulic_health, "pressure": 3200, "status": "Nominal" if hydraulic_health > 70 else "Fault"},
            {"name": "Electrical Harness & Battery", "health": electrical_health, "voltage": 24.1, "status": "Nominal" if electrical_health > 80 else "Warning"},
            {"name": "Thermal Radiator & Cooling Fan", "health": cooling_health, "coolant_flow": "Normal", "status": "Nominal" if cooling_health > 70 else "Warning"}
        ],
        "predictive": predictive_metrics,
        "latest_diagnostic": {
            "health_score": latest_diag.health_score if latest_diag else 100,
            "status": latest_diag.status if latest_diag else "Healthy",
            "timestamp": latest_diag.timestamp.strftime("%Y-%m-%d %H:%M:%S") if latest_diag else None
        }
    }

@router.post("/simulate")
def run_simulation(
    req: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer"]))
):
    machine = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == req.machine_id).first()
    if not curr:
        raise HTTPException(status_code=400, detail="Current configuration missing.")

    if req.scenario == "Thermal Spike":
        curr.temperature = 98.5
    elif req.scenario == "Low Power Voltage":
        curr.power_status = "Low Voltage"
    elif req.scenario == "Hydraulic Overload":
        curr.temperature = 88.0
        curr.power_status = "Fluctuating"
    else:
        curr.temperature = 45.0
        curr.power_status = "Stable"

    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Digital Twin Simulation",
        details=f"Ran '{req.scenario}' failure simulation on Digital Twin of {req.machine_id}."
    )
    db.add(log)
    db.commit()

    return {"message": f"Simulation scenario '{req.scenario}' applied to Digital Twin of {req.machine_id}."}
