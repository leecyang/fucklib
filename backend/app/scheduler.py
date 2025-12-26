from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from app import crud, models, database, schemas
from app.services.lib_service import LibService
from app.services.auth_service import AuthService
from app.services import bark_service
import logging
from datetime import datetime
from sqlalchemy.sql import func

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone='Asia/Shanghai')

def compute_next_run(task: models.Task):
    try:
        if not task or not task.cron_expression:
            return None
        tz = getattr(scheduler, 'timezone', None)
        now = datetime.now(tz) if tz else datetime.now()
        trigger = CronTrigger.from_crontab(task.cron_expression, timezone=tz) if tz else CronTrigger.from_crontab(task.cron_expression)
        return trigger.get_next_fire_time(None, now)
    except Exception:
        return None

def run_seat_task(user_id: int, task_id: int):
    db = database.SessionLocal()
    task = None
    try:
        user = crud.get_user(db, user_id)
        task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if not user or not user.wechat_config or not user.wechat_config.cookie:
            logger.error(f"User {user_id} not ready for seat task")
            if task:
                task.last_status = 'failed'
                task.last_message = '用户未绑定微信 Cookie'
            return

        def save_cookie(new_cookie):
            try:
                if user.wechat_config:
                    user.wechat_config.cookie = new_cookie
                    db.add(user.wechat_config)
                    db.commit()
            except Exception as e:
                logger.error(f"Scheduler failed to save cookie: {e}")

        service = LibService(user.wechat_config.cookie, save_cookie)
        
        # Skip if user already has a seat today
        try:
            reserve = service.get_reserve_info()
            if reserve:
                task.last_status = 'skipped'
                task.last_message = '用户当前已有预约，跳过任务'
                return
            else:
                logger.info("No current reserve info, continue seat task.")
        except Exception as e:
            logger.warning(f"Check current reserve failed: {e}")

        # Strategy: Custom or Default
        strategy = task.config.get('strategy', 'custom') # 'custom' or 'default_all'
        
        target_seats = []
        if strategy == 'default_all':
            # Fetch all default seats
            try:
                often_seats = service.get_seat_info()
                target_seats = [{'lib_id': s['lib_id'], 'seat_key': s['seat_key']} for s in often_seats]
            except Exception as e:
                logger.error(f"Failed to fetch default seats: {e}")
                if task:
                     task.last_message = f"获取预选座位失败: {str(e)}"
        else:
            # Custom
            target_seats.append({
                'lib_id': task.config.get('lib_id'),
                'seat_key': task.config.get('seat_key')
            })

        if not target_seats:
             raise Exception("没有可用的目标座位")

        last_error = None
        success = False
        attempt = 0
        
        for seat in target_seats:
            try:
                if attempt % 2 == 0:
                    try:
                        service.refresh_page()
                    except Exception:
                        pass
                if task.task_type == 'reserve':
                    service.reserve_seat(seat['lib_id'], seat['seat_key'])
                success = True
                break # Stop if success
            except Exception as e:
                msg = str(e).lower()
                last_error = e
                if '40001' in msg or '403' in msg or 'cookie失效或账号被临时限制' in msg:
                    raise e
                continue
            finally:
                attempt += 1
        
        if success:
            task.last_status = 'success'
            task.last_message = '执行成功'
            # 发送预约成功通知
            try:
                reserve_info = service.get_reserve_info()
                if reserve_info:
                    bark_service.send_reserve_success_notification(db, user_id, reserve_info)
            except Exception as notify_error:
                logger.error(f"发送预约成功通知失败: {notify_error}")
        else:
            # If all seats were occupied or attempts failed
            if last_error:
                raise last_error
            task.last_status = 'skipped'
            task.last_message = '目标座位今日已被占用或无可用座位，跳过任务'

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        error_msg = str(e)
        
        if task:
            task.last_status = 'failed'
            task.last_message = error_msg
            
            #检测Cookie失效并发送通知
            if '40001' in error_msg.lower() or 'cookie失效' in error_msg.lower() or '403' in error_msg:
                try:
                    bark_service.send_cookie_invalid_notification(db, user_id)
                except Exception as notify_error:
                    logger.error(f"发送Cookie失效通知失败: {notify_error}")
            else:
                # 发送预约失败通知（非Cookie问题）
                try:
                    bark_service.send_reserve_failed_notification(db, user_id, error_msg)
                except Exception as notify_error:
                    logger.error(f"发送预约失败通知失败: {notify_error}")
                    
    finally:
        if task:
            task.last_run = func.now()
            db.commit()
        db.close()

def run_signin_task(user_id: int, task_id: int):
    db = database.SessionLocal()
    task = None
    try:
        user = crud.get_user(db, user_id)
        task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if not user or not user.wechat_config or not user.wechat_config.sess_id:
             logger.error(f"User {user_id} not ready for signin task")
             if task:
                task.last_status = 'failed'
                task.last_message = '用户未绑定微信 SessID'
             return

        try:
            if user.wechat_config.cookie:
                def save_cookie(new_cookie):
                    try:
                        if user.wechat_config:
                            user.wechat_config.cookie = new_cookie
                            db.add(user.wechat_config)
                            db.commit()
                    except Exception as e:
                        logger.error(f"Scheduler failed to save cookie: {e}")
                LibService(user.wechat_config.cookie, save_cookie).refresh_page()
        except Exception:
            pass

        res = AuthService.sign_in(user.wechat_config.sess_id, user.wechat_config.major, user.wechat_config.minor)
        task.last_status = 'success'
        task.last_message = res
        # 发送签到成功通知
        try:
            bark_service.send_signin_success_notification(db, user_id)
        except Exception as notify_error:
            logger.error(f"发送签到成功通知失败: {notify_error}")
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        if task:
            task.last_status = 'failed'
            task.last_message = str(e)
            # 发送签到失败通知
            try:
                bark_service.send_notification(
                    db=db,
                    user_id=user_id,
                    notification_type=bark_service.NotificationType.SIGNIN_FAILED,
                    title="❌ 签到失败",
                    content=f"签到失败：{str(e)}，请检查蓝牙配置或手动操作",
                    icon="🔴"
                )
            except Exception as notify_error:
                logger.error(f"发送签到失败通知失败: {notify_error}")
    finally:
        if task:
            task.last_run = func.now()
            db.commit()
        db.close()

def add_task_job(task: models.Task):
    job_id = str(task.id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        
    if not task.is_enabled or not task.cron_expression:
        return

    func = None
    if task.task_type == 'reserve':
        func = run_seat_task
    elif task.task_type == 'signin':
        func = run_signin_task
        
    if func:
        try:
            # Simple Cron parsing: Assume 5 parts "m h d m w"
            # APScheduler CronTrigger format
            tz = getattr(scheduler, 'timezone', None)
            now = datetime.now(tz) if tz else datetime.now()
            trigger = CronTrigger.from_crontab(task.cron_expression, timezone=tz) if tz else CronTrigger.from_crontab(task.cron_expression)
            next_run = trigger.get_next_fire_time(None, now)
            scheduler.add_job(
                func,
                trigger,
                id=job_id,
                args=[task.user_id, task.id],
                replace_existing=True,
                next_run_time=next_run
            )
            logger.info(f"Added job {job_id} for task {task.task_type}")
        except Exception as e:
            logger.error(f"Failed to add job {job_id}: {e}")

def remove_task_job(task_id: int):
    job_id = str(task_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"Removed job {job_id}")

def start_scheduler():
    # Load tasks
    db = database.SessionLocal()
    try:
        tasks = db.query(models.Task).filter(models.Task.is_enabled == True).all()
        for task in tasks:
            # Normalize legacy types
            if task.task_type in ['seat_today', 'seat_tomorrow']:
                task.task_type = 'reserve'
                db.commit()
            add_task_job(task)
    except Exception as e:
        logger.error(f"Failed to load tasks: {e}")
    finally:
        db.close()
        
    scheduler.start()
