from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_admin = Column(Boolean, default=False)
    
    # WeChat Configuration
    wechat_config = relationship("WechatConfig", uselist=False, back_populates="user", cascade="all, delete-orphan")
    
    # Tasks
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    
    # Invite Code used to register
    invite_code_id = Column(Integer, ForeignKey("invite_codes.id"), nullable=True)


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    used_at = Column(DateTime(timezone=True), nullable=True)
    
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class WechatConfig(Base):
    __tablename__ = "wechat_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Auth
    cookie = Column(String(5000), nullable=True)  # Store full cookie string
    sess_id = Column(String(255), nullable=True)  # wechatSESS_ID
    
    # Bluetooth Sign-in
    major = Column(String(50), nullable=True)
    minor = Column(String(50), nullable=True)
    
    user = relationship("User", back_populates="wechat_config")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    task_type = Column(String(50), nullable=False)  # 'seat', 'signin', 'check', 'hold', 'withdraw'
    cron_expression = Column(String(100), nullable=True) # e.g., "0 8 * * *"
    
    # Configuration for the task (e.g., floor, seat_key, delay)
    config = Column(JSON, nullable=True)
    
    is_enabled = Column(Boolean, default=True)
    last_run = Column(DateTime(timezone=True), nullable=True)
    last_status = Column(String(50), nullable=True) # 'success', 'failed'
    last_message = Column(String(500), nullable=True)
    remark = Column(String(500), nullable=True)
    
    user = relationship("User", back_populates="tasks")
