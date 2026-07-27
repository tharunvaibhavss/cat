from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    employee_id: str
    username: str
    department: Optional[str] = None
    is_department_admin: Optional[bool] = False

class TokenData(BaseModel):
    employee_id: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    employee_id: str
    password: str
    remember_me: Optional[bool] = False

# User Schemas
class UserBase(BaseModel):
    employee_id: str
    username: str
    role: str
    email: Optional[str] = None
    department: Optional[str] = None
    is_department_admin: Optional[bool] = False

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None

class UserOut(UserBase):
    id: int

    class Config:
        from_attributes = True

# Site Schema
class SiteOut(BaseModel):
    id: int
    site_id: str
    name: str
    location: str
    region: str
    machine_count: int

    class Config:
        from_attributes = True

# Configuration Schemas
class ReferenceConfigBase(BaseModel):
    firmware: str
    plc_version: str
    cpu: str
    ram: str
    storage: str
    communication_ports: List[str]
    installed_modules: List[str]
    sensor_count: int

class ReferenceConfigCreate(ReferenceConfigBase):
    machine_id: str

class ReferenceConfigOut(ReferenceConfigBase):
    id: int
    machine_id: str

    class Config:
        from_attributes = True

class CurrentConfigBase(BaseModel):
    firmware: str
    plc_version: str
    cpu: str
    ram: str
    storage: str
    communication_ports: List[str]
    installed_modules: List[str]
    sensor_count: int
    temperature: float
    power_status: str

class CurrentConfigCreate(CurrentConfigBase):
    machine_id: str

class CurrentConfigOut(CurrentConfigBase):
    id: int
    machine_id: str

    class Config:
        from_attributes = True

# Machine Schemas
class MachineBase(BaseModel):
    machine_id: str
    name: str
    manufacturer: str
    category: str
    model: str
    status: Optional[str] = "Disconnected"
    site_id: Optional[str] = None
    location_name: Optional[str] = "Main Facility"
    operating_hours: Optional[float] = 1200.0
    rul_hours: Optional[float] = 4500.0
    risk_score: Optional[float] = 12.5

class MachineCreate(MachineBase):
    reference_config: ReferenceConfigBase
    current_config: Optional[CurrentConfigBase] = None

class MachineUpdate(BaseModel):
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = None
    site_id: Optional[str] = None
    location_name: Optional[str] = None
    operating_hours: Optional[float] = None
    rul_hours: Optional[float] = None
    risk_score: Optional[float] = None
    reference_config: Optional[ReferenceConfigBase] = None
    current_config: Optional[CurrentConfigBase] = None

class MachineOut(MachineBase):
    id: int
    reference_config: Optional[ReferenceConfigOut] = None
    current_config: Optional[CurrentConfigOut] = None

    class Config:
        from_attributes = True

# Manual Inspection Schemas
class ManualInspectionCreate(BaseModel):
    machine_id: str
    operating_hours: float
    engine_temp: float
    battery_voltage: float
    oil_pressure: float
    hydraulic_pressure: float
    error_codes: Optional[List[str]] = []
    observations: Optional[str] = None
    image_url: Optional[str] = None

class ManualInspectionOut(ManualInspectionCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# Work Order Schemas
class WorkOrderCreate(BaseModel):
    machine_id: str
    title: str
    fault_description: str
    priority: Optional[str] = "Medium"
    assigned_technician_id: Optional[int] = None
    spare_parts_json: Optional[List[str]] = []
    est_repair_hours: Optional[float] = 2.5

class WorkOrderUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_technician_id: Optional[int] = None
    spare_parts_json: Optional[List[str]] = None
    est_repair_hours: Optional[float] = None

class WorkOrderOut(BaseModel):
    id: int
    work_order_id: str
    machine_id: str
    created_at: datetime
    title: str
    fault_description: str
    priority: str
    status: str
    assigned_technician_id: Optional[int] = None
    spare_parts_json: Optional[Any] = None
    est_repair_hours: float

    class Config:
        from_attributes = True

# Vision Inspection Schemas
class VisionInspectionOut(BaseModel):
    id: int
    machine_id: str
    timestamp: datetime
    image_url: str
    defects_detected: List[str]
    confidence_score: float
    ppe_compliant: bool
    summary: Optional[str] = None

    class Config:
        from_attributes = True

# Assistant Q&A Schema
class AssistantQueryRequest(BaseModel):
    machine_id: Optional[str] = None
    question: str

class AssistantQueryResponse(BaseModel):
    answer: str
    probable_cause: str
    recommended_sequence: List[str]
    estimated_repair_time: str
    required_spare_parts: List[str]
    safety_precautions: List[str]

# Diagnostic Schemas
class DiagnosticRunRequest(BaseModel):
    machine_id: str

class DiagnosticResultOut(BaseModel):
    id: int
    machine_id: str
    timestamp: datetime
    status: str
    health_score: int
    details: Any
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class DiagnosticResultUpdateNotes(BaseModel):
    notes: str

# Report Schemas
class ReportCreate(BaseModel):
    diagnostic_result_id: int
    title: str

class ReportUpdateMetadata(BaseModel):
    title: str

class ReportOut(BaseModel):
    id: int
    diagnostic_result_id: int
    title: str
    file_path: str
    generated_at: datetime
    engineer_id: Optional[int]
    metadata_json: Optional[Any] = None

    class Config:
        from_attributes = True

# Activity Log Schema
class ActivityLogOut(BaseModel):
    id: int
    timestamp: datetime
    employee_id: str
    action: str
    details: Optional[str] = None

    class Config:
        from_attributes = True

# Alert Schemas
class AlertOut(BaseModel):
    id: int
    machine_id: str
    timestamp: datetime
    health_score: int
    message: str
    is_resolved: bool
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Session Recovery Schemas
class SessionRecoveryHeartbeatPayload(BaseModel):
    session_id: str
    device_id: str
    current_page: Optional[str] = None
    current_module: Optional[str] = None
    current_task: Optional[str] = None
    current_form_state: Optional[dict] = None
    unsaved_changes_count: Optional[int] = 0
    step_progress: Optional[str] = "1 of 1"

class SessionRecoveryStateSavePayload(BaseModel):
    session_id: str
    device_id: str
    current_page: Optional[str] = None
    current_module: Optional[str] = None
    current_task: Optional[str] = None
    current_form_state: Optional[dict] = None
    unsaved_changes_count: Optional[int] = 0
    step_progress: Optional[str] = "1 of 1"
    selected_machine: Optional[str] = None
    selected_site: Optional[str] = None
    filters: Optional[dict] = None
    dashboard_state: Optional[dict] = None

class SessionRecoveryOut(BaseModel):
    session_id: str
    user_id: int
    username: Optional[str] = None
    department: Optional[str] = None
    device_id: Optional[str] = None
    active_device: Optional[str] = None
    current_page: Optional[str] = None
    current_module: Optional[str] = None
    current_task: Optional[str] = None
    current_form_state: Optional[Any] = None
    unsaved_changes_count: int = 0
    step_progress: Optional[str] = None
    status: str
    locked_by: Optional[int] = None
    last_updated: datetime
    last_activity_time: datetime

    class Config:
        from_attributes = True

class AuditLogOut(BaseModel):
    id: int
    session_id: str
    user_id: Optional[int] = None
    username: Optional[str] = None
    department: Optional[str] = None
    device: Optional[str] = None
    timestamp: datetime
    ip_address: Optional[str] = None
    action: str
    status: Optional[str] = None

    class Config:
        from_attributes = True

class AssignEmployeePayload(BaseModel):
    employee_id: str

class HandoverPayload(BaseModel):
    current_session_id: str
