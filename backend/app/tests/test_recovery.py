import pytest
import datetime
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from fastapi import HTTPException
from app.database.connection import Base
from app.models.models import User, UserSession, SessionAuditLog
from app.schemas.schemas import SessionRecoveryHeartbeatPayload, AssignEmployeePayload
from app.api.recovery_router import session_heartbeat, get_recovery_session, resume_recovery_session, assign_another_employee, get_session_audit_logs

# Setup sqlite in memory database for unit testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class MockRequest:
    def __init__(self, host="127.0.0.1"):
        self.client = type("Client", (object,), {"host": host})()

@pytest.fixture(scope="function")
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test users
    admin = User(
        id=1,
        employee_id="EMP-VM-ADMIN",
        username="Keshava Admin",
        password_hash="...",
        role="Supervisor",
        department="Vendor Management",
        is_department_admin=True
    )
    user_a = User(
        id=2,
        employee_id="EMP-VM-A",
        username="Employee A",
        password_hash="...",
        role="Operator",
        department="Vendor Management",
        is_department_admin=False
    )
    user_b = User(
        id=3,
        employee_id="EMP-VM-B",
        username="Employee B",
        password_hash="...",
        role="Operator",
        department="Vendor Management",
        is_department_admin=False
    )
    finance_user = User(
        id=4,
        employee_id="EMP-FI-C",
        username="Employee C",
        password_hash="...",
        role="Operator",
        department="Finance",
        is_department_admin=False
    )
    db.add_all([admin, user_a, user_b, finance_user])
    db.commit()
    
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_heartbeat_creation_and_reconnect(test_db):
    db = test_db
    user_a = db.query(User).filter(User.id == 2).first()
    request = MockRequest()
    
    # 1. Send heartbeat for a new session
    payload = SessionRecoveryHeartbeatPayload(
        session_id="session-recovery-123",
        device_id="device-laptop-a",
        current_page="/dashboard/vendor-approval",
        current_module="Vendor Management",
        current_task="Vendor Approval",
        current_form_state={"name": "Keshava"},
        unsaved_changes_count=3,
        step_progress="5 of 8"
    )
    
    res = session_heartbeat(payload, request, db, user_a)
    assert res["status"] == "success"
    
    # Verify session is saved
    session_rec = db.query(UserSession).filter(UserSession.session_id == "session-recovery-123").first()
    assert session_rec is not None
    assert session_rec.status == "ACTIVE"
    assert session_rec.current_task == "Vendor Approval"
    
    # Verify audit log is recorded
    audit = db.query(SessionAuditLog).filter(SessionAuditLog.session_id == "session-recovery-123").first()
    assert audit is not None
    assert audit.action == "User Logged In"

def test_recovery_restrictions_and_resume(test_db):
    db = test_db
    admin = db.query(User).filter(User.id == 1).first()
    user_a = db.query(User).filter(User.id == 2).first()
    user_b = db.query(User).filter(User.id == 3).first()
    finance_user = db.query(User).filter(User.id == 4).first()
    request = MockRequest()

    # Pre-populate an interrupted session for user_a
    session_rec = UserSession(
        session_id="session-interrupted",
        user_id=user_a.id,
        department=user_a.department,
        device_id="device-laptop-a",
        current_page="/dashboard/vendor-approval",
        current_module="Vendor Management",
        current_task="Vendor Approval",
        status="INTERRUPTED",
        last_activity_time=datetime.datetime.utcnow() - datetime.timedelta(seconds=45)
    )
    db.add(session_rec)
    db.commit()

    # 1. Other department user tries to access -> 403 Forbidden
    with pytest.raises(HTTPException) as excinfo:
        get_recovery_session("session-interrupted", db, finance_user)
    assert excinfo.value.status_code == 403

    # 2. Same department backup user accesses -> Succeeds
    recovery_session = get_recovery_session("session-interrupted", db, user_b)
    assert recovery_session.session_id == "session-interrupted"

    # 3. Same department backup user resumes -> Succeeds & Locks
    resume_res = resume_recovery_session("session-interrupted", request, db, user_b)
    assert resume_res["status"] == "success"
    
    # Verify lock and ownership transfer
    db.refresh(session_rec)
    assert session_rec.locked_by == user_b.id
    assert session_rec.user_id == user_b.id
    assert session_rec.status == "RECOVERING"

    # 4. Another user tries to resume -> Fails due to lock
    with pytest.raises(HTTPException) as excinfo:
        resume_recovery_session("session-interrupted", request, db, admin)
    assert excinfo.value.status_code == 400

def test_admin_delegation(test_db):
    db = test_db
    admin = db.query(User).filter(User.id == 1).first()
    user_a = db.query(User).filter(User.id == 2).first()
    user_b = db.query(User).filter(User.id == 3).first()
    request = MockRequest()

    # Pre-populate interrupted session
    session_rec = UserSession(
        session_id="session-delegated",
        user_id=user_a.id,
        department=user_a.department,
        device_id="device-laptop-a",
        status="INTERRUPTED",
        last_activity_time=datetime.datetime.utcnow()
    )
    db.add(session_rec)
    db.commit()

    # Assign to user_b by department admin
    payload = AssignEmployeePayload(employee_id="EMP-VM-B")
    assign_res = assign_another_employee("session-delegated", payload, request, db, admin)
    assert assign_res["status"] == "success"

    # Verify ownership transfer
    db.refresh(session_rec)
    assert session_rec.user_id == user_b.id
    assert session_rec.status == "RECOVERED"
