from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
import os
import sys

# Determine Helper
if getattr(sys, 'frozen', False):
    ROOT_DIR = os.path.dirname(sys.executable)
else:
    ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

PROJECTS_DIR = os.path.join(ROOT_DIR, 'projects')

# Base Model
Base = declarative_base()

def get_project_db_path(project_id: str):
    from datetime import datetime
    now = datetime.now()
    year_dir = os.path.join(PROJECTS_DIR, project_id, "data", now.strftime("%Y"))
    os.makedirs(year_dir, exist_ok=True)
    return os.path.join(year_dir, f"billing_{now.strftime('%Y_%m')}.db")

def get_project_engine(project_id: str):
    db_path = get_project_db_path(project_id)
    # Use check_same_thread=False for SQLite in web context
    return create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

def get_project_session(project_id: str) -> Session:
    engine = get_project_engine(project_id)
    # Ensure tables exist
    try:
        Base.metadata.create_all(bind=engine)
        print(f"[BILLING][DB] Ready for project {project_id} at {get_project_db_path(project_id)}")
    except Exception as e:
        print(f"[BILLING][DB] Init failed for {project_id}: {e}")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

# Dependency for FastAPI
# Note: For dependencies we often need the REQUEST to know the project_id.
# But existing code injects 'get_db'. We need to be careful.
# If we change 'get_db', we break existing injection unless we check request.

# Strategy: Maintain 'get_db' for backward compatibility OR update all routers.
# Since routers extract 'project_id' from query/path, they should explicitly ask for a session for that project.
# BUT, Dependency Injection usually resolves BEFORE the function body.

# Temporary Global Fallback (for code that hasn't been migrated yet)
DEFAULT_DB_PATH = os.path.join("services", "backend", "data", "billing.db")
default_engine = create_engine(f"sqlite:///{DEFAULT_DB_PATH}", connect_args={"check_same_thread": False})
DefaultSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=default_engine)

def get_db():
    # ⚠️ LEGACY GLOBAL DB (Deprecated)
    # We should move away from this. 
    # But for now, to prevent crash:
    db = DefaultSessionLocal()
    try:
        yield db
    finally:
        db.close()
