from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, VisionInspection, ActivityLog, User
from backend.app.schemas.schemas import VisionInspectionOut
from backend.app.vision.service import VisionService
from backend.app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/vision", tags=["Computer Vision Inspection"])

class VisionInspectRequest(BaseModel):
    machine_id: str
    image_url: str

@router.post("/inspect", response_model=VisionInspectionOut, status_code=status.HTTP_201_CREATED)
def run_vision_inspection(
    req: VisionInspectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Operator"]))
):
    machine = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    analysis = VisionService.analyze_image(req.image_url, machine_id=req.machine_id)

    defects_list = analysis.get("defects_detected_list", [])
    confidence = analysis.get("overall_confidence", 0.92)
    ppe_compliant = analysis.get("ppe_compliant", True)
    summary = analysis.get("summary", "")

    inspection = VisionInspection(
        machine_id=req.machine_id,
        timestamp=datetime.utcnow(),
        image_url=req.image_url,
        defects_detected=defects_list,
        confidence_score=confidence,
        ppe_compliant=ppe_compliant,
        summary=summary
    )
    db.add(inspection)

    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Vision Inspection Completed",
        details=f"Ran AI Vision scan on {req.machine_id}. Defects: {len(defects_list)}. PPE Compliant: {ppe_compliant}."
    )
    db.add(log)
    db.commit()
    db.refresh(inspection)
    return inspection

@router.get("/history", response_model=List[VisionInspectionOut])
def get_vision_history(
    machine_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(VisionInspection)
    if machine_id:
        query = query.filter(VisionInspection.machine_id == machine_id)
    return query.order_by(VisionInspection.timestamp.desc()).all()
