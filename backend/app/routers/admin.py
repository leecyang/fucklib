from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import secrets

from app import database, models, schemas, crud
from app.routers import auth

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

def get_current_admin(current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user

@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="不能删除管理员用户")
    
    db.delete(user)
    db.commit()
    return {"message": "用户已删除"}

@router.get("/invite-codes", response_model=List[schemas.InviteCodeResponse])
def get_invite_codes(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    codes = db.query(models.InviteCode).order_by(models.InviteCode.created_at.desc()).offset(skip).limit(limit).all()
    return codes

@router.post("/invite-codes", response_model=schemas.InviteCodeResponse)
def generate_invite_code(db: Session = Depends(database.get_db), admin: models.User = Depends(get_current_admin)):
    code_str = secrets.token_hex(4).upper() # 8 chars
    db_code = models.InviteCode(code=code_str)
    db.add(db_code)
    db.commit()
    db.refresh(db_code)
    return db_code
