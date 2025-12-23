from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app import database, models, schemas, crud
from app.routers import auth
from app import scheduler

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"]
)

@router.get("/", response_model=List[schemas.TaskResponse])
def get_tasks(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    tasks = list(current_user.tasks)
    for t in tasks:
        try:
            setattr(t, 'next_run', scheduler.compute_next_run(t))
        except Exception:
            setattr(t, 'next_run', None)
    return tasks

@router.post("/", response_model=schemas.TaskResponse)
def create_task(task: schemas.TaskCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = models.Task(**task.dict(), user_id=current_user.id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Add to scheduler
    scheduler.add_task_job(db_task)
    
    return db_task

@router.put("/{task_id}", response_model=schemas.TaskResponse)
def update_task(task_id: int, task_update: schemas.TaskUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    old_values = {
        'is_enabled': db_task.is_enabled,
        'cron_expression': db_task.cron_expression,
        'task_type': db_task.task_type,
        'config': db_task.config,
        'remark': getattr(db_task, 'remark', None)
    }
    for key, value in task_update.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    
    try:
        db.commit()
        db.refresh(db_task)
        if db_task.is_enabled:
            scheduler.add_task_job(db_task)
        else:
            scheduler.remove_task_job(db_task.id)
    except Exception as e:
        # rollback to previous state
        for k, v in old_values.items():
            setattr(db_task, k, v)
        db.commit()
        raise HTTPException(status_code=500, detail=f"更新任务失败：{str(e)}")
        
    return db_task

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # Remove from scheduler
    scheduler.remove_task_job(db_task.id)
    
    db.delete(db_task)
    db.commit()
    return {"message": "任务已删除"}

@router.patch("/{task_id}/toggle", response_model=schemas.TaskResponse)
def toggle_task(task_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")
    prev = db_task.is_enabled
    db_task.is_enabled = not prev
    try:
        db.commit()
        db.refresh(db_task)
        if db_task.is_enabled:
            scheduler.add_task_job(db_task)
        else:
            scheduler.remove_task_job(db_task.id)
        return db_task
    except Exception as e:
        db_task.is_enabled = prev
        db.commit()
        raise HTTPException(status_code=500, detail=f"切换任务状态失败：{str(e)}")
