from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext
import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    # Check invite code
    invite = db.query(models.InviteCode).filter(models.InviteCode.code == user.invite_code).first()
    if not invite:
        raise ValueError("邀请码无效")
    if invite.is_used:
        raise ValueError("邀请码已被使用")
    
    hashed_password = get_password_hash(user.password)
    is_admin = False
    if invite.code == "ADMIN123":
        is_admin = True
        
    db_user = models.User(username=user.username, password_hash=hashed_password, invite_code_id=invite.id, is_admin=is_admin)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Update invite code
    invite.is_used = True
    invite.used_by_user_id = db_user.id
    invite.used_at = datetime.datetime.utcnow()
    db.commit()
    
    # Create empty WechatConfig
    db_config = models.WechatConfig(user_id=db_user.id)
    db.add(db_config)
    db.commit()
    
    return db_user

def get_wechat_config(db: Session, user_id: int):
    return db.query(models.WechatConfig).filter(models.WechatConfig.user_id == user_id).first()

def update_wechat_config(db: Session, user_id: int, config: schemas.WechatConfigUpdate):
    db_config = get_wechat_config(db, user_id)
    if not db_config:
        db_config = models.WechatConfig(user_id=user_id)
        db.add(db_config)
    
    if config.cookie:
        db_config.cookie = config.cookie
    if config.sess_id:
        db_config.sess_id = config.sess_id
    if config.major:
        db_config.major = config.major
    if config.minor:
        db_config.minor = config.minor
        
    db.commit()
    db.refresh(db_config)
    return db_config

def get_tasks(db: Session, user_id: int):
    return db.query(models.Task).filter(models.Task.user_id == user_id).all()

def create_or_update_task(db: Session, user_id: int, task_data: schemas.TaskCreate):
    task = db.query(models.Task).filter(models.Task.user_id == user_id, models.Task.task_type == task_data.task_type).first()
    if task:
        task.cron_expression = task_data.cron_expression
        task.config = task_data.config
        task.is_enabled = task_data.is_enabled
    else:
        task = models.Task(**task_data.dict(), user_id=user_id)
        db.add(task)
    
    db.commit()
    db.refresh(task)
    return task

def create_invite_code(db: Session, code: str):
    db_code = models.InviteCode(code=code)
    db.add(db_code)
    db.commit()
    db.refresh(db_code)
    return db_code
