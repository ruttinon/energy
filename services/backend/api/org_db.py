import os
from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

Base = declarative_base()

class RealtimeState(Base):
    __tablename__ = "realtime_state"
    device_id = Column(String, primary_key=True)
    parameter = Column(String, primary_key=True)
    device_name = Column(String)
    value = Column(Float)
    unit = Column(String)
    last_updated = Column(DateTime)
    __table_args__ = (UniqueConstraint("device_id", "parameter", name="uq_realtime_device_param"),)

class HistoricalLog(Base):
    __tablename__ = "historical_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime)
    device_id = Column(String)
    device_name = Column(String)
    parameter = Column(String)
    value = Column(Float)
    unit = Column(String)

_db_url = os.getenv("ORG_DB_URL")
_engine = create_engine(_db_url) if _db_url else None
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine) if _engine else None

def get_session_factory():
    return _SessionLocal

def init_org_db():
    if _engine:
        Base.metadata.create_all(bind=_engine)
