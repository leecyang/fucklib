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


class BarkConfig(Base):
    """Bark推送配置表"""
    __tablename__ = "bark_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Bark配置
    device_token = Column(String(255), nullable=False)  # Bark设备令牌
    server_url = Column(String(255), default="https://api.day.app")  # 自定义服务器
    is_enabled = Column(Boolean, default=True)  # 是否启用推送
    
    # 订阅配置（JSON数组，如["reserve", "signin", "task", "config"]）
    subscriptions = Column(JSON, default=["reserve", "signin", "task", "config"])
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BarkNotification(Base):
    """Bark通知历史记录表"""
    __tablename__ = "bark_notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 通知内容
    notification_type = Column(String(50), nullable=False)  # 通知类型，如"reserve_success"
    title = Column(String(255), nullable=False)  # 通知标题
    content = Column(String(500), nullable=False)  # 通知内容
    icon = Column(String(50), nullable=True)  # 通知图标
    url = Column(String(500), nullable=True)  # 跳转链接
    
    # 发送状态
    status = Column(String(20), default="pending")  # pending/success/failed
    error_message = Column(String(255), nullable=True)  # 错误信息
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SeatStatusCache(Base):
    """座位状态缓存表，用于监控任务"""
    __tablename__ = "seat_status_cache"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # 状态记录
    last_status = Column(Integer, nullable=True)  # 上次检测的座位状态 1-5
    last_exp_date = Column(String(50), nullable=True)  # 上次检测的过期时间
    
    # 通知标志（避免重复通知）
    supervised_notified = Column(Boolean, default=False)  # 是否已发送监督举报通知
    expiration_notified = Column(Boolean, default=False)  # 是否已发送过期提醒
    cookie_invalid_notified = Column(Boolean, default=False)  # 是否已发送Cookie失效通知
    
    # 延迟签到（用于监督举报后的自动签到）
    delayed_signin_at = Column(DateTime(timezone=True), nullable=True)  # 计划执行延迟签到的时间
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
