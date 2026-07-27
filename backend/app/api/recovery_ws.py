from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from typing import List, Dict
import json
from jose import jwt, JWTError
import os

router = APIRouter(prefix="/ws", tags=["WebSocket Notifications"])

ALGORITHM = "HS256"

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of active WebSockets
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Maps user_id -> department name
        self.user_departments: Dict[int, str] = {}
        # Maps user_id -> is_department_admin
        self.user_admins: Dict[int, bool] = {}

    async def connect(self, websocket: WebSocket, user_id: int, department: str, is_admin: bool):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        self.user_departments[user_id] = department
        self.user_admins[user_id] = is_admin

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                self.user_departments.pop(user_id, None)
                self.user_admins.pop(user_id, None)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_department(self, department: str, message: dict, exclude_user_id: int = None):
        """Sends a message to all users in a specific department."""
        for user_id, websockets in list(self.active_connections.items()):
            if exclude_user_id and user_id == exclude_user_id:
                continue
            
            user_dept = self.user_departments.get(user_id)
            if user_dept == department:
                for ws in websockets:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        pass

manager = ConnectionManager()

@router.websocket("/notifications")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Authenticate token
    from app.database.connection import SessionLocal
    from app.models.models import User
    from app.utils.security import SECRET_KEY
    
    db = SessionLocal()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        employee_id: str = payload.get("employee_id")
        if employee_id is None:
            await websocket.close(code=4003)
            return
        
        user = db.query(User).filter(User.employee_id == employee_id).first()
        if user is None:
            await websocket.close(code=4003)
            return
            
        user_id = user.id
        department = user.department or "Unknown"
        is_admin = user.is_department_admin or False
        
    except Exception:
        await websocket.close(code=4003)
        return
    finally:
        db.close()

    await manager.connect(websocket, user_id, department, is_admin)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
