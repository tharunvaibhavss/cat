from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database.connection import get_db
from app.models.models import Machine, FleetStatistic
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/overview")
def get_fleet_overview(db: Session = Depends(get_db)):
    """Returns high-level KPI metrics for the entire fleet."""
    # Get the latest Fleet Statistic
    latest_stat = db.query(FleetStatistic).order_by(FleetStatistic.date.desc()).first()
    
    total_machines = db.query(Machine).count()
    active_machines = db.query(Machine).filter(Machine.status == "Connected").count()
    
    return {
        "total_machines": total_machines,
        "active_machines": active_machines,
        "average_fleet_health": latest_stat.average_fleet_health if latest_stat else 100.0,
        "total_downtime_hours": latest_stat.total_downtime_hours if latest_stat else 0.0,
        "maintenance_cost": latest_stat.maintenance_cost if latest_stat else 0.0,
        "fuel_consumption": latest_stat.fuel_consumption if latest_stat else 0.0,
    }

@router.get("/distribution")
def get_fleet_health_distribution(db: Session = Depends(get_db)):
    """Returns count of machines grouped by health status (Healthy, Warning, Critical)"""
    machines = db.query(Machine).all()
    
    healthy = 0
    warning = 0
    critical = 0
    
    for m in machines:
        score = m.health_score or 100
        if score >= 80:
            healthy += 1
        elif score >= 60:
            warning += 1
        else:
            critical += 1
            
    return [
        {"name": "Healthy", "value": healthy, "color": "#10B981"}, # Emerald 500
        {"name": "Warning", "value": warning, "color": "#F59E0B"}, # Amber 500
        {"name": "Critical", "value": critical, "color": "#EF4444"}  # Red 500
    ]

@router.get("/ranking")
def get_fleet_ranking(db: Session = Depends(get_db)):
    """Returns top performing and bottom performing machines."""
    top_machines = db.query(Machine).order_by(Machine.health_score.desc()).limit(3).all()
    bottom_machines = db.query(Machine).order_by(Machine.health_score.asc()).limit(3).all()
    
    return {
        "top": [
            {
                "machine_id": m.machine_id,
                "name": m.name,
                "health_score": m.health_score,
                "utilization": m.utilization_percentage
            } for m in top_machines
        ],
        "bottom": [
            {
                "machine_id": m.machine_id,
                "name": m.name,
                "health_score": m.health_score,
                "utilization": m.utilization_percentage
            } for m in bottom_machines
        ]
    }

@router.get("/critical")
def get_critical_machines(db: Session = Depends(get_db)):
    """Returns machines needing immediate attention."""
    critical_machines = db.query(Machine).filter(Machine.health_score < 70).order_by(Machine.health_score.asc()).all()
    
    return [
        {
            "machine_id": m.machine_id,
            "name": m.name,
            "category": m.category,
            "health_score": m.health_score,
            "status": m.status,
            "risk_score": m.risk_score
        } for m in critical_machines
    ]
