import random
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, WorkOrder, ActivityLog, User
from backend.app.schemas.schemas import WorkOrderCreate, WorkOrderUpdate, WorkOrderOut
from backend.app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/work-orders", tags=["Automatic Work Order Generation"])

@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
def create_work_order(
    req: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Supervisor"]))
):
    machine = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    wo_code = f"WO-{datetime.utcnow().year}-{random.randint(100, 999)}"
    work_order = WorkOrder(
        work_order_id=wo_code,
        machine_id=req.machine_id,
        created_at=datetime.utcnow(),
        title=req.title,
        fault_description=req.fault_description,
        priority=req.priority or "Medium",
        status="Pending",
        assigned_technician_id=req.assigned_technician_id,
        spare_parts_json=req.spare_parts_json or [],
        est_repair_hours=req.est_repair_hours or 2.5
    )
    db.add(work_order)

    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Work Order Created",
        details=f"Work Order {wo_code} generated for {req.machine_id} (Priority: {work_order.priority})."
    )
    db.add(log)
    db.commit()
    db.refresh(work_order)
    return work_order

@router.get("", response_model=List[WorkOrderOut])
def list_work_orders(
    machine_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(WorkOrder)
    if machine_id:
        query = query.filter(WorkOrder.machine_id == machine_id)
    if status:
        query = query.filter(WorkOrder.status == status)
    if priority:
        query = query.filter(WorkOrder.priority == priority)
    return query.order_by(WorkOrder.created_at.desc()).all()

@router.get("/{id}", response_model=WorkOrderOut)
def get_work_order(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return wo

@router.put("/{id}", response_model=WorkOrderOut)
def update_work_order(
    id: int,
    req: WorkOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Supervisor"]))
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if req.status is not None:
        wo.status = req.status
    if req.priority is not None:
        wo.priority = req.priority
    if req.assigned_technician_id is not None:
        wo.assigned_technician_id = req.assigned_technician_id
    if req.spare_parts_json is not None:
        wo.spare_parts_json = req.spare_parts_json
    if req.est_repair_hours is not None:
        wo.est_repair_hours = req.est_repair_hours

    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Work Order Updated",
        details=f"Updated Work Order {wo.work_order_id} status to '{wo.status}'."
    )
    db.add(log)
    db.commit()
    db.refresh(wo)
    return wo

@router.delete("/{id}")
def delete_work_order(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Supervisor"]))
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    db.delete(wo)
    db.commit()
    return {"message": "Work order deleted successfully"}
