from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database.connection import get_db
from backend.app.models.models import User, ActivityLog
from backend.app.schemas.schemas import UserOut, UserCreate, UserUpdate
from backend.app.api.deps import get_current_user, require_role
from backend.app.utils.security import get_password_hash

router = APIRouter(prefix="/users", tags=["Users Management"])

# All routes here require Administrator role
admin_dependency = Depends(require_role(["Administrator"]))

@router.get("", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: User = admin_dependency
):
    return db.query(User).all()

@router.get("/supervisors", response_model=List[UserOut])
def list_supervisors_public(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(User).filter(User.role == "Supervisor").all()

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = admin_dependency
):
    # Check if user already exists
    existing = db.query(User).filter(User.employee_id == user_in.employee_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User with Employee ID {user_in.employee_id} already exists."
        )
    
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        employee_id=user_in.employee_id,
        username=user_in.username,
        role=user_in.role,
        password_hash=hashed_pwd,
        email=user_in.email
    )
    db.add(new_user)
    
    # Log admin action
    log = ActivityLog(
        employee_id=admin.employee_id,
        action="Admin Changes",
        details=f"Created user {new_user.employee_id} ({new_user.username}) with role {new_user.role}."
    )
    db.add(log)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{id}", response_model=UserOut)
def update_user(
    id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = admin_dependency
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user_in.username is not None:
        user.username = user_in.username
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.email is not None:
        user.email = user_in.email
    if user_in.password is not None and user_in.password.strip() != "":
        user.password_hash = get_password_hash(user_in.password)
        
    # Log admin action
    log = ActivityLog(
        employee_id=admin.employee_id,
        action="Admin Changes",
        details=f"Updated user ID {id} ({user.employee_id})."
    )
    db.add(log)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{id}")
def delete_user(
    id: int,
    db: Session = Depends(get_db),
    admin: User = admin_dependency
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.employee_id == admin.employee_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account.")
        
    db.delete(user)
    
    # Log admin action
    log = ActivityLog(
        employee_id=admin.employee_id,
        action="Admin Changes",
        details=f"Deleted user account {user.employee_id} ({user.username})."
    )
    db.add(log)
    db.commit()
    return {"message": "User deleted successfully"}

@router.put("/me/email", response_model=UserOut)
def update_my_email(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_in.email is None:
        raise HTTPException(status_code=400, detail="Email is required.")
        
    current_user.email = user_in.email
    db.commit()
    db.refresh(current_user)
    return current_user
