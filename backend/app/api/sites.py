from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from backend.app.database.connection import get_db
from backend.app.models.models import Site, Machine, DiagnosticResult, User
from backend.app.schemas.schemas import SiteOut
from backend.app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/sites", tags=["Multi-Site Fleet Management"])

class SiteCreate(BaseModel):
    site_id: str
    name: str
    location: str
    region: str

@router.get("", response_model=List[SiteOut])
def list_sites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sites = db.query(Site).all()
    # Update machine counts dynamically
    for site in sites:
        count = db.query(Machine).filter(Machine.site_id == site.site_id).count()
        site.machine_count = count
    db.commit()
    return sites

@router.post("", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
def create_site(
    req: SiteCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(["Administrator"]))
):
    existing = db.query(Site).filter(Site.site_id == req.site_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Site ID already exists.")
    site = Site(
        site_id=req.site_id,
        name=req.name,
        location=req.location,
        region=req.region,
        machine_count=0
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return site

@router.get("/{site_id}/analytics")
def get_site_analytics(
    site_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    site = db.query(Site).filter(Site.site_id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    machines = db.query(Machine).filter(Machine.site_id == site_id).all()
    machine_ids = [m.machine_id for m in machines]
    
    healthy = 0
    warning = 0
    faulty = 0

    for m in machines:
        latest_diag = db.query(DiagnosticResult).filter(DiagnosticResult.machine_id == m.machine_id).order_by(DiagnosticResult.timestamp.desc()).first()
        if latest_diag:
            if latest_diag.status == "Healthy":
                healthy += 1
            elif latest_diag.status == "Warning":
                warning += 1
            else:
                faulty += 1
        else:
            healthy += 1

    return {
        "site_id": site.site_id,
        "name": site.name,
        "location": site.location,
        "region": site.region,
        "total_machines": len(machines),
        "health_summary": {
            "healthy": healthy,
            "warning": warning,
            "faulty": faulty
        },
        "machines": [
            {
                "machine_id": m.machine_id,
                "name": m.name,
                "model": m.model,
                "status": m.status,
                "operating_hours": m.operating_hours,
                "rul_hours": m.rul_hours
            } for m in machines
        ]
    }
