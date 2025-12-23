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
    remark: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    task_type: Optional[str] = None
    cron_expression: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_enabled: Optional[bool] = None
    remark: Optional[str] = None

class TaskResponse(TaskBase):
    id: int
    user_id: int
    last_run: Optional[datetime] = None
    last_status: Optional[str] = None
    last_message: Optional[str] = None

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
