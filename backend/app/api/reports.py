import os
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from backend.app.database.connection import get_db
from backend.app.models.models import Report, DiagnosticResult, Machine, ReferenceConfiguration, CurrentConfiguration, ActivityLog, User
from backend.app.schemas.schemas import ReportOut, ReportCreate, ReportUpdateMetadata
from backend.app.api.deps import get_current_user, require_role
from backend.app.llm.service import LLMService
from backend.app.reports.generator import ReportGenerator

router = APIRouter(prefix="/reports", tags=["Report Management"])

# Helper class for updating title
class ReportUpdateTitle(BaseModel):
    title: str

@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def generate_report(
    req: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Supervisor"]))
):
    # 1. Check if report already exists for this diagnostic result
    existing = db.query(Report).filter(Report.diagnostic_result_id == req.diagnostic_result_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A PDF report already exists for diagnostic ID {req.diagnostic_result_id}. Please download the existing file."
        )

    # 2. Get diagnostic result
    result = db.query(DiagnosticResult).filter(DiagnosticResult.id == req.diagnostic_result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Diagnostic result record not found")

    # 3. Get machine and config details
    machine = db.query(Machine).filter(Machine.machine_id == result.machine_id).first()
    ref = db.query(ReferenceConfiguration).filter(ReferenceConfiguration.machine_id == result.machine_id).first()
    curr = db.query(CurrentConfiguration).filter(CurrentConfiguration.machine_id == result.machine_id).first()

    if not machine or not ref or not curr:
        raise HTTPException(status_code=400, detail="Associated machine details are incomplete. Cannot generate PDF.")

    machine_info = {
        "name": machine.name,
        "model": machine.model,
        "category": machine.category,
        "manufacturer": machine.manufacturer,
        "machine_id": machine.machine_id
    }

    # 4. Generate/fetch AI analysis for PDF embedding
    ai_analysis = LLMService.analyze_diagnostics(
        machine_info=machine_info,
        reference_config={
            "firmware": ref.firmware,
            "plc_version": ref.plc_version,
            "cpu": ref.cpu,
            "ram": ref.ram,
            "storage": ref.storage,
            "communication_ports": ref.communication_ports,
            "installed_modules": ref.installed_modules,
            "sensor_count": ref.sensor_count
        },
        current_config={
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
        },
        diagnostic_result=result.details
    )

    # 5. Define static save directory and compile report PDF
    report_dir = os.path.join("backend", "static", "reports")
    os.makedirs(report_dir, exist_ok=True)
    report_filename = f"report_{machine.machine_id}_{result.id}_{int(datetime.utcnow().timestamp())}.pdf"
    report_file_path = os.path.join(report_dir, report_filename)

    ReportGenerator.generate_pdf(
        file_path=report_file_path,
        machine_info=machine_info,
        reference_config={
            "firmware": ref.firmware,
            "plc_version": ref.plc_version,
            "cpu": ref.cpu,
            "ram": ref.ram,
            "storage": ref.storage,
            "communication_ports": ref.communication_ports,
            "installed_modules": ref.installed_modules,
            "sensor_count": ref.sensor_count
        },
        diagnostic_result=result.details,
        llm_analysis=ai_analysis,
        engineer_name=current_user.username
    )

    # 6. Save Report entry to database
    new_report = Report(
        diagnostic_result_id=result.id,
        title=req.title,
        file_path=f"/static/reports/{report_filename}",
        engineer_id=current_user.id,
        metadata_json=ai_analysis
    )
    db.add(new_report)

    # 7. Log generation event
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Report Generated",
        details=f"Generated PDF diagnostic report for {machine.machine_id}."
    )
    db.add(log)
    db.commit()
    db.refresh(new_report)

    return new_report

@router.get("", response_model=List[ReportOut])
def list_reports(
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = db.query(Report)
    if search:
        query = query.filter(Report.title.ilike(f"%{search}%"))
    return query.order_by(Report.generated_at.desc()).all()

@router.get("/{id}", response_model=ReportOut)
def get_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report record not found")
    return report

@router.put("/{id}", response_model=ReportOut)
def update_report_title(
    id: int,
    req: ReportUpdateTitle,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Supervisor"]))
):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report record not found")
    report.title = req.title
    db.commit()
    db.refresh(report)
    return report

@router.delete("/{id}")
def delete_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["Administrator", "Maintenance Engineer", "Supervisor"]))
):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report record not found")

    # Delete physical file from filesystem if it exists
    relative_path = report.file_path.lstrip("/")
    # Resolve relative to backend/
    full_path = os.path.join("backend", relative_path)
    if os.path.exists(full_path):
        try:
            os.remove(full_path)
        except Exception as e:
            print(f"Error removing physical PDF file {full_path}: {e}")

    db.delete(report)
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Admin Changes",
        details=f"Deleted PDF report ID {id} ({report.title})."
    )
    db.add(log)
    db.commit()

    return {"message": "Report deleted successfully"}

@router.get("/download/{id}")
def download_pdf_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report record not found")

    relative_path = report.file_path.lstrip("/")
    full_path = os.path.join("backend", relative_path)
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Physical PDF report file not found on disk.")

    # Log download event
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Report Downloaded",
        details=f"Downloaded report PDF file: {report.title}."
    )
    db.add(log)
    db.commit()

    return FileResponse(
        path=full_path,
        media_type="application/pdf",
        filename=os.path.basename(full_path)
    )
