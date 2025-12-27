from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from app import crud, models, database, schemas
from app.services.lib_service import LibService
from app.services.auth_service import AuthService
from app.services import bark_service
import logging
from datetime import datetime, timedelta
from sqlalchemy.sql import func
import random
import time

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
            try:
                bark_service.send_cookie_invalid_notification(db, user_id)
            except Exception as notify_error:
                logger.error(f"发送Cookie失效通知失败: {notify_error}")
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
             try:
                bark_service.send_sessid_missing_notification(db, user_id)
             except Exception as notify_error:
                logger.error(f"发送SessID缺失通知失败: {notify_error}")
             return
        
        # 检查蓝牙配置
        if not user.wechat_config.major or not user.wechat_config.minor:
            logger.error(f"User {user_id} bluetooth config missing")
            if task:
                task.last_status = 'failed'
                task.last_message = '蓝牙打卡配置缺失（major/minor）'
            try:
                bark_service.send_bluetooth_missing_notification(db, user_id)
            except Exception as notify_error:
                logger.error(f"发送蓝牙配置缺失通知失败: {notify_error}")
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

def run_global_keep_alive():
    """
    Global background task to refresh cookies for all users.
    Runs independently of user-defined tasks.
    """
    logger.info("Starting global keep-alive task...")
    db = database.SessionLocal()
    try:
        # Ensure required columns exist for adaptive backoff (runtime safety)
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(database.engine)
            if inspector.has_table("seat_status_cache"):
                cache_cols = [c['name'] for c in inspector.get_columns('seat_status_cache')]
                ddl_needed = False
                with database.engine.begin() as conn:
                    if 'keepalive_fail_count' not in cache_cols:
                        conn.execute(text("ALTER TABLE seat_status_cache ADD COLUMN keepalive_fail_count INT DEFAULT 0"))
                        ddl_needed = True
                    if 'htmlrule_backoff_until' not in cache_cols:
                        dialect = database.engine.dialect.name
                        if dialect == 'mysql':
                            conn.execute(text("ALTER TABLE seat_status_cache ADD COLUMN htmlrule_backoff_until DATETIME"))
                        else:
                            conn.execute(text("ALTER TABLE seat_status_cache ADD COLUMN htmlrule_backoff_until TIMESTAMP WITH TIME ZONE"))
                        ddl_needed = True
                if ddl_needed:
                    logger.info("Applied runtime migration for seat_status_cache adaptive backoff columns")
        except Exception as mig_error:
            logger.warning(f"Adaptive backoff columns check/migration failed: {mig_error}")
        
        # Fetch users with valid cookie config
        users = db.query(models.User).join(models.WechatConfig).filter(
            models.WechatConfig.cookie != None,
            models.WechatConfig.cookie != ''
        ).all()
        
        logger.info(f"Found {len(users)} users for keep-alive check")
        
        try:
            random.shuffle(users)
        except Exception:
            pass
        
        for user in users:
            try:
                # 1. Maintain Authorization Cookie (for reservation)
                if user.wechat_config and user.wechat_config.cookie:
                    # Define callback to save updated cookie
                    # We need to capture user_id to query fresh if needed, but 'user' object is attached to session
                    def save_cookie(new_cookie):
                        try:
                            # Ensure we are working with the latest state
                            user.wechat_config.cookie = new_cookie
                            db.add(user.wechat_config)
                            db.commit()
                        except Exception as e:
                            logger.error(f"Failed to save cookie for user {user.id}: {e}")

                    # Initialize service with current cookie
                    service = LibService(user.wechat_config.cookie, save_cookie)
                    
                    try:
                        time.sleep(random.uniform(0.2, 1.0))
                    except Exception:
                        pass
                    
                    tz = getattr(scheduler, 'timezone', None)
                    now = datetime.now(tz) if tz else datetime.now()
                    now_naive = now.replace(tzinfo=None)
                    cache = db.query(models.SeatStatusCache).filter(models.SeatStatusCache.user_id == user.id).first()
                    if not cache:
                        cache = models.SeatStatusCache(user_id=user.id, keepalive_fail_count=0)
                        db.add(cache)
                        db.commit()
                        db.refresh(cache)
                    
                    # Note: 'htmlrule_backoff_until' column name is preserved to avoid migration, 
                    # but it now controls backoff for getUserCancleConfig query.
                    do_keepalive = True
                    if cache.htmlrule_backoff_until:
                        try:
                            backoff_time = cache.htmlrule_backoff_until
                            if backoff_time.tzinfo is not None:
                                cmp_now = now
                                backoff_cmp = backoff_time
                            else:
                                cmp_now = now_naive
                                backoff_cmp = backoff_time
                            if backoff_cmp > cmp_now:
                                do_keepalive = False
                        except Exception as cmp_error:
                            logger.warning(f"Backoff time compare failed for user {user.id}: {cmp_error}")
                            do_keepalive = False
                    
                    try:
                        status = service.keep_alive(do_keepalive_query=do_keepalive)
                        page_ok = bool((status or {}).get('page_ok'))
                        api_ok = bool((status or {}).get('api_ok'))
                        
                        if api_ok:
                            cache.keepalive_fail_count = 0
                            cache.htmlrule_backoff_until = None
                            db.add(cache)
                            db.commit()
                        elif page_ok and not api_ok:
                            # 2024-12-27: keep-alive query (getUserCancleConfig) failing.
                            # Check if session is actually valid using a read operation.
                            is_valid = False
                            try:
                                service.get_user_info()
                                is_valid = True
                            except Exception:
                                is_valid = False

                            if is_valid:
                                logger.warning(f"User {user.id} keep-alive partial: Page OK, but API failed. Session verified via get_user_info.")
                                # Reset fail count because session is actually valid
                                cache.keepalive_fail_count = 0
                                db.add(cache)
                                db.commit()
                            else:
                                # Session is DEAD.
                                logger.error(f"User {user.id} keep-alive FAILED: API failed AND get_user_info failed.")
                                cache.keepalive_fail_count = (cache.keepalive_fail_count or 0) + 1
                                if cache.keepalive_fail_count >= 2:
                                    # Send notification
                                    try:
                                        bark_service.send_cookie_invalid_notification(db, user.id)
                                    except Exception as notify_error:
                                        logger.error(f"发送Cookie失效通知失败: {notify_error}")
                                    
                                    # Deactivate cookies to stop keep-alive
                                    try:
                                        if user.wechat_config:
                                            user.wechat_config.cookie = None
                                            user.wechat_config.sess_id = None
                                            db.add(user.wechat_config)
                                            db.commit()
                                            logger.info(f"Deactivated cookies for user {user.id} due to persistent failures.")
                                            
                                            # Send notification about account restriction/data clearing
                                            try:
                                                bark_service.send_account_restricted_notification(db, user.id)
                                            except Exception as notify_error:
                                                logger.error(f"发送账号限制通知失败: {notify_error}")
                                    except Exception as db_error:
                                        logger.error(f"Failed to deactivate cookies for user {user.id}: {db_error}")

                                db.add(cache)
                                db.commit()
                    except Exception as e:
                        # Log but do not stop processing other users
                        logger.warning(f"Keep-alive failed for user {user.id}: {e}")
                        emsg = str(e).lower()
                        try:
                            if '40001' in emsg or 'cookie失效' in emsg or '403' in emsg:
                                bark_service.send_cookie_invalid_notification(db, user.id)
                        except Exception as notify_error:
                            logger.error(f"发送Cookie失效通知失败: {notify_error}")

                # 2. Maintain wechatSESS_ID (for bluetooth check-in)
                if user.wechat_config and user.wechat_config.sess_id:
                     try:
                         # Lightweight keep-alive for SESS_ID
                         AuthService.keep_alive_sess_id(user.wechat_config.sess_id)
                     except Exception as e:
                         logger.warning(f"SESS_ID keep-alive failed for user {user.id}: {e}")
                
            except Exception as e:
                logger.error(f"Error processing user {user.id}: {e}")
                
    except Exception as e:
        logger.error(f"Global keep-alive task critical failure: {e}")
    finally:
        db.close()

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
            
        # --- Add Global Keep-Alive Job ---
        # This ensures cookies are refreshed automatically in the background
        # without user intervention.
        keep_alive_job_id = 'global_keep_alive'
        if not scheduler.get_job(keep_alive_job_id):
            try:
                scheduler.add_job(
                    run_global_keep_alive,
                    IntervalTrigger(minutes=1, seconds=47),
                    id=keep_alive_job_id,
                    replace_existing=True,
                    name="Global Cookie Keep-Alive"
                )
                logger.info(f"Registered system job: {keep_alive_job_id}")
            except Exception as e:
                logger.error(f"Failed to register global keep-alive job: {e}")
                
    except Exception as e:
        logger.error(f"Failed to load tasks: {e}")
    finally:
        db.close()
        
    scheduler.start()
