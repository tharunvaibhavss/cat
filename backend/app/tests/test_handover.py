import pytest
import datetime
from sqlalchemy.orm import sessionmaker
from app.database.connection import Base
from app.models.models import User, Device, UserSession
from app.api.handover import DeviceRegisterPayload, HeartbeatPayload, SessionSavePayload, SessionResumePayload
from app.api.handover import register_device, update_heartbeat, save_session, resume_session, list_devices, remove_device

# In-memory SQLite for testing
from sqlalchemy import create_engine
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Create test user
    test_user = User(
        id=1,
        employee_id="EMP-999",
        username="Tester John",
        password_hash="...",
        role="Operator"
    )
    db.add(test_user)
    db.commit()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_device_registration_and_heartbeat(setup_db):
    db = setup_db
    user = db.query(User).first()
    
    # 1. Register device
    payload = DeviceRegisterPayload(
        device_id="device-123",
        device_name="Test Laptop A",
        browser_name="Chrome",
        operating_system="Windows",
        fcm_token="mock-token-abc"
    )
    res = register_device(payload, db, user)
    assert res["status"] == "success"
    assert res["device_id"] == "device-123"

    # Verify database record
    device = db.query(Device).filter(Device.id == "device-123").first()
    assert device is not None
    assert device.device_name == "Test Laptop A"
    assert device.status == "ONLINE"

    # 2. Update Heartbeat
    heartbeat_payload = HeartbeatPayload(
        device_id="device-123",
        session_id="session-abc",
        timestamp=str(datetime.datetime.utcnow().isoformat())
    )
    hb_res = update_heartbeat(heartbeat_payload, db, user)
    assert hb_res["status"] == "success"

def test_session_save_and_resume(setup_db):
    db = setup_db
    user = db.query(User).first()

    # 1. Save state
    save_payload = SessionSavePayload(
        session_id="session-abc",
        device_id="device-123",
        current_page="/dashboard/machines",
        selected_machine="CAT-HEX-320",
        selected_site="SITE-AZ-01",
        filters={"category": "heavy"},
        dashboard_state={"some": "state"}
    )
    save_res = save_session(save_payload, db, user)
    assert save_res["status"] == "success"

    # Verify session save
    session_rec = db.query(UserSession).filter(UserSession.session_id == "session-abc").first()
    assert session_rec is not None
    assert session_rec.selected_machine == "CAT-HEX-320"
    assert session_rec.active_device == "device-123"

    # 2. Resume session on another device (device-456)
    resume_payload = SessionResumePayload(
        session_id="session-abc",
        device_id="device-456"
    )
    resume_res = resume_session(resume_payload, db, user)
    assert resume_res["status"] == "success"

    # Verify session active_device transferred to device-456
    db.refresh(session_rec)
    assert session_rec.active_device == "device-456"
