import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database.connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Administrator, Maintenance Engineer, Operator, Supervisor
    email = Column(String, nullable=True)
    department = Column(String, nullable=True)
    is_department_admin = Column(Boolean, default=False, nullable=True)

    reports = relationship("Report", back_populates="engineer")
    work_orders = relationship("WorkOrder", back_populates="assigned_technician")
    fcm_tokens = relationship("UserFCMToken", back_populates="user", cascade="all, delete-orphan")
    notification_settings = relationship("UserNotificationSettings", uselist=False, back_populates="user", cascade="all, delete-orphan")
    notification_history = relationship("NotificationHistory", back_populates="user", cascade="all, delete-orphan")

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(String, unique=True, index=True, nullable=False)  # e.g., 'SITE-AZ-01'
    name = Column(String, nullable=False)  # e.g., 'Arizona Copper Mine #1'
    location = Column(String, nullable=False)  # e.g., 'Morenci, Arizona'
    region = Column(String, nullable=False)  # e.g., 'North America'
    machine_count = Column(Integer, default=0)

    machines = relationship("Machine", back_populates="site")

class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, unique=True, index=True, nullable=False)  # e.g., 'CAT-HEX-320'
    name = Column(String, nullable=False)
    manufacturer = Column(String, nullable=False)
    category = Column(String, nullable=False)  # CAT Hydraulic Excavator, etc.
    model = Column(String, nullable=False)
    status = Column(String, default="Disconnected")  # Connected, Disconnected, Waiting, Connection Failed
    
    # Site & Location
    site_id = Column(String, ForeignKey("sites.site_id", ondelete="SET NULL"), nullable=True)
    location_name = Column(String, default="Main Facility")

    # Predictive Metrics & Telemetry
    operating_hours = Column(Float, default=1200.0)
    rul_hours = Column(Float, default=4500.0)  # Remaining Useful Life in hours
    risk_score = Column(Float, default=12.5)   # Estimated failure probability %
    health_score = Column(Integer, default=100) # AI Machine Health Score (0-100)
    utilization_percentage = Column(Float, default=85.0)
    ranking_score = Column(Float, default=0.0)

    # Relationships
    site = relationship("Site", back_populates="machines")
    reference_config = relationship("ReferenceConfiguration", uselist=False, back_populates="machine", cascade="all, delete-orphan")
    current_config = relationship("CurrentConfiguration", uselist=False, back_populates="machine", cascade="all, delete-orphan")
    diagnostic_results = relationship("DiagnosticResult", back_populates="machine", cascade="all, delete-orphan")
    manual_inspections = relationship("ManualInspection", back_populates="machine", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="machine", cascade="all, delete-orphan")
    vision_inspections = relationship("VisionInspection", back_populates="machine", cascade="all, delete-orphan")
    health_history = relationship("MachineHealthScore", back_populates="machine", cascade="all, delete-orphan")

class ReferenceConfiguration(Base):
    __tablename__ = "reference_configurations"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), unique=True, nullable=False)
    firmware = Column(String, nullable=False)
    plc_version = Column(String, nullable=False)
    cpu = Column(String, nullable=False)
    ram = Column(String, nullable=False)
    storage = Column(String, nullable=False)
    communication_ports = Column(JSON, nullable=False)  # list of ports, e.g. ["USB", "COM1", "Ethernet"]
    installed_modules = Column(JSON, nullable=False)  # list of modules
    sensor_count = Column(Integer, nullable=False)

    machine = relationship("Machine", back_populates="reference_config")

class CurrentConfiguration(Base):
    __tablename__ = "current_configurations"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), unique=True, nullable=False)
    firmware = Column(String, nullable=False)
    plc_version = Column(String, nullable=False)
    cpu = Column(String, nullable=False)
    ram = Column(String, nullable=False)
    storage = Column(String, nullable=False)
    communication_ports = Column(JSON, nullable=False)
    installed_modules = Column(JSON, nullable=False)
    sensor_count = Column(Integer, nullable=False)
    
    # Runtime conditions
    temperature = Column(Float, nullable=False)
    power_status = Column(String, nullable=False)  # "Stable", "Fluctuating", "Low Voltage"

    machine = relationship("Machine", back_populates="current_config")

class DiagnosticResult(Base):
    __tablename__ = "diagnostic_results"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    status = Column(String, nullable=False)  # Healthy, Warning, Fault
    health_score = Column(Integer, nullable=False)  # 0 to 100
    details = Column(JSON, nullable=False)  # Mismatches, errors, metrics
    notes = Column(String, nullable=True)  # User custom notes

    machine = relationship("Machine", back_populates="diagnostic_results")
    report = relationship("Report", uselist=False, back_populates="diagnostic_result", cascade="all, delete-orphan")

class ManualInspection(Base):
    __tablename__ = "manual_inspections"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    operating_hours = Column(Float, nullable=False)
    engine_temp = Column(Float, nullable=False)
    battery_voltage = Column(Float, nullable=False)
    oil_pressure = Column(Float, nullable=False)
    hydraulic_pressure = Column(Float, nullable=False)
    error_codes = Column(JSON, nullable=True)  # e.g., ["ERR-302", "ERR-404"]
    observations = Column(String, nullable=True)
    image_url = Column(String, nullable=True)

    machine = relationship("Machine", back_populates="manual_inspections")

class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(String, unique=True, index=True, nullable=False)  # e.g., 'WO-2026-001'
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    title = Column(String, nullable=False)
    fault_description = Column(String, nullable=False)
    priority = Column(String, default="Medium")  # High, Medium, Low, Critical
    status = Column(String, default="Pending")    # Pending, In Progress, Completed
    assigned_technician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    spare_parts_json = Column(JSON, nullable=True)
    est_repair_hours = Column(Float, default=2.5)
    predicted_schedule_date = Column(DateTime, nullable=True)
    resolution_notes = Column(String, nullable=True)
    completion_date = Column(DateTime, nullable=True)

    machine = relationship("Machine", back_populates="work_orders")
    assigned_technician = relationship("User", back_populates="work_orders")

class VisionInspection(Base):
    __tablename__ = "vision_inspections"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    image_url = Column(String, nullable=False)
    defects_detected = Column(JSON, nullable=False)  # list of defects e.g. ["Oil Leak", "Corrosion"]
    confidence_score = Column(Float, default=0.92)
    ppe_compliant = Column(Boolean, default=True)
    summary = Column(String, nullable=True)

    machine = relationship("Machine", back_populates="vision_inspections")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    diagnostic_result_id = Column(Integer, ForeignKey("diagnostic_results.id", ondelete="CASCADE"), unique=True, nullable=False)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    engineer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    metadata_json = Column(JSON, nullable=True)  # Additional metadata

    engineer = relationship("User", back_populates="reports")
    diagnostic_result = relationship("DiagnosticResult", back_populates="report")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    employee_id = Column(String, nullable=False)
    action = Column(String, nullable=False)  # Login, Logout, Machine Connected, Diagnostic Started, etc.
    details = Column(String, nullable=True)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    health_score = Column(Integer, nullable=False)
    message = Column(String, nullable=False)
    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    machine = relationship("Machine")

class UserFCMToken(Base):
    __tablename__ = "user_fcm_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    fcm_token = Column(String, unique=True, index=True, nullable=False)
    browser_name = Column(String, nullable=True)
    device_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="fcm_tokens")

class UserNotificationSettings(Base):
    __tablename__ = "user_notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    critical_enabled = Column(Boolean, default=True, nullable=False)
    warning_enabled = Column(Boolean, default=True, nullable=False)
    maintenance_enabled = Column(Boolean, default=True, nullable=False)
    inspection_enabled = Column(Boolean, default=True, nullable=False)
    info_enabled = Column(Boolean, default=True, nullable=False)
    quiet_hours_start = Column(String, nullable=True)  # e.g., "22:00"
    quiet_hours_end = Column(String, nullable=True)    # e.g., "06:00"

    user = relationship("User", back_populates="notification_settings")

class NotificationHistory(Base):
    __tablename__ = "notification_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    body = Column(String, nullable=False)
    category = Column(String, nullable=False)  # Critical, Warning, Maintenance, Inspection, Information
    machine_id = Column(String, nullable=True)
    alert_id = Column(Integer, nullable=True)
    sent_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="notification_history")

class Device(Base):
    __tablename__ = "devices"

    id = Column(String, primary_key=True, index=True) # UUID device_id
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_name = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    operating_system = Column(String, nullable=True)
    fcm_token = Column(String, nullable=True)
    status = Column(String, default="ONLINE") # ONLINE, OFFLINE
    last_seen = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="devices")

class UserSession(Base):
    __tablename__ = "user_sessions"

    session_id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    active_device = Column(String, nullable=True) # current device_id
    current_page = Column(String, nullable=True)
    selected_machine = Column(String, nullable=True)
    selected_site = Column(String, nullable=True)
    filters = Column(JSON, nullable=True)
    dashboard_state = Column(JSON, nullable=True)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Handover and Recovery additions
    department = Column(String, nullable=True)
    device_id = Column(String, nullable=True)
    current_module = Column(String, nullable=True)
    current_task = Column(String, nullable=True)
    current_form_state = Column(JSON, nullable=True)
    unsaved_changes_count = Column(Integer, default=0)
    step_progress = Column(String, default="1 of 1")
    status = Column(String, default="ACTIVE") # ACTIVE, INTERRUPTED, RECOVERING, RECOVERED, CLOSED
    locked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_activity_time = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    timeout_alert_sent = Column(Boolean, default=False, nullable=True)

    user = relationship("User", back_populates="sessions", foreign_keys=[user_id])

class SessionAuditLog(Base):
    __tablename__ = "session_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String, nullable=True)
    department = Column(String, nullable=True)
    device = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    ip_address = Column(String, nullable=True)
    action = Column(String, nullable=False)
    status = Column(String, nullable=True)

User.devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
User.sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan", foreign_keys="[UserSession.user_id]")

class MachineHealthScore(Base):
    __tablename__ = "machine_health_scores"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.machine_id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    score = Column(Integer, nullable=False)
    
    machine = relationship("Machine", back_populates="health_history")

class FleetStatistic(Base):
    __tablename__ = "fleet_statistics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.datetime.utcnow, unique=True, nullable=False)
    total_downtime_hours = Column(Float, default=0.0)
    average_fleet_health = Column(Float, default=100.0)
    maintenance_cost = Column(Float, default=0.0)
    fuel_consumption = Column(Float, default=0.0)
