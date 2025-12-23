from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Fix import path for Vercel
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import models, database, scheduler, crud
from sqlalchemy import inspect, text
from app.routers import auth, library, admin, tasks, cron
import time
from sqlalchemy.exc import OperationalError

# Create DB Tables with retry logic
def init_db():
    # In Vercel, we might want to be careful not to lock DB, but create_all is safe
    retries = 3
    while retries > 0:
        try:
            models.Base.metadata.create_all(bind=database.engine)
            print("Database tables created successfully")
            try:
                inspector = inspect(database.engine)
                # Check if tasks table exists first
                if inspector.has_table("tasks"):
                    cols = [c['name'] for c in inspector.get_columns('tasks')]
                    if 'remark' not in cols:
                        with database.engine.begin() as conn:
                            conn.execute(text("ALTER TABLE tasks ADD COLUMN remark VARCHAR(500)"))
                        print("Migrated: added tasks.remark column")
            except Exception as e:
                print(f"Migration check failed: {e}")
            return
        except OperationalError as e:
            retries -= 1
            print(f"Database connection failed. Retrying in 2 seconds... ({retries} retries left)")
            time.sleep(2)
    print("Could not connect to the database after several retries.")

# On Vercel, this module is loaded once per cold start.
# We call init_db() to ensure tables exist.
init_db()

app = FastAPI(title="FuckLib 自助图书馆 API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers - 使用 /api 前缀匹配 Vercel 路由
app.include_router(auth.router, prefix="/api")
app.include_router(library.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(cron.router, prefix="/api")

@app.on_event("startup")
def startup_event():
    if not os.getenv("VERCEL"):
        scheduler.start_scheduler()
    else:
        print("Running on Vercel: Background scheduler disabled.")

    # Seed Invite Code
    db = database.SessionLocal()
    try:
        # Check if ADMIN123 exists
        admin_code = db.query(models.InviteCode).filter(models.InviteCode.code == "ADMIN123").first()
        if not admin_code:
            crud.create_invite_code(db, "ADMIN123")
            print("Seeded Invite Code: ADMIN123")
        elif admin_code.is_used:
            # Check if the user who used it is admin
            if admin_code.used_by_user_id:
                user = db.query(models.User).filter(models.User.id == admin_code.used_by_user_id).first()
                if user and not user.is_admin:
                    user.is_admin = True
                    db.commit()
                    print(f"Fixed admin permissions for user {user.username}")
            print("Invite Code ADMIN123 already exists and is used")
        else:
            print("Invite Code ADMIN123 already exists and is ready to use")
    except Exception as e:
        print(f"Error seeding invite code: {e}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "欢迎使用 FuckLib 自助图书馆 API"}
