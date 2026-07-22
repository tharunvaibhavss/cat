from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database.connection import get_db
from backend.app.models.models import User, ActivityLog
from backend.app.schemas.schemas import LoginRequest, Token, UserOut
from backend.app.utils.security import verify_password, create_access_token
from backend.app.api.deps import get_current_user
import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == request.employee_id).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect Employee ID or Password"
        )
    
    # Generate token
    token_data = {"employee_id": user.employee_id, "role": user.role}
    access_token = create_access_token(data=token_data)
    
    # Log login activity
    log = ActivityLog(
        employee_id=user.employee_id,
        action="Login",
        details=f"Successful authentication for employee {user.employee_id} ({user.username})."
    )
    db.add(log)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "employee_id": user.employee_id,
        "username": user.username
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = ActivityLog(
        employee_id=current_user.employee_id,
        action="Logout",
        details=f"Employee {current_user.employee_id} logged out."
    )
    db.add(log)
    db.commit()
    return {"message": "Successfully logged out"}

@router.get("/profile", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user
