from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import models, database, scheduler, crud
from app.routers import auth, library, admin, tasks
import time
from sqlalchemy.exc import OperationalError

# Create DB Tables with retry logic
def init_db():
    retries = 5
    while retries > 0:
        try:
            models.Base.metadata.create_all(bind=database.engine)
            print("Database tables created successfully")
            return
        except OperationalError as e:
            retries -= 1
            print(f"Database connection failed. Retrying in 5 seconds... ({retries} retries left)")
            time.sleep(5)
    print("Could not connect to the database after several retries.")

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

# Routers
app.include_router(auth.router)
app.include_router(library.router)
app.include_router(admin.router)
app.include_router(tasks.router)

@app.on_event("startup")
def startup_event():
    scheduler.start_scheduler()
    
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
