import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.database.connection import engine, Base
from backend.app.api import (
    auth, users, machines, diagnostic, llm, reports, dashboard, alerts,
    manual_inspections, work_orders, vision, sites, digital_twin, predictive, edge, telemetry
)
from backend.app.sample_data.seed import seed_database
from backend.app.database.connection import SessionLocal
from backend.app.models.models import User

app = FastAPI(
    title="Heavy Industrial Machine Monitoring Platform API",
    description="Enterprise API supporting hybrid data collection, AI diagnostics, computer vision, digital twin, and predictive maintenance.",
    version="2.0.0"
)

# CORS Policy configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static directory to serve generated PDF reports
os.makedirs("backend/static/reports", exist_ok=True)
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

# Startup database initialization and seeding
@app.on_event("startup")
def startup_event():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Auto-seed if database is empty
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            print("Database is empty. Running auto-seeding...")
            seed_database()
        else:
            print("Database already initialized with records.")
    except Exception as e:
        print(f"Error on startup database check: {e}")
    finally:
        db.close()

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(machines.router, prefix="/api")
app.include_router(diagnostic.router, prefix="/api")
app.include_router(llm.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")

# Core Feature & Telemetry Ingestion Routers
app.include_router(manual_inspections.router, prefix="/api")
app.include_router(work_orders.router, prefix="/api")
app.include_router(vision.router, prefix="/api")
app.include_router(sites.router, prefix="/api")
app.include_router(digital_twin.router, prefix="/api")
app.include_router(predictive.router, prefix="/api")
app.include_router(edge.router, prefix="/api")
app.include_router(telemetry.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "system": "Heavy Industrial Machine Monitoring Platform API",
        "documentation": "/docs"
    }
