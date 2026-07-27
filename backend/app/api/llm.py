from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database.connection import get_db
from app.models.models import DiagnosticResult, Machine, ReferenceConfiguration, CurrentConfiguration, ActivityLog, User
from app.schemas.schemas import AssistantQueryRequest, AssistantQueryResponse
from app.api.deps import get_current_user, require_role
from app.llm.service import LLMService

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
    if req.machine_id:
        m = db.query(Machine).filter(Machine.machine_id == req.machine_id).first()
        if m:
            machine_context = f"Machine: {m.name}, Machine ID: {m.machine_id}, Model: {m.model}, Category: {m.category}, Status: {m.status}, Operating Hours: {m.operating_hours} hrs."

    # Call the LLM Service (Gemini/OpenAI/mock fallback)
    response_data = LLMService.ask_assistant(
        question=req.question,
        machine_context=machine_context
    )
    
    return response_data
