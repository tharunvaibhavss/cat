from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, CurrentConfiguration, DiagnosticResult, User
from backend.app.api.deps import get_current_user
from backend.app.diagnostic_engine.predictive_engine import PredictiveEngine

router = APIRouter(prefix="/predictive", tags=["Predictive Maintenance & RUL"])

@router.get("/{machine_id}")
def get_predictive_metrics(
    machine_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == machine_id).first()
    latest_diag = db.query(DiagnosticResult).filter(DiagnosticResult.machine_id == machine_id).order_by(DiagnosticResult.timestamp.desc()).first()

    machine_dict = {"operating_hours": machine.operating_hours}
    curr_dict = {
        "temperature": curr.temperature if curr else 45.0,
        "power_status": curr.power_status if curr else "Stable"
    }
    diag_dict = {"health_score": latest_diag.health_score if latest_diag else 90}

    metrics = PredictiveEngine.calculate_predictive_metrics(machine_dict, curr_dict, diag_dict)

    # Sync machine model columns
    machine.rul_hours = metrics["rul_hours"]
    machine.risk_score = metrics["overall_risk_score"]
    db.commit()

    return {
        "machine_id": machine.machine_id,
        "name": machine.name,
        "operating_hours": machine.operating_hours,
        "metrics": metrics
    }
