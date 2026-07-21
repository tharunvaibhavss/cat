from sqlalchemy.orm import Session
from backend.app.database.connection import SessionLocal, Base, engine
from backend.app.models.models import User, Site, Machine, ReferenceConfiguration, CurrentConfiguration, DiagnosticResult, Report, ActivityLog, ManualInspection, WorkOrder, VisionInspection, Alert
from backend.app.utils.security import get_password_hash
from backend.app.diagnostic_engine.engine import DiagnosticEngine
from backend.app.llm.service import LLMService
import datetime
import os

def seed_database():
    # Make sure tables exist
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # Clear existing data
        db.query(Alert).delete()
        db.query(VisionInspection).delete()
        db.query(WorkOrder).delete()
        db.query(ManualInspection).delete()
        db.query(ActivityLog).delete()
        db.query(Report).delete()
        db.query(DiagnosticResult).delete()
        db.query(CurrentConfiguration).delete()
        db.query(ReferenceConfiguration).delete()
        db.query(Machine).delete()
        db.query(Site).delete()
        db.query(User).delete()
        db.commit()

        print("Cleared database...")

        # 1. Seed Users
        users = [
            User(employee_id="EMP-ADMIN01", username="John Administrator", role="Administrator", password_hash=get_password_hash("admin123"), email="admin@cat-diagnostics.com"),
            User(employee_id="EMP-ENG01", username="Sarah Engineer", role="Maintenance Engineer", password_hash=get_password_hash("eng123"), email="engineer@cat-diagnostics.com"),
            User(employee_id="EMP-OP01", username="Dave Operator", role="Operator", password_hash=get_password_hash("op123"), email="operator@cat-diagnostics.com"),
            User(employee_id="EMP-SUP01", username="Helen Supervisor", role="Supervisor", password_hash=get_password_hash("sup123"), email="workwiththarun@gmail.com"),
        ]
        db.add_all(users)
        db.commit()
        print("Seeded Users...")

        # 2. Seed Industrial Sites
        sites = [
            Site(site_id="SITE-AZ-01", name="Arizona Copper Mine #1", location="Morenci, Arizona", region="North America", machine_count=2),
            Site(site_id="SITE-NV-02", name="Nevada Quarry North", location="Elko, Nevada", region="North America", machine_count=2),
            Site(site_id="SITE-CL-03", name="Chile Lithium Facility", location="Atacama, Chile", region="South America", machine_count=1),
        ]
        db.add_all(sites)
        db.commit()
        print("Seeded Sites...")

        # 3. Define machine configurations & predictive metrics
        machines_data = [
            {
                "machine_id": "CAT-HEX-320",
                "name": "CAT Hydraulic Excavator",
                "manufacturer": "Caterpillar Inc.",
                "category": "CAT Hydraulic Excavator",
                "model": "320-GC",
                "status": "Connected",
                "site_id": "SITE-AZ-01",
                "location_name": "Arizona Pit 4",
                "operating_hours": 3420.5,
                "rul_hours": 1850.0,
                "risk_score": 28.4,
                "ref_config": {
                    "firmware": "v4.2.1-lts",
                    "plc_version": "v3.12-revB",
                    "cpu": "Intel Atom E3950",
                    "ram": "8GB DDR3",
                    "storage": "64GB SSD",
                    "communication_ports": ["USB", "COM1", "COM2", "Ethernet"],
                    "installed_modules": ["Analog Input", "Digital IO", "CAN Bus controller"],
                    "sensor_count": 12
                },
                "cur_config": {
                    "firmware": "v4.2.1-lts",
                    "plc_version": "v3.10-revA",  # Mismatch (Warning)
                    "cpu": "Intel Atom E3950",
                    "ram": "4GB DDR3",             # Mismatch (Warning)
                    "storage": "64GB SSD",
                    "communication_ports": ["USB", "COM1", "COM2", "Ethernet"],
                    "installed_modules": ["Analog Input", "Digital IO", "CAN Bus controller"],
                    "sensor_count": 12,
                    "temperature": 52.4,
                    "power_status": "Stable"
                }
            },
            {
                "machine_id": "CAT-WLD-950",
                "name": "CAT Wheel Loader",
                "manufacturer": "Caterpillar Inc.",
                "category": "CAT Wheel Loader",
                "model": "950-GC",
                "status": "Connected",
                "site_id": "SITE-AZ-01",
                "location_name": "Arizona Stockpile B",
                "operating_hours": 1210.0,
                "rul_hours": 5800.0,
                "risk_score": 4.2,
                "ref_config": {
                    "firmware": "v2.8.5",
                    "plc_version": "v1.88",
                    "cpu": "ARM Cortex-A72",
                    "ram": "2GB LPDDR4",
                    "storage": "16GB eMMC",
                    "communication_ports": ["COM1", "Ethernet"],
                    "installed_modules": ["Analog Input", "Digital IO"],
                    "sensor_count": 8
                },
                "cur_config": {
                    "firmware": "v2.8.5",
                    "plc_version": "v1.88",
                    "cpu": "ARM Cortex-A72",
                    "ram": "2GB LPDDR4",
                    "storage": "16GB eMMC",
                    "communication_ports": ["COM1", "Ethernet"],
                    "installed_modules": ["Analog Input", "Digital IO"],
                    "sensor_count": 8,
                    "temperature": 44.8,
                    "power_status": "Stable"
                }
            },
            {
                "machine_id": "CAT-BDZ-D6",
                "name": "CAT Bulldozer",
                "manufacturer": "Caterpillar Inc.",
                "category": "CAT Bulldozer",
                "model": "D6-LGP",
                "status": "Connected",
                "site_id": "SITE-NV-02",
                "location_name": "Nevada Quarry Ridge",
                "operating_hours": 5890.0,
                "rul_hours": 720.0,
                "risk_score": 64.5,
                "ref_config": {
                    "firmware": "v6.1.0-build22",
                    "plc_version": "v5.0.1",
                    "cpu": "AMD G-Series GX-412",
                    "ram": "4GB DDR3",
                    "storage": "32GB mSATA",
                    "communication_ports": ["USB", "COM1", "Ethernet", "Modbus-RTU"],
                    "installed_modules": ["Analog Input", "CAN Bus controller", "GPS receiver"],
                    "sensor_count": 16
                },
                "cur_config": {
                    "firmware": "v5.9.0-build11",  # Mismatch
                    "plc_version": "v5.0.1",
                    "cpu": "AMD G-Series GX-412",
                    "ram": "4GB DDR3",
                    "storage": "32GB mSATA",
                    "communication_ports": ["USB", "COM1", "Ethernet", "Modbus-RTU"],
                    "installed_modules": ["Analog Input", "CAN Bus controller", "GPS receiver"],
                    "sensor_count": 14,
                    "temperature": 68.2,
                    "power_status": "Stable"
                }
            },
            {
                "machine_id": "CAT-MGD-140",
                "name": "CAT Motor Grader",
                "manufacturer": "Caterpillar Inc.",
                "category": "CAT Motor Grader",
                "model": "140-AWD",
                "status": "Disconnected",
                "site_id": "SITE-NV-02",
                "location_name": "Nevada Access Road",
                "operating_hours": 4120.0,
                "rul_hours": 2300.0,
                "risk_score": 18.0,
                "ref_config": {
                    "firmware": "v3.3.4",
                    "plc_version": "v2.1",
                    "cpu": "Cortex-M7",
                    "ram": "1MB SRAM",
                    "storage": "8MB Flash",
                    "communication_ports": ["COM1", "CAN1"],
                    "installed_modules": ["Digital IO"],
                    "sensor_count": 6
                },
                "cur_config": {
                    "firmware": "v3.3.4",
                    "plc_version": "v2.1",
                    "cpu": "Cortex-M7",
                    "ram": "1MB SRAM",
                    "storage": "8MB Flash",
                    "communication_ports": ["COM1", "CAN1"],
                    "installed_modules": ["Digital IO"],
                    "sensor_count": 6,
                    "temperature": 32.5,
                    "power_status": "Stable"
                }
            },
            {
                "machine_id": "CAT-GEN-C175",
                "name": "CAT Diesel Generator",
                "manufacturer": "Caterpillar Inc.",
                "category": "CAT Diesel Generator",
                "model": "C175-16",
                "status": "Connected",
                "site_id": "SITE-CL-03",
                "location_name": "Atacama Power Station 1",
                "operating_hours": 8940.0,
                "rul_hours": 150.0,
                "risk_score": 91.8,
                "ref_config": {
                    "firmware": "v9.4.0",
                    "plc_version": "v8.32",
                    "cpu": "Intel Core i3-7100U",
                    "ram": "16GB DDR4",
                    "storage": "128GB SSD",
                    "communication_ports": ["USB", "COM1", "COM2", "Ethernet", "Modbus-TCP", "Profibus"],
                    "installed_modules": ["Analog Input", "Digital IO", "CAN Bus controller", "Power Logger Card"],
                    "sensor_count": 24
                },
                "cur_config": {
                    "firmware": "v9.0.2",
                    "plc_version": "v8.00",
                    "cpu": "Intel Pentium 4415U",
                    "ram": "8GB DDR4",
                    "storage": "128GB SSD",
                    "communication_ports": ["USB", "COM1", "Ethernet", "Modbus-TCP"],
                    "installed_modules": ["Analog Input", "Digital IO", "CAN Bus controller"],
                    "sensor_count": 20,
                    "temperature": 94.5,
                    "power_status": "Low Voltage"
                }
            }
        ]

        for item in machines_data:
            machine = Machine(
                machine_id=item["machine_id"],
                name=item["name"],
                manufacturer=item["manufacturer"],
                category=item["category"],
                model=item["model"],
                status=item["status"],
                site_id=item["site_id"],
                location_name=item["location_name"],
                operating_hours=item["operating_hours"],
                rul_hours=item["rul_hours"],
                risk_score=item["risk_score"]
            )
            db.add(machine)
            db.flush()

            ref = ReferenceConfiguration(
                machine_id=machine.machine_id,
                firmware=item["ref_config"]["firmware"],
                plc_version=item["ref_config"]["plc_version"],
                cpu=item["ref_config"]["cpu"],
                ram=item["ref_config"]["ram"],
                storage=item["ref_config"]["storage"],
                communication_ports=item["ref_config"]["communication_ports"],
                installed_modules=item["ref_config"]["installed_modules"],
                sensor_count=item["ref_config"]["sensor_count"]
            )
            db.add(ref)

            cur = CurrentConfiguration(
                machine_id=machine.machine_id,
                firmware=item["cur_config"]["firmware"],
                plc_version=item["cur_config"]["plc_version"],
                cpu=item["cur_config"]["cpu"],
                ram=item["cur_config"]["ram"],
                storage=item["cur_config"]["storage"],
                communication_ports=item["cur_config"]["communication_ports"],
                installed_modules=item["cur_config"]["installed_modules"],
                sensor_count=item["cur_config"]["sensor_count"],
                temperature=item["cur_config"]["temperature"],
                power_status=item["cur_config"]["power_status"]
            )
            db.add(cur)
            db.commit()

            if machine.status == "Connected":
                diag_data = DiagnosticEngine.run_diagnostics(item["ref_config"], item["cur_config"])
                diag_res = DiagnosticResult(
                    machine_id=machine.machine_id,
                    timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1),
                    status=diag_data["status"],
                    health_score=diag_data["health_score"],
                    details=diag_data,
                    notes=f"Auto-generated evaluation for {machine.name}."
                )
                db.add(diag_res)
                db.commit()

        # 4. Seed Initial Work Orders
        work_orders = [
            WorkOrder(
                work_order_id="WO-2026-001",
                machine_id="CAT-GEN-C175",
                title="Replace Power Logger Expansion Card & Coolant Flushing",
                fault_description="Generator experiencing 94.5 C thermal overload and missing Power Logger card causing voltage drop.",
                priority="Critical",
                status="In Progress",
                assigned_technician_id=users[1].id, # Sarah Engineer
                spare_parts_json=["CAT-PWR-LOG-CARD", "OEM Synthetic Coolant 50L", "Filter Cap 44B"],
                est_repair_hours=4.0
            ),
            WorkOrder(
                work_order_id="WO-2026-002",
                machine_id="CAT-BDZ-D6",
                title="Firmware Upgrade & Sensor Harness Inspection",
                fault_description="Bulldozer firmware regression v5.9 vs v6.1 and 2 offline temperature sensors.",
                priority="High",
                status="Pending",
                assigned_technician_id=users[1].id,
                spare_parts_json=["Sensor Wire Harness Kit", "CAT ET Adapter III"],
                est_repair_hours=2.5
            )
        ]
        db.add_all(work_orders)
        db.commit()
        print("Seeded Work Orders...")

        # 5. Seed Manual Inspections
        manual_inspections = [
            ManualInspection(
                machine_id="CAT-MGD-140",
                operating_hours=4120.0,
                engine_temp=78.5,
                battery_voltage=23.8,
                oil_pressure=42.0,
                hydraulic_pressure=2100.0,
                error_codes=["ERR-302", "ERR-104"],
                observations="Technician noted slight vibration near hydraulic pump manifold during manual shift test.",
                image_url="/static/sample_inspection1.jpg"
            )
        ]
        db.add_all(manual_inspections)
        db.commit()
        print("Seeded Manual Inspections...")

        # 6. Seed Vision Inspections
        vision_inspections = [
            VisionInspection(
                machine_id="CAT-GEN-C175",
                image_url="/static/sample_generator_leak.jpg",
                defects_detected=["Oil Leak", "Thermal Discoloration"],
                confidence_score=0.94,
                ppe_compliant=True,
                summary="AI Vision detected active fluid seepage near secondary oil filter housing."
            )
        ]
        db.add_all(vision_inspections)
        db.commit()
        print("Seeded Vision Inspections...")

        # 7. Seed Activity Logs
        logs = [
            ActivityLog(employee_id="EMP-ADMIN01", action="Login", details="Admin login completed successfully."),
            ActivityLog(employee_id="EMP-ENG01", action="Login", details="Maintenance Engineer logged into terminal."),
            ActivityLog(employee_id="EMP-ENG01", action="Machine Connected", details="Established telemetry connection with CAT-HEX-320."),
            ActivityLog(employee_id="EMP-ENG01", action="Diagnostic Started", details="Triggered automated check on CAT-HEX-320."),
            ActivityLog(employee_id="EMP-ENG01", action="Work Order Created", details="Generated Work Order WO-2026-001 for CAT-GEN-C175.")
        ]
        db.add_all(logs)
        db.commit()

        print("Database seeding completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
