from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List
import datetime
from backend.app.database.connection import get_db
from backend.app.models.models import Machine, DiagnosticResult, Report, ActivityLog, User
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Total Machines
    total_machines = db.query(Machine).count()

    # 2. Machines by Status (Connected, Disconnected)
    connected_machines = db.query(Machine).filter(Machine.status == "Connected").count()
    disconnected_machines = db.query(Machine).filter(Machine.status == "Disconnected").count()
    waiting_machines = db.query(Machine).filter(Machine.status == "Waiting").count()
    failed_machines = db.query(Machine).filter(Machine.status == "Connection Failed").count()

    # We determine healthy/faulty from the latest diagnostic results of connected machines
    latest_results = {}
    all_results = db.query(DiagnosticResult).order_by(DiagnosticResult.timestamp.asc()).all()
    for r in all_results:
        latest_results[r.machine_id] = r.status

    healthy_count = sum(1 for m_id, status in latest_results.items() if status == "Healthy")
    warning_count = sum(1 for m_id, status in latest_results.items() if status == "Warning")
    fault_count = sum(1 for m_id, status in latest_results.items() if status == "Fault")

    # 3. Today's Diagnostics Count
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    todays_diags = db.query(DiagnosticResult).filter(DiagnosticResult.timestamp >= today_start).count()

    # 4. Total Reports Generated
    total_reports = db.query(Report).count()

    # 5. Critical Alerts
    # A critical alert is any diagnostic result with status 'Fault' in the last 7 days
    seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    critical_alerts = db.query(DiagnosticResult).filter(
        DiagnosticResult.status == "Fault",
        DiagnosticResult.timestamp >= seven_days_ago
    ).count()

    # 6. Charts: Machine Health Distribution
    health_distribution = [
        {"name": "Healthy", "value": healthy_count},
        {"name": "Warning", "value": warning_count},
        {"name": "Fault/Critical", "value": fault_count}
    ]

    # 7. Charts: Diagnostic Trend (Last 7 Days)
    diagnostic_trend = []
    for i in range(6, -1, -1):
        date = (datetime.datetime.utcnow() - datetime.timedelta(days=i)).date()
        date_start = datetime.datetime.combine(date, datetime.time.min)
        date_end = datetime.datetime.combine(date, datetime.time.max)
        count = db.query(DiagnosticResult).filter(
            DiagnosticResult.timestamp >= date_start,
            DiagnosticResult.timestamp <= date_end
        ).count()
        diagnostic_trend.append({
            "date": date.strftime("%b %d"),
            "diagnostics": count
        })

    # 8. Charts: Monthly Reports
    # For simulation, we group the last 6 months
    monthly_reports = []
    for i in range(5, -1, -1):
        # Approximate months
        first_day_of_current_month = datetime.date.today().replace(day=1)
        # Shift back by i months
        # Note: simple shift works for last 6 months
        target_month = first_day_of_current_month - datetime.timedelta(days=i*30)
        target_month_start = datetime.datetime(target_month.year, target_month.month, 1)
        
        # Next month start
        if target_month.month == 12:
            next_month_start = datetime.datetime(target_month.year + 1, 1, 1)
        else:
            next_month_start = datetime.datetime(target_month.year, target_month.month + 1, 1)

        count = db.query(Report).filter(
            Report.generated_at >= target_month_start,
            Report.generated_at < next_month_start
        ).count()

        monthly_reports.append({
            "month": target_month.strftime("%B"),
            "reports": count
        })

    # 9. Charts: Machine Category Analysis
    # Get breakdown of all machines by category
    categories_data = db.query(Machine.category, func.count(Machine.id)).group_by(Machine.category).all()
    category_analysis = [{"category": cat, "count": count} for cat, count in categories_data]

    # 10. Activity Timeline (last 15 logs)
    timeline_logs = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc()).limit(15).all()
    timeline = []
    for log in timeline_logs:
        timeline.append({
            "id": log.id,
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "employee_id": log.employee_id,
            "action": log.action,
            "details": log.details
        })

    # 11. Recent Diagnostics Table (last 5 runs)
    recent_runs = db.query(DiagnosticResult).order_by(DiagnosticResult.timestamp.desc()).limit(5).all()
    recent_diagnostics = []
    for run in recent_runs:
        # fetch machine name
        m = db.query(Machine).filter(Machine.machine_id == run.machine_id).first()
        recent_diagnostics.append({
            "id": run.id,
            "machine_id": run.machine_id,
            "machine_name": m.name if m else "Unknown",
            "timestamp": run.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "status": run.status,
            "health_score": run.health_score
        })

    # 12. Recent Reports (last 5 reports)
    recent_reps = db.query(Report).order_by(Report.generated_at.desc()).limit(5).all()
    recent_reports = []
    for rep in recent_reps:
        recent_reports.append({
            "id": rep.id,
            "title": rep.title,
            "generated_at": rep.generated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "file_path": rep.file_path
        })

    return {
        "summary": {
            "total_machines": total_machines,
            "connected_machines": connected_machines,
            "disconnected_machines": disconnected_machines,
            "waiting_machines": waiting_machines,
            "failed_machines": failed_machines,
            "healthy_machines": healthy_count,
            "warning_machines": warning_count,
            "faulty_machines": fault_count,
            "todays_diagnostics": todays_diags,
            "reports_generated": total_reports,
            "critical_alerts": critical_alerts
        },
        "charts": {
            "health_distribution": health_distribution,
            "diagnostic_trend": diagnostic_trend,
            "monthly_reports": monthly_reports,
            "category_analysis": category_analysis
        },
        "recent_diagnostics": recent_diagnostics,
        "recent_reports": recent_reports,
        "timeline": timeline
    }
