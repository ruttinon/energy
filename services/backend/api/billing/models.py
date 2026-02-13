from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class PaymentStatus(str, enum.Enum):
    DUE = "due"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class BillingConfig(Base):
    __tablename__ = "billing_config"

    project_id = Column(String, primary_key=True, index=True)
    price_per_unit = Column(Float, default=5.0)
    currency = Column(String, default="THB")
    vat_rate = Column(Float, default=7.0)
    ft_rate = Column(Float, default=0.0)
    billing_day = Column(Integer, default=25)
    cutoff_day = Column(Integer, default=20)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DailyUsage(Base):
    __tablename__ = "daily_usage"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, index=True)
    device_id = Column(String, index=True)
    date = Column(String, index=True) # YYYY-MM-DD
    
    energy_used = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    meter_start = Column(Float, default=0.0)
    meter_end = Column(Float, default=0.0)
    price_snapshot = Column(Float, default=0.0) # Price at the time of recording
    
    last_update = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('project_id', 'device_id', 'date', name='_daily_usage_uc'),)

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True)
    project_id = Column(String, index=True)
    
    target_id = Column(String) # e.g., device_id or converter_name
    target_name = Column(String)
    scope = Column(String) # 'project', 'converter', 'device'
    
    billing_month = Column(String) # YYYY-MM
    amount = Column(Float)
    status = Column(String, default=PaymentStatus.DUE)
    
    due_date = Column(String) # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)
    
    payments = relationship("Payment", back_populates="invoice")

class Payment(Base):
    __tablename__ = "payments_v2" # v2 to distinguish from legacy

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    ref_no = Column(String) # External Reference / Receipt No
    
    amount = Column(Float)
    paid_at = Column(DateTime, default=datetime.utcnow)
    method = Column(String, default="promptpay")
    
    invoice = relationship("Invoice", back_populates="payments")

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(String, primary_key=True, index=True) # UUID
    project_id = Column(String, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), index=True)
    omise_charge_id = Column(String, unique=True, index=True)
    
    amount = Column(Float) # Check if we want float or integer (satang). Using Float for consistency with other tables but Omise uses subunit.
    currency = Column(String, default="THB")
    
    status = Column(String, default="pending") # pending, successful, failed
    type = Column(String) # promptpay, credit_card
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    metadata_json = Column(String, nullable=True) # Store extra omise data if needed
