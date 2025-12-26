from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import database, models, schemas, crud
from app.routers import auth
from app.services.lib_service import LibService
from app.services.auth_service import AuthService

router = APIRouter(
    prefix="/library",
    tags=["library"]
)

def get_lib_service(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if not current_user.wechat_config or not current_user.wechat_config.cookie:
        raise HTTPException(status_code=400, detail="请先在设置中绑定微信 Cookie")
    
    def save_cookie(new_cookie: str):
        try:
            update_data = schemas.WechatConfigUpdate(cookie=new_cookie)
            crud.update_wechat_config(db, current_user.id, update_data)
        except Exception as e:
            print(f"Failed to auto-save cookie: {e}")

    return LibService(current_user.wechat_config.cookie, save_cookie)

@router.get("/config", response_model=schemas.WechatConfigResponse)
def get_config(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    config = crud.get_wechat_config(db, current_user.id)
    if not config:
        # Create default config if not exists
        config = models.WechatConfig(user_id=current_user.id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

@router.post("/config", response_model=schemas.WechatConfigResponse)
def update_config(
    config: schemas.WechatConfigUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    return crud.update_wechat_config(db, current_user.id, config)

@router.get("/list")
def get_lib_list(service: LibService = Depends(get_lib_service)):
    try:
        return service.get_lib_list()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lib_id}/floors")
def get_floor_list(lib_id: int, service: LibService = Depends(get_lib_service)):
    try:
        return service.get_floor_list(lib_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{lib_id}/layout")
def get_lib_layout(lib_id: int, service: LibService = Depends(get_lib_service)):
    try:
        return service.get_lib_layout(lib_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reserve")
def get_reserve_info(service: LibService = Depends(get_lib_service)):
    try:
        return service.get_reserve_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.services import bark_service

@router.post("/reserve")
def reserve_seat(
    lib_id: int, 
    seat_key: str, 
    service: LibService = Depends(get_lib_service),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        return service.reserve_seat(lib_id, seat_key)
    except Exception as e:
        msg = str(e)
        lowered = msg.lower()
        if ('限制预约' in msg) or ('异常预约' in msg) or ('restricted' in lowered):
            try:
                bark_service.send_account_restricted_notification(db, current_user.id)
            except Exception:
                pass
            return {"status": "restricted", "message": msg}
        raise HTTPException(status_code=500, detail=msg)

@router.delete("/reserve")
def cancel_reserve(service: LibService = Depends(get_lib_service)):
    try:
        return service.cancel_reserve()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/frequent-seats")
def get_frequent_seats(service: LibService = Depends(get_lib_service)):
    try:
        return service.get_seat_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/seat_info")
def get_seat_info_alias(service: LibService = Depends(get_lib_service)):
    try:
        return service.get_seat_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user_info")
def get_user_info(service: LibService = Depends(get_lib_service)):
    try:
        return service.get_user_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/seat-state")
def get_seat_state(service: LibService = Depends(get_lib_service)):
    try:
        current = service.get_reserve_info()
        frequent = service.get_seat_info()
        return {
            "current": current,
            "frequent": frequent,
            "timestamp": int(__import__('time').time())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/get_cookie_from_url")
def get_cookie_from_url(
    url: str, 
    is_auth_url: bool, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        cookie_str = AuthService.get_cookie_from_url(url, is_auth_url)
        
        # Update user config
        config_update = schemas.WechatConfigUpdate()
        if is_auth_url:
            config_update.cookie = cookie_str
        else:
            config_update.sess_id = cookie_str
            
        crud.update_wechat_config(db, current_user.id, config_update)
        return {"message": "Success", "cookie": cookie_str}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/signin")
def signin(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    try:
        config = crud.get_wechat_config(db, current_user.id)
        if not config or not config.sess_id:
            raise HTTPException(status_code=400, detail="请先在设置中绑定签到授权链接")
        # 前置只读热身（若绑定了 Cookie）
        if config.cookie:
            try:
                LibService(config.cookie).refresh_page()
            except Exception:
                pass
        res = AuthService.sign_in(config.sess_id, config.major, config.minor)
        return {"message": res}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
