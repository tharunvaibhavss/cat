from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, ReferenceConfiguration, CurrentConfiguration, ActivityLog, User
from backend.app.schemas.schemas import MachineOut, MachineCreate, MachineUpdate
from backend.app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/machines", tags=["Machines Management"])

class ConnectionRequest(BaseModel):
    machine_id: str
    connection_type: str  # USB, COM Port, Serial, Ethernet, PLC, Industrial Controller

@router.get("", response_model=List[MachineOut])
def list_machines(
    db: Session = Depends(get_db),
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = db.query(Machine)
    if category:
        query = query.filter(Machine.category == category)
    if status:
        query = query.filter(Machine.status == status)
    if search:
        query = query.filter(
            (Machine.name.ilike(f"%{search}%")) |
            (Machine.machine_id.ilike(f"%{search}%")) |
            (Machine.model.ilike(f"%{search}%")) |
            (Machine.manufacturer.ilike(f"%{search}%"))
        )
    return query.all()

@router.post("", response_model=MachineOut, status_code=status.HTTP_201_CREATED)
def create_machine(
    machine_in: MachineCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["Administrator"]))
):
    # Check if duplicate machine ID
    existing = db.query(Machine).filter(Machine.machine_id == machine_in.machine_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Machine with ID {machine_in.machine_id} already exists."
        )

    # Create machine
    machine = Machine(
        machine_id=machine_in.machine_id,
        name=machine_in.name,
        manufacturer=machine_in.manufacturer,
        category=machine_in.category,
        model=machine_in.model,
        status="Disconnected"
    )
    db.add(machine)
    db.flush()

    # Create reference configuration
    ref_conf = ReferenceConfiguration(
        machine_id=machine.machine_id,
        firmware=machine_in.reference_config.firmware,
        plc_version=machine_in.reference_config.plc_version,
        cpu=machine_in.reference_config.cpu,
        ram=machine_in.reference_config.ram,
        storage=machine_in.reference_config.storage,
        communication_ports=machine_in.reference_config.communication_ports,
        installed_modules=machine_in.reference_config.installed_modules,
        sensor_count=machine_in.reference_config.sensor_count
    )
    db.add(ref_conf)

    # Create current configuration if provided, otherwise default it equal to reference
    curr_data = machine_in.current_config or machine_in.reference_config
    curr_conf = CurrentConfiguration(
        machine_id=machine.machine_id,
        firmware=curr_data.firmware,
        plc_version=curr_data.plc_version,
        cpu=curr_data.cpu,
        ram=curr_data.ram,
        storage=curr_data.storage,
        communication_ports=curr_data.communication_ports,
        installed_modules=curr_data.installed_modules,
        sensor_count=curr_data.sensor_count,
        temperature=45.0,  # nominal temperature
        power_status="Stable"
    )
    db.add(curr_conf)
    
    # Log activity
    log = ActivityLog(
        employee_id=admin.employee_id,
        action="Admin Changes",
        details=f"Added machine {machine.machine_id} ({machine.name}) to inventory."
    )
    db.add(log)
    db.commit()
    db.refresh(machine)
    return machine

@router.put("/{id}", response_model=MachineOut)
def update_machine(
    id: int,
    machine_in: MachineUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["Administrator"]))
):
    machine = db.query(Machine).filter(Machine.id == id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    if machine_in.name is not None:
        machine.name = machine_in.name
    if machine_in.manufacturer is not None:
        machine.manufacturer = machine_in.manufacturer
    if machine_in.category is not None:
        machine.category = machine_in.category
    if machine_in.model is not None:
        machine.model = machine_in.model
    if machine_in.status is not None:
        machine.status = machine_in.status

    if machine_in.reference_config is not None:
        ref = db.query(ReferenceConfiguration).filter(ReferenceConfiguration.machine_id == machine.machine_id).first()
        if ref:
            ref.firmware = machine_in.reference_config.firmware
            ref.plc_version = machine_in.reference_config.plc_version
            ref.cpu = machine_in.reference_config.cpu
            ref.ram = machine_in.reference_config.ram
            ref.storage = machine_in.reference_config.storage
            ref.communication_ports = machine_in.reference_config.communication_ports
            ref.installed_modules = machine_in.reference_config.installed_modules
            ref.sensor_count = machine_in.reference_config.sensor_count

    if machine_in.current_config is not None:
        curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == machine.machine_id).first()
        if curr:
            curr.firmware = machine_in.current_config.firmware
            curr.plc_version = machine_in.current_config.plc_version
            curr.cpu = machine_in.current_config.cpu
            curr.ram = machine_in.current_config.ram
            curr.storage = machine_in.current_config.storage
            curr.communication_ports = machine_in.current_config.communication_ports
            curr.installed_modules = machine_in.current_config.installed_modules
            curr.sensor_count = machine_in.current_config.sensor_count
            if hasattr(machine_in.current_config, 'temperature') and machine_in.current_config.temperature is not None:
                curr.temperature = machine_in.current_config.temperature
            if hasattr(machine_in.current_config, 'power_status') and machine_in.current_config.power_status is not None:
                curr.power_status = machine_in.current_config.power_status

    log = ActivityLog(
        employee_id=admin.employee_id,
        action="Admin Changes",
        details=f"Updated machine config for {machine.machine_id}."
    )
    db.add(log)
    db.commit()
    db.refresh(machine)
    return machine

@router.delete("/{id}")
def delete_machine(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["Administrator"]))
):
    machine = db.query(Machine).filter(Machine.id == id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    db.delete(machine)
    log = ActivityLog(
        employee_id=admin.employee_id,
        action="Admin Changes",
        details=f"Deleted machine {machine.machine_id} from database."
    )
    db.add(log)
    db.commit()
    return {"message": f"Machine {machine.machine_id} deleted successfully"}

# ----------------- CONNECTION SIMULATION ENDPOINTS -----------------

@router.post("/connect")
def connect_machine(
    req: ConnectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Operator"]))
):
    machine = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Connection Simulation logic
    # - If Ethernet or PLC: we'll simulate immediate successful "Connected" status.
    # - If USB or Serial: we'll simulate a 10% chance of "Connection Failed" for diagnostic testing, 
    #   otherwise "Connected".
    # - If COM Port: if we use COM9 we fail, otherwise connection succeeds.
    import random
    
    new_status = "Connected"
    if req.connection_type == "COM Port" and "9" in req.machine_id:
        new_status = "Connection Failed"
    elif req.connection_type == "Serial" and random.random() < 0.15:
        new_status = "Connection Failed"
    elif req.connection_type == "Industrial Controller":
        new_status = "Waiting"

    machine.status = new_status
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Machine Connected",
        details=f"Connected {machine.machine_id} ({machine.name}) via {req.connection_type}. Result: {new_status}."
    )
    db.add(log)
    db.commit()

    return {"status": new_status, "machine_id": machine.machine_id}

@router.post("/disconnect")
def disconnect_machine(
    req: ConnectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Operator"]))
):
    machine = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    machine.status = "Disconnected"
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Machine Disconnected",
        details=f"Disconnected interface from {machine.machine_id}."
    )
    db.add(log)
    db.commit()

    return {"status": "Disconnected", "machine_id": machine.machine_id}
