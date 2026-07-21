from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, CurrentConfiguration, ReferenceConfiguration, DiagnosticResult, User
from backend.app.api.deps import get_current_user
from backend.app.diagnostic_engine.predictive_engine import PredictiveEngine
from backend.app.diagnostic_engine.historical_model import HistoricalDiagnosticModel

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

    ref = db.query(ReferenceConfiguration).filter(ReferenceConfiguration.machine_id == machine_id).first()
    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == machine_id).first()
    past_results = db.query(DiagnosticResult).filter(DiagnosticResult.machine_id == machine_id).order_by(DiagnosticResult.timestamp.desc()).limit(10).all()

    latest_diag = past_results[0] if past_results else None

    machine_dict = {"operating_hours": machine.operating_hours}
    curr_dict = {
        "temperature": curr.temperature if curr else 45.0,
        "power_status": curr.power_status if curr else "Stable"
    }
    diag_dict = {"health_score": latest_diag.health_score if latest_diag else 90}

    metrics = PredictiveEngine.calculate_predictive_metrics(machine_dict, curr_dict, diag_dict)

    # Historical Sequence evaluation
    history_list = []
    for r in past_results:
        metrics_dict = r.details.get("metrics", {}) if isinstance(r.details, dict) else {}
        history_list.append({
            "temperature": metrics_dict.get("temperature", 45.0),
            "health_score": r.health_score,
            "status": r.status,
            "timestamp": str(r.timestamp)
        })

    ref_dict = {
        "firmware": ref.firmware if ref else "v4.0",
        "plc_version": ref.plc_version if ref else "v3.0",
        "cpu": ref.cpu if ref else "Intel",
        "ram": ref.ram if ref else "8GB",
        "storage": ref.storage if ref else "64GB",
        "communication_ports": ref.communication_ports if ref else ["Ethernet"],
        "installed_modules": ref.installed_modules if ref else ["IO"],
        "sensor_count": ref.sensor_count if ref else 8
    }

    issues = latest_diag.details.get("issues", []) if (latest_diag and isinstance(latest_diag.details, dict)) else []

    historical_evaluation = HistoricalDiagnosticModel.evaluate_machine_condition(
        machine_info={"name": machine.name, "model": machine.model, "category": machine.category},
        ref_config=ref_dict,
        curr_config=curr_dict,
        current_health_score=latest_diag.health_score if latest_diag else 90.0,
        current_issues=issues,
        history_records=history_list
    )

    # Sync machine model columns
    machine.rul_hours = metrics["rul_hours"]
    machine.risk_score = metrics["overall_risk_score"]
    db.commit()

    return {
        "machine_id": machine.machine_id,
        "name": machine.name,
        "operating_hours": machine.operating_hours,
        "metrics": metrics,
        "historical_evaluation": historical_evaluation
    }
