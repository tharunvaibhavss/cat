from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import ActivityLog, User
from backend.app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/edge", tags=["Offline Edge AI Gateway"])

# In-memory edge gateway status state
edge_state = {
    "is_offline_mode": False,
    "buffer_count": 0,
    "last_sync": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    "gateway_id": "EDGE-GW-MINING-01"
}

class ToggleEdgeRequest(BaseModel):
    offline_mode: bool

@router.get("/status")
def get_edge_status(current_user: User = Depends(get_current_user)):
    return edge_state

@router.post("/toggle")
def toggle_edge_mode(
    req: ToggleEdgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer"]))
):
    edge_state["is_offline_mode"] = req.offline_mode
    if req.offline_mode:
        edge_state["buffer_count"] = 5
    
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Edge Mode Toggled",
        details=f"Edge AI Gateway mode switched to {'OFFLINE (Local Inference)' if req.offline_mode else 'ONLINE (Central Sync)'}."
    )
    db.add(log)
    db.commit()
    return edge_state

@router.post("/sync")
def sync_edge_buffer(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer"]))
):
    synced_records = edge_state["buffer_count"]
    edge_state["buffer_count"] = 0
    edge_state["is_offline_mode"] = False
    edge_state["last_sync"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Edge Gateway Synced",
        details=f"Successfully synchronized {synced_records} offline telemetry records from Edge Gateway {edge_state['gateway_id']}."
    )
    db.add(log)
    db.commit()

    return {
        "message": f"Successfully synced {synced_records} queued offline telemetry records.",
        "edge_state": edge_state
    }
