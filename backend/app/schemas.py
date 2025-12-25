from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=64)
    invite_code: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Wechat Config Schemas
class WechatConfigBase(BaseModel):
    cookie: Optional[str] = None
    sess_id: Optional[str] = None
    major: Optional[str] = None
    minor: Optional[str] = None

class WechatConfigUpdate(WechatConfigBase):
    pass

class WechatConfigResponse(WechatConfigBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Task Schemas
class TaskBase(BaseModel):
    task_type: str
    cron_expression: Optional[str] = None
    config: Optional[Dict[str, Any]] = {}
    is_enabled: bool = True
    remark: Optional[str] = Field(None, max_length=500)
    
    @validator('cron_expression')
    def validate_cron(cls, v):
        if v is None:
            return v
        parts = str(v).split()
        if len(parts) != 5:
            raise ValueError('cron表达式必须为5段格式：m h d m w')
        try:
            m = int(parts[0]); h = int(parts[1])
            if not (0 <= m <= 59 and 0 <= h <= 23):
                raise ValueError('小时或分钟不合法')
        except ValueError:
            raise ValueError('小时或分钟必须为数字')
        return v
    
    @validator('config')
    def validate_config(cls, v, values):
        tt = values.get('task_type')
        if tt == 'reserve':
            strategy = None
            if isinstance(v, dict):
                strategy = v.get('strategy')
            if strategy == 'custom':
                if not isinstance(v, dict) or v.get('lib_id') is None or not v.get('seat_key'):
                    raise ValueError('自定义选座需要提供lib_id和seat_key')
        return v

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    task_type: Optional[str] = None
    cron_expression: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None
    remark: Optional[str] = Field(None, max_length=500)
    
    @validator('cron_expression')
    def validate_cron(cls, v):
        if v is None:
            return v
        parts = str(v).split()
        if len(parts) != 5:
            raise ValueError('cron表达式必须为5段格式：m h d m w')
        try:
            m = int(parts[0]); h = int(parts[1])
            if not (0 <= m <= 59 and 0 <= h <= 23):
                raise ValueError('小时或分钟不合法')
        except ValueError:
            raise ValueError('小时或分钟必须为数字')
        return v
    
    @validator('config')
    def validate_config(cls, v, values):
        tt = values.get('task_type')
        if v is None:
            return v
        if tt == 'reserve':
            strategy = None
            if isinstance(v, dict):
                strategy = v.get('strategy')
            if strategy == 'custom':
                if not isinstance(v, dict) or v.get('lib_id') is None or not v.get('seat_key'):
                    raise ValueError('自定义选座需要提供lib_id和seat_key')
        return v

class TaskResponse(TaskBase):
    id: int
    user_id: int
    last_run: Optional[datetime] = None
    last_status: Optional[str] = None
    last_message: Optional[str] = None
    next_run: Optional[datetime] = None

    class Config:
        from_attributes = True

# Invite Code
class InviteCodeCreate(BaseModel):
    code: str

class InviteCodeResponse(BaseModel):
    id: int
    code: str
    is_used: bool

    class Config:
        from_attributes = True

# Token
class Token(BaseModel):
    access_token: str
    token_type: str


# Bark配置Schemas
class BarkConfigBase(BaseModel):
    device_token: Optional[str] = None
    server_url: Optional[str] = "https://api.day.app"
    is_enabled: Optional[bool] = True
    subscriptions: Optional[list] = ["reserve", "signin", "task", "config"]


class BarkConfigUpdate(BaseModel):
    device_token: Optional[str] = None
    server_url: Optional[str] = None
    is_enabled: Optional[bool] = None
    subscriptions: Optional[list] = None


class BarkConfigResponse(BarkConfigBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Bark通知Schemas
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    notification_type: str
    title: str
    content: str
    icon: Optional[str] = None
    url: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
