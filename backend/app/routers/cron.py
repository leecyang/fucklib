from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import database, models, scheduler
from datetime import datetime, timedelta
import pytz
from croniter import croniter
import logging

router = APIRouter(
    prefix="/cron",
    tags=["cron"]
)

logger = logging.getLogger(__name__)

@router.get("/tick")
def cron_tick(db: Session = Depends(database.get_db)):
    """
    Vercel Cron 触发此端点（建议每分钟一次）。
    检查所有启用的任务，如果当前时间匹配 cron 表达式，则执行任务。
    """
    tz = pytz.timezone('Asia/Shanghai')
    now = datetime.now(tz)
    
    tasks = db.query(models.Task).filter(models.Task.is_enabled == True).all()
    executed_tasks = []
    
    for task in tasks:
        if not task.cron_expression:
            continue
            
        try:
            # 检查任务是否在当前分钟内应该运行
            # 使用 croniter 计算上一次计划运行时间
            cron = croniter(task.cron_expression, now)
            prev_run_time = cron.get_prev(datetime)
            
            # 如果上一次计划运行时间在过去 60 秒内，说明刚到点
            # 允许 65 秒误差以防 Vercel 稍微延迟
            time_diff = (now - prev_run_time).total_seconds()
            
            if 0 <= time_diff < 65:
                # 检查是否已经运行过（防止重复执行）
                # 注意：scheduler.run_seat_task 会更新 last_run，但我们在这里先做个简单检查
                # 如果 last_run 和 prev_run_time 非常接近（例如相差不到 1 秒），可能已经运行过了
                # 但由于 last_run 也是 datetime，直接比较即可。
                # 注意数据库里的 last_run 可能是 naive 的或者 UTC，需要小心处理
                
                should_run = True
                if task.last_run:
                    # 确保 task.last_run 是带时区的
                    last_run_aware = task.last_run
                    if last_run_aware.tzinfo is None:
                        # 假设数据库存的是 UTC 或者 naive (根据 SQLA 配置)
                        # 这里为了保险，我们将 prev_run_time 转为 task.last_run 的时区或者都转为 UTC 比较
                        # 简单起见，如果上次运行时间 >= prev_run_time，说明已经跑过了
                        # 转换 prev_run_time 到 UTC 用于比较 (假设 DB 存的是 UTC)
                        pass
                        
                    # 简化逻辑：如果上次运行时间就在刚刚（比如 2 分钟内），且等于 prev_run_time，则跳过
                    # 但 prev_run_time 是准确的计划时间。
                    # 如果 task.last_run 大于等于 prev_run_time，说明已经跑过了本次计划
                    
                    # 为了避免时区混乱，我们只依赖 time_diff 和 "是否在最近 60 秒内运行过"
                    if (now - task.last_run.replace(tzinfo=tz)).total_seconds() < 65:
                         should_run = False
                
                if should_run:
                    logger.info(f"Triggering task {task.id} ({task.task_type}) scheduled at {prev_run_time}")
                    if task.task_type == 'reserve':
                        scheduler.run_seat_task(task.user_id, task.id)
                    elif task.task_type == 'signin':
                        scheduler.run_signin_task(task.user_id, task.id)
                    executed_tasks.append({"id": task.id, "type": task.task_type, "scheduled": prev_run_time})
        except Exception as e:
            logger.error(f"Error checking task {task.id}: {e}")
            continue
            
    return {"status": "ok", "executed": executed_tasks, "server_time": now}
