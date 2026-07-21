import pytest
from backend.app.diagnostic_engine.engine import DiagnosticEngine
from backend.app.utils.security import get_password_hash, verify_password

def test_password_hashing():
    password = "supersecretpass"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpass", hashed) is False

def test_diagnostic_engine_healthy():
    reference = {
        "firmware": "v1.0.0",
        "plc_version": "v1.0.0",
        "cpu": "ARM Cortex-M4",
        "ram": "512KB",
        "storage": "4MB",
        "communication_ports": ["COM1", "CAN1"],
        "installed_modules": ["Analog Input"],
        "sensor_count": 4
    }
    
    current = {
        "firmware": "v1.0.0",
        "plc_version": "v1.0.0",
        "cpu": "ARM Cortex-M4",
        "ram": "512KB",
        "storage": "4MB",
        "communication_ports": ["COM1", "CAN1"],
        "installed_modules": ["Analog Input"],
        "sensor_count": 4,
        "temperature": 45.0,
        "power_status": "Stable"
    }

    results = DiagnosticEngine.run_diagnostics(reference, current)
    assert results["status"] == "Healthy"
    assert results["health_score"] == 100
    assert len(results["issues"]) == 0

def test_diagnostic_engine_firmware_mismatch():
    reference = {
        "firmware": "v1.2.0",
        "plc_version": "v1.0.0",
        "cpu": "ARM Cortex-M4",
        "ram": "512KB",
        "storage": "4MB",
        "communication_ports": ["COM1"],
        "installed_modules": [],
        "sensor_count": 2
    }
    
    current = {
        "firmware": "v1.0.0",  # Mismatched firmware (Critical)
        "plc_version": "v1.0.0",
        "cpu": "ARM Cortex-M4",
        "ram": "512KB",
        "storage": "4MB",
        "communication_ports": ["COM1"],
        "installed_modules": [],
        "sensor_count": 2,
        "temperature": 45.0,
        "power_status": "Stable"
    }

    results = DiagnosticEngine.run_diagnostics(reference, current)
    assert results["status"] == "Fault"  # Due to critical firmware version mismatch
    assert results["health_score"] == 80  # 100 - 20
    assert len(results["issues"]) == 1
    assert results["issues"][0]["parameter"] == "Firmware Version"
    assert results["issues"][0]["severity"] == "Critical"

def test_diagnostic_engine_critical_thermal():
    reference = {
        "firmware": "v1.0.0",
        "plc_version": "v1.0.0",
        "cpu": "ARM Cortex-M4",
        "ram": "512KB",
        "storage": "4MB",
        "communication_ports": ["COM1"],
        "installed_modules": [],
        "sensor_count": 2
    }
    
    current = {
        "firmware": "v1.0.0",
        "plc_version": "v1.0.0",
        "cpu": "ARM Cortex-M4",
        "ram": "512KB",
        "storage": "4MB",
        "communication_ports": ["COM1"],
        "installed_modules": [],
        "sensor_count": 2,
        "temperature": 95.5,  # Dangerous temperature (>90)
        "power_status": "Stable"
    }

    results = DiagnosticEngine.run_diagnostics(reference, current)
    assert results["status"] == "Fault"
    assert results["health_score"] == 65  # 100 - 35
    assert len(results["issues"]) == 1
    assert "CRITICAL" in results["issues"][0]["message"]

def test_email_alert_logging_fallback():
    import os
    from backend.app.utils.email_service import send_risk_alert_email
    machine_info = {
        "machine_id": "TEST-UNIT-01",
        "name": "Test Hydraulic System",
        "model": "CAT-T1"
    }
    diagnostic_result = {
        "health_score": 15,
        "status": "Fault",
        "details": {
            "issues": [
                {"parameter": "Thermal", "severity": "Critical", "message": "Temperature exceeded 95C."},
                {"parameter": "Firmware", "severity": "Critical", "message": "Firmware version mismatch."}
            ]
        }
    }
    send_risk_alert_email(["workwiththarun@gmail.com"], machine_info, diagnostic_result)
    assert os.path.exists("backend/static/reports/last_alert_email.html") is True
