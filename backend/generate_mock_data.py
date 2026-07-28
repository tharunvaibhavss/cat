import datetime
import random
from dotenv import load_dotenv
load_dotenv()

from app.database.connection import SessionLocal, engine, Base
from app.models.models import Machine, MachineHealthScore, FleetStatistic, WorkOrder

# Ensure tables are created
Base.metadata.create_all(bind=engine)

def generate_mock_data():
    db = SessionLocal()
    try:
        # Update existing machines with Phase 1 fields
        machines = db.query(Machine).all()
        print(f"Found {len(machines)} machines. Updating...")
        
        # If no machines exist, we should probably warn, but assuming standard DB setup has run.
        if not machines:
            print("No machines found. Please run your standard initialization script first.")
            return

        for m in machines:
            # Assign random health and utilization for visual variety
            m.health_score = random.randint(60, 100)
            m.utilization_percentage = round(random.uniform(50.0, 95.0), 1)
            # Ranking score can just be the health score for now
            m.ranking_score = float(m.health_score)
            
            # Generate 30 days of historical health scores
            today = datetime.datetime.utcnow()
            for i in range(30):
                past_date = today - datetime.timedelta(days=i)
                # Random walk for health score history
                hist_score = max(0, min(100, m.health_score + random.randint(-10, 10)))
                
                hs = MachineHealthScore(
                    machine_id=m.machine_id,
                    timestamp=past_date,
                    score=hist_score
                )
                db.add(hs)
                
        # Generate 30 days of Fleet Statistics
        print("Generating Fleet Statistics...")
        today = datetime.datetime.utcnow()
        for i in range(30):
            past_date = today - datetime.timedelta(days=i)
            # Check if exists
            exists = db.query(FleetStatistic).filter(
                FleetStatistic.date >= past_date.replace(hour=0, minute=0, second=0, microsecond=0),
                FleetStatistic.date < past_date.replace(hour=23, minute=59, second=59)
            ).first()
            
            if not exists:
                stat = FleetStatistic(
                    date=past_date,
                    total_downtime_hours=round(random.uniform(5.0, 50.0), 1),
                    average_fleet_health=round(random.uniform(80.0, 98.0), 1),
                    maintenance_cost=round(random.uniform(1000, 15000), 2),
                    fuel_consumption=round(random.uniform(500, 3000), 1)
                )
                db.add(stat)
                
        # Add a couple of sample work orders with predicted dates if they don't have them
        print("Updating Work Orders...")
        wos = db.query(WorkOrder).all()
        for wo in wos:
            if not wo.predicted_schedule_date:
                wo.predicted_schedule_date = today + datetime.timedelta(days=random.randint(1, 14))
                
        db.commit()
        print("Mock data generation complete!")
    except Exception as e:
        print(f"Error generating data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    generate_mock_data()
