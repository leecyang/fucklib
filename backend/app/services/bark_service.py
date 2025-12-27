"""
Bark推送服务模块
支持发送iOS推送通知到Bark应用
"""
import requests
import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger(__name__)

# 通知类型常量
class NotificationType:
    # 座位预约相关
    RESERVE_SUCCESS = "reserve_success"
    RESERVE_FAILED = "reserve_failed"
    RESERVE_OCCUPIED = "reserve_occupied"
    RESERVE_EXPIRING = "reserve_expiring"
    
    # 签到相关
    SIGNIN_SUCCESS = "signin_success"
    SIGNIN_FAILED = "signin_failed"
    SEAT_SUPERVISED = "seat_supervised"
    AUTO_SIGNIN_AFTER_SUPERVISED = "auto_signin_after_supervised"
    
    # 任务状态
    TASK_STARTED = "task_started"
    TASK_DISABLED = "task_disabled"
    TASK_ERROR = "task_error"
    
    # 配置相关
    COOKIE_INVALID = "cookie_invalid"
    BLUETOOTH_MISSING = "bluetooth_missing"
    SESSID_MISSING = "sessid_missing"
    
    # 系统提醒
    DAILY_SUMMARY = "daily_summary"
    ACCOUNT_RESTRICTED = "account_restricted"
    
    # 测试
    TEST = "test"


def get_notification_category(notification_type: str) -> str:
    """获取通知类型对应的分类（用于订阅过滤）"""
    if notification_type in [NotificationType.RESERVE_SUCCESS, NotificationType.RESERVE_FAILED, 
                              NotificationType.RESERVE_OCCUPIED, NotificationType.RESERVE_EXPIRING]:
        return "reserve"
    elif notification_type in [NotificationType.SIGNIN_SUCCESS, NotificationType.SIGNIN_FAILED,
                                NotificationType.SEAT_SUPERVISED, NotificationType.AUTO_SIGNIN_AFTER_SUPERVISED]:
        return "signin"
    elif notification_type in [NotificationType.TASK_STARTED, NotificationType.TASK_DISABLED, 
                                NotificationType.TASK_ERROR]:
        return "task"
    elif notification_type in [NotificationType.COOKIE_INVALID, NotificationType.BLUETOOTH_MISSING]:
        return "config"
    elif notification_type == NotificationType.DAILY_SUMMARY:
        return "summary"
    elif notification_type == NotificationType.ACCOUNT_RESTRICTED:
        return "config"
    else:
        return "other"


def send_notification(
    db: Session,
    user_id: int,
    notification_type: str,
    title: str,
    content: str,
    icon: Optional[str] = None,
    url: Optional[str] = None,
    force: bool = False
) -> bool:
    """
    发送Bark推送通知
    
    Args:
        db: 数据库会话
        user_id: 用户ID
        notification_type: 通知类型
        title: 通知标题
        content: 通知内容
        icon: 通知图标（emoji）
        url: 跳转链接
        force: 是否强制发送（忽略订阅设置）
    
    Returns:
        是否发送成功
    """
    try:
        # 1. 查询用户的Bark配置
        bark_config = db.query(models.BarkConfig).filter(
            models.BarkConfig.user_id == user_id
        ).first()
        
        if not bark_config:
            logger.info(f"用户 {user_id} 未配置Bark推送")
            return False
        
        if not bark_config.is_enabled and not force:
            logger.info(f"用户 {user_id} 已禁用Bark推送")
            return False
        
        # 2. 检查订阅设置
        if not force:
            category = get_notification_category(notification_type)
            subscriptions = bark_config.subscriptions or []
            if category not in subscriptions and "all" not in subscriptions:
                logger.info(f"用户 {user_id} 未订阅 {category} 类型的通知")
                return False
        
        # 3. 构建推送URL
        server_url = bark_config.server_url or "https://api.day.app"
        bark_key = bark_config.bark_key
        
        # URL编码标题和内容
        import urllib.parse
        encoded_title = urllib.parse.quote(title)
        encoded_content = urllib.parse.quote(content)
        
        push_url = f"{server_url}/{bark_key}/{encoded_title}/{encoded_content}"
        
        params = []
        params.append(f"icon={urllib.parse.quote('https://lingxilearn.cn/logo.jpg')}")
        
        if url:
            params.append(f"url={urllib.parse.quote(url)}")
        
        params.append(f"group={urllib.parse.quote('图书馆助手')}")
        
        if params:
            push_url += "?" + "&".join(params)
        
        # 4. 发送推送请求
        response = requests.get(push_url, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        success = result.get('code') == 200
        
        # 5. 记录通知历史
        notification = models.BarkNotification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            content=content,
            icon=icon,
            url=url,
            status="success" if success else "failed",
            error_message=None if success else str(result)
        )
        db.add(notification)
        db.commit()
        
        if success:
            logger.info(f"Bark推送发送成功: 用户 {user_id}, 类型 {notification_type}")
        else:
            logger.warning(f"Bark推送发送失败: 用户 {user_id}, 响应 {result}")
        
        return success
        
    except Exception as e:
        logger.error(f"发送Bark推送异常: 用户 {user_id}, 错误 {e}")
        
        # 记录失败的通知
        try:
            notification = models.BarkNotification(
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                content=content,
                icon=icon,
                url=url,
                status="failed",
                error_message=str(e)[:255]
            )
            db.add(notification)
            db.commit()
        except Exception as db_error:
            logger.error(f"记录通知历史失败: {db_error}")
        
        return False


def send_cookie_invalid_notification(db: Session, user_id: int) -> bool:
    """发送Cookie失效通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.COOKIE_INVALID,
        title="Cookie已失效",
        content="您的微信Cookie已失效或被限制，请重新扫码登录以恢复自动预约功能",
        icon=None,
        force=True  # Cookie失效是关键通知，强制发送
    )


def send_sessid_missing_notification(db: Session, user_id: int) -> bool:
    """发送SessID缺失通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.SESSID_MISSING,
        title="WeChat SessID 缺失",
        content="未绑定微信 SessID，请通过扫码绑定以启用蓝牙自动签到",
        icon=None,
        force=True
    )


def send_bluetooth_missing_notification(db: Session, user_id: int) -> bool:
    """发送蓝牙配置缺失通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.BLUETOOTH_MISSING,
        title="蓝牙配置缺失",
        content="蓝牙打卡配置未完整设置（major/minor），请在设置中补充以启用自动签到",
        icon=None,
        force=True
    )


def send_reserve_success_notification(db: Session, user_id: int, seat_info: dict) -> bool:
    """发送预约成功通知"""
    lib_name = seat_info.get('lib_name', '未知馆')
    floor = seat_info.get('lib_floor', '未知楼层')
    seat_name = seat_info.get('seat_name', seat_info.get('seat_key', '未知座位'))
    
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.RESERVE_SUCCESS,
        title="座位预约成功",
        content=f"已成功预约【{lib_name} - {floor}】的座位 {seat_name}",
        icon=None
    )


def send_reserve_failed_notification(db: Session, user_id: int, error_msg: str) -> bool:
    """发送预约失败通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.RESERVE_FAILED,
        title="座位预约失败",
        content=f"预约座位失败：{error_msg}，请检查配置或手动预约",
        icon=None
    )


def send_signin_success_notification(db: Session, user_id: int) -> bool:
    """发送签到成功通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.SIGNIN_SUCCESS,
        title="签到成功",
        content="已成功签到座位，祝您学习愉快！",
        icon=None
    )


def send_supervised_notification(db: Session, user_id: int) -> bool:
    """发送座位被监督举报通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.SEAT_SUPERVISED,
        title="座位被监督举报",
        content="您的座位已被监督举报，系统将在5分钟后自动蓝牙签到以解除警告",
        icon=None,
        force=True  # 监督举报是高优先级通知
    )


def send_expiration_notification(db: Session, user_id: int, minutes_left: int) -> bool:
    """发送预约即将过期通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.RESERVE_EXPIRING,
        title="预约即将过期",
        content=f"您的座位预约将在{int(minutes_left)}分钟后过期，请尽快签到！",
        icon=None,
        force=True  # 过期提醒是高优先级通知
    )

def send_account_restricted_notification(db: Session, user_id: int) -> bool:
    """发送账号被限制预约通知"""
    return send_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.ACCOUNT_RESTRICTED,
        title="账号被限制预约",
        content="系统检测到您的账号预约功能被限制。建议稍后重试或减少频繁访问，必要时重新授权。",
        icon=None,
        force=True
    )
