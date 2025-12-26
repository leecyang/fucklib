"""
Bark推送配置和通知相关API路由
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List
import logging
from datetime import datetime, timedelta

from app import models, schemas, database
from app.routers.auth import get_current_user
from app.services import bark_service
from app.services.lib_service import LibService
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bark", tags=["bark"])


@router.get("/config", response_model=schemas.BarkConfigResponse)
def get_bark_config(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """获取当前用户的Bark配置"""
    bark_config = db.query(models.BarkConfig).filter(
        models.BarkConfig.user_id == current_user.id
    ).first()
    
    if not bark_config:
        raise HTTPException(status_code=404, detail="未找到Bark配置，请先配置Device Token")
    
    return bark_config


@router.put("/config", response_model=schemas.BarkConfigResponse)
def update_bark_config(
    config_update: schemas.BarkConfigUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """更新或创建Bark配置"""
    bark_config = db.query(models.BarkConfig).filter(
        models.BarkConfig.user_id == current_user.id
    ).first()
    
    if not bark_config:
        # 创建新配置
        if not config_update.bark_key:
            raise HTTPException(status_code=400, detail="首次配置必须提供Bark Key")
        
        bark_config = models.BarkConfig(
            user_id=current_user.id,
            bark_key=config_update.bark_key,
            server_url=config_update.server_url or "https://api.day.app",
            is_enabled=config_update.is_enabled if config_update.is_enabled is not None else True,
            subscriptions=config_update.subscriptions or ["reserve", "signin", "task", "config"]
        )
        db.add(bark_config)
    else:
        # 更新现有配置
        if config_update.bark_key is not None:
            bark_config.bark_key = config_update.bark_key
        if config_update.server_url is not None:
            bark_config.server_url = config_update.server_url
        if config_update.is_enabled is not None:
            bark_config.is_enabled = config_update.is_enabled
        if config_update.subscriptions is not None:
            bark_config.subscriptions = config_update.subscriptions
    
    db.commit()
    db.refresh(bark_config)
    
    return bark_config


@router.post("/test")
def test_bark_push(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """发送测试推送"""
    success = bark_service.send_notification(
        db=db,
        user_id=current_user.id,
        notification_type=bark_service.NotificationType.TEST,
        title="🧪 Bark推送测试",
        content="恭喜！您的Bark推送配置成功，现在可以接收实时通知了！",
        icon="✨",
        force=True
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="推送发送失败，请检查Device Token和网络连接")
    
    return {"success": True, "message": "测试推送已发送"}


@router.get("/notifications", response_model=dict)
def get_notifications(
    page: int = 1,
    limit: int = 20,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """获取通知历史记录"""
    offset = (page - 1) * limit
    
    # 查询总数
    total = db.query(models.BarkNotification).filter(
        models.BarkNotification.user_id == current_user.id
    ).count()
    
    # 查询分页数据
    notifications = db.query(models.BarkNotification).filter(
        models.BarkNotification.user_id == current_user.id
    ).order_by(models.BarkNotification.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [schemas.NotificationResponse.from_orm(n) for n in notifications]
    }


# ========== 外部Cron调用接口（用于cron-job.org等外部定时任务服务） ==========

@router.post("/cron/seat-monitor")
def cron_seat_monitor(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(database.get_db)
):
    """
    座位状态监控任务（外部Cron调用）
    
    建议配置：每3分钟执行一次
    Cron表达式: */3 * * * *
    
    需要在请求头中提供Authorization令牌用于身份验证
    """
    # 简单的令牌验证（生产环境应使用更安全的方式）
    # 这里可以从环境变量读取预设的CRON_SECRET
    import os
    expected_token = os.getenv("CRON_SECRET", "please_set_cron_secret_in_env")
    
    if not authorization or authorization != f"Bearer {expected_token}":
        raise HTTPException(status_code=401, detail="未授权的Cron调用")
    
    try:
        results = _run_seat_monitor_task(db)
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "results": results
        }
    except Exception as e:
        logger.error(f"座位监控任务执行失败: {e}")
        raise HTTPException(status_code=500, detail=f"任务执行失败: {str(e)}")


# ========== 内部辅助函数 ==========

def _run_seat_monitor_task(db: Session) -> dict:
    """执行座位状态监控任务"""
    results = {
        "checked_users": 0,
        "notifications_sent": 0,
        "errors": []
    }
    
    # 获取所有启用Bark推送的用户
    users = db.query(models.User).join(
        models.BarkConfig, models.User.id == models.BarkConfig.user_id
    ).filter(
        models.BarkConfig.is_enabled == True
    ).all()
    
    # 首先检查并执行所有到期的延迟签到任务
    delayed_signins = db.query(models.SeatStatusCache).filter(
        models.SeatStatusCache.delayed_signin_at != None,
        models.SeatStatusCache.delayed_signin_at <= datetime.now()
    ).all()
    
    for cache in delayed_signins:
        try:
            logger.info(f"执行用户 {cache.user_id} 的延迟签到任务")
            result = _execute_delayed_signin(db, cache.user_id)
            results["notifications_sent"] += 1
            # 清除延迟签到标记
            cache.delayed_signin_at = None
            cache.supervised_notified = False
            db.commit()
            logger.info(f"用户 {cache.user_id} 延迟签到成功: {result}")
        except Exception as signin_error:
            logger.error(f"用户 {cache.user_id} 延迟签到失败: {signin_error}")
            # 清除标记，避免重复尝试
            cache.delayed_signin_at = None
            db.commit()
    
    # 然后执行常规的座位状态监控
    for user in users:
        try:
            if not user.wechat_config or not user.wechat_config.cookie:
                continue
            
            results["checked_users"] += 1
            
            # 获取用户当前座位信息
            def save_cookie(new_cookie):
                user.wechat_config.cookie = new_cookie
                db.commit()
            
            service = LibService(user.wechat_config.cookie, save_cookie)
            
            try:
                reserve_info = service.get_reserve_info()
            except Exception as e:
                error_msg = str(e).lower()
                
                # 检测Cookie失效
                if '40001' in error_msg or 'cookie失效' in error_msg or '403' in error_msg:
                    cache = db.query(models.SeatStatusCache).filter_by(user_id=user.id).first()
                    if not cache:
                        cache = models.SeatStatusCache(user_id=user.id)
                        db.add(cache)
                    
                    # 只发送一次Cookie失效通知
                    if not cache.cookie_invalid_notified:
                        if bark_service.send_cookie_invalid_notification(db, user.id):
                            results["notifications_sent"] += 1
                            cache.cookie_invalid_notified = True
                            db.commit()
                
                continue
            
            # 获取或创建状态缓存
            cache = db.query(models.SeatStatusCache).filter_by(user_id=user.id).first()
            if not cache:
                cache = models.SeatStatusCache(user_id=user.id)
                db.add(cache)
            
            if not reserve_info:
                # 用户当前无座位，重置通知标志
                cache.supervised_notified = False
                cache.expiration_notified = False
                cache.cookie_invalid_notified = False
                cache.last_status = None
                db.commit()
                continue
            
            # Cookie有效，重置Cookie失效通知标志
            cache.cookie_invalid_notified = False
            
            current_status = reserve_info.get('status')
            current_exp_date = reserve_info.get('exp_date')
            
            # 检测监督举报（status变为5）
            if current_status == 5 and cache.last_status != 5:
                if not cache.supervised_notified:
                    if bark_service.send_supervised_notification(db, user.id):
                        results["notifications_sent"] += 1
                        cache.supervised_notified = True
                    
                    # 设置5分钟后的延迟签到时间
                    cache.delayed_signin_at = datetime.now() + timedelta(minutes=5)
                    logger.info(f"用户 {user.id} 座位被监督，计划在 {cache.delayed_signin_at} 执行自动签到")
            
            # 检测预约即将过期（距离过期8-12分钟）
            if current_exp_date:
                try:
                    # 解析过期时间
                    if isinstance(current_exp_date, str) and current_exp_date.isdigit():
                        exp_datetime = datetime.fromtimestamp(int(current_exp_date))
                    elif isinstance(current_exp_date, (int, float)):
                        exp_datetime = datetime.fromtimestamp(current_exp_date)
                    else:
                        exp_datetime = datetime.fromisoformat(str(current_exp_date))
                    
                    time_left_seconds = (exp_datetime - datetime.now()).total_seconds()
                    time_left_minutes = time_left_seconds / 60
                    
                    # 在8-12分钟窗口内提醒
                    if 8 <= time_left_minutes <= 12 and not cache.expiration_notified:
                        if bark_service.send_expiration_notification(db, user.id, time_left_minutes):
                            results["notifications_sent"] += 1
                            cache.expiration_notified = True
                    
                    # 时间充足，重置过期通知标志
                    if time_left_minutes > 15:
                        cache.expiration_notified = False
                        
                except Exception as exp_error:
                    logger.warning(f"解析过期时间失败: {exp_error}")
            
            # 更新缓存
            cache.last_status = current_status
            cache.last_exp_date = str(current_exp_date) if current_exp_date else None
            cache.updated_at = datetime.now()
            db.commit()
            
        except Exception as user_error:
            error_info = f"用户{user.id}: {str(user_error)}"
            results["errors"].append(error_info)
            logger.error(f"监控用户{user.id}时发生错误: {user_error}")
    
    logger.info(f"座位监控任务完成: {results}")
    return results


def _execute_delayed_signin(db: Session, user_id: int) -> str:
    """执行延迟签到"""
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user or not user.wechat_config:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    if not (user.wechat_config.sess_id and user.wechat_config.major and user.wechat_config.minor):
        raise HTTPException(status_code=400, detail="用户未配置蓝牙参数")
    
    # 执行蓝牙签到
    result = AuthService.sign_in(
        user.wechat_config.sess_id,
        user.wechat_config.major,
        user.wechat_config.minor
    )
    
    # 发送签到结果通知
    bark_service.send_notification(
        db=db,
        user_id=user.id,
        notification_type=bark_service.NotificationType.AUTO_SIGNIN_AFTER_SUPERVISED,
        title="🤖 自动签到完成",
        content=f"检测到座位被监督举报，已自动执行蓝牙签到。结果：{result}",
        icon="✅"
    )
    
    # 重置监督通知标志
    cache = db.query(models.SeatStatusCache).filter_by(user_id=user.id).first()
    if cache:
        cache.supervised_notified = False
        db.commit()
    
    return result
