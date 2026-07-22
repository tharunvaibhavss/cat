from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.app.database.connection import get_db
from backend.app.models.models import DiagnosticResult, Machine, ReferenceConfiguration, CurrentConfiguration, ActivityLog, User
from backend.app.schemas.schemas import AssistantQueryRequest, AssistantQueryResponse
from backend.app.api.deps import get_current_user, require_role
from backend.app.llm.service import LLMService

router = APIRouter(prefix="/llm", tags=["LLM Analysis Engine"])

class LLMAnalysisRequest(BaseModel):
    diagnostic_result_id: int

@router.post("/analyze")
def analyze_diagnostic_result(
    req: LLMAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Supervisor"]))
):
    # 1. Fetch diagnostic result
    result = db.query(DiagnosticResult).filter(DiagnosticResult.id == req.diagnostic_result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Diagnostic result not found")

    # 2. Fetch machine and configurations
    machine = db.query(Machine).filter(Machine.machine_id == result.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Associated machine record not found")

    ref = db.query(ReferenceConfiguration).filter(ReferenceConfiguration.machine_id == machine.machine_id).first()
    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == machine.machine_id).first()

    if not ref or not curr:
        raise HTTPException(status_code=400, detail="Associated machine configuration files are missing.")

    # 3. Serialize inputs
    machine_info = {
        "name": machine.name,
        "model": machine.model,
        "category": machine.category,
        "manufacturer": machine.manufacturer,
        "machine_id": machine.machine_id
    }

    ref_dict = {
        "firmware": ref.firmware,
        "plc_version": ref.plc_version,
        "cpu": ref.cpu,
        "ram": ref.ram,
        "storage": ref.storage,
        "communication_ports": ref.communication_ports,
        "installed_modules": ref.installed_modules,
        "sensor_count": ref.sensor_count
    }

    curr_dict = {
        "firmware": curr.firmware,
        "plc_version": curr.plc_version,
        "cpu": curr.cpu,
        "ram": curr.ram,
        "storage": curr.storage,
        "communication_ports": curr.communication_ports,
        "installed_modules": curr.installed_modules,
        "sensor_count": curr.sensor_count,
        "temperature": curr.temperature,
        "power_status": curr.power_status
    }

    # 4. Request Analysis from GPT (or fallback)
    analysis = LLMService.analyze_diagnostics(
        machine_info=machine_info,
        reference_config=ref_dict,
        current_config=curr_dict,
        diagnostic_result=result.details
    )

    # 5. Log activity
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="LLM Analysis Completed",
        details=f"Generated LLM Root Cause analysis report for {machine.machine_id}."
    )
    db.add(log)
    db.commit()

    return analysis

@router.post("/assistant-query", response_model=AssistantQueryResponse)
def assistant_query(
    req: AssistantQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    machine_context = ""
    machine_name = "Excavator EX-12"
    if req.machine_id:
        m = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
        if m:
            machine_name = f"{m.name} ({m.machine_id})"
            machine_context = f"Machine: {m.name}, Model: {m.model}, Category: {m.category}, Operating Hours: {m.operating_hours} hrs."

    q_lower = req.question.lower()

    if "overheat" in q_lower or "temperature" in q_lower or "ex-12" in q_lower:
        probable_cause = f"Thermal overload on {machine_name} caused by auxiliary cooling radiator fan relay failure, coolant line restriction, or clogged heat-exchanger fins under high load conditions."
        recommended_sequence = [
            "1. Safely de-energize and lock out main power (LOTO). Allow machine to idle and cool down for 20 minutes.",
            "2. Perform visual inspection of hydraulic oil heat exchanger and radiator cooling fins for debris or oil seepage.",
            "3. Test cooling fan electrical control relay circuit and thermistor temperature sensor signal line.",
            "4. Flush coolant system and verify thermostat valve actuation threshold."
        ]
        estimated_time = "2.5 Hours"
        spare_parts = ["OEM Radiator Fan Relay (Part #CAT-992-01)", "Thermostat Valve Assembly", "Heavy Duty Engine Coolant (10L)"]
        safety_precautions = [
            "LOTO Mandatory: De-energize high-voltage starter lines before touching cooling assembly.",
            "Thermal Hazard: Wear heat-resistant gloves and protective face shield while inspecting hot radiator lines.",
            "Pressure Warning: Do not loosen radiator pressure cap while coolant temperature exceeds 50°C."
        ]
        answer = f"Root cause analysis for {machine_name}: The high temperature reading is likely caused by coolant flow restriction combined with fan relay thermal lag under continuous operation."
    elif "hydraulic" in q_lower or "pressure" in q_lower or "leak" in q_lower:
        probable_cause = f"Hydraulic system pressure drop in {machine_name} due to main relief valve miscalibration or high-pressure seal degradation in the boom cylinder circuit."
        recommended_sequence = [
            "1. Inspect high-pressure hydraulic hose connections and main valve manifold for fluid seepage.",
            "2. Connect digital pressure transducer to diagnostic port TP-1 and measure idle vs load relief pressure.",
            "3. Recalibrate main relief valve setting to 3500 PSI baseline.",
            "4. Replace worn O-ring seals on primary distribution block."
        ]
        estimated_time = "3.0 Hours"
        spare_parts = ["Hydraulic Relief Valve Kit (Part #CAT-HYD-402)", "High-Pressure Nitrile Seal O-Ring Pack", "CAT ISO 46 Hydraulic Oil"]
        safety_precautions = [
            "Depressurize hydraulic accumulator fully prior to breaking line connections.",
            "Wear safety goggles, nitrile gloves, and steel-toe boots to prevent high-pressure fluid pinhole injection injuries."
        ]
        answer = f"Hydraulic Diagnostic Assessment: Pressure loss on {machine_name} stems from valve bypass or seal wear. Follow safety depressurization before servicing valve ports."
    else:
        probable_cause = f"Configuration drift or sensor communication noise detected on {machine_name} logic bus."
        recommended_sequence = [
            "1. Connect CAT Electronic Technician (ET) service tool to diagnostic port.",
            "2. Check active diagnostic fault codes and verify PLC CAN bus communication link status.",
            "3. Audit reference hardware configuration against current module inventory.",
            "4. Flash latest baseline firmware profile if CRC checksum mismatch occurs."
        ]
        estimated_time = "1.5 Hours"
        spare_parts = ["Diagnostic Bus Cable", "OEM PLC Gateway Transceiver Card"]
        safety_precautions = [
            "Verify ESD grounding wristband prior to touching open PLC logic boards.",
            "Ensure stable 24V DC battery backup power during ECU firmware flashing."
        ]
        answer = f"Diagnostic AI Assistant Recommendations for {machine_name}: Perform standard system audit using OEM diagnostics tool and verify signal line continuity."

    return AssistantQueryResponse(
        answer=answer,
        probable_cause=probable_cause,
        recommended_sequence=recommended_sequence,
        estimated_repair_time=estimated_time,
        required_spare_parts=spare_parts,
        safety_precautions=safety_precautions
    )
