from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class ConfigBase(BaseModel):
    price_per_unit: float
    currency: str = "THB"
    vat_rate: float = 7.0
    ft_rate: float = 0.0
    billing_day: int = 25
    cutoff_day: int = 20

class ConfigUpdate(ConfigBase):
    pass

class ConfigResponse(ConfigBase):
    project_id: str
    updated_at: datetime
    
    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    invoice_number: str
    amount: float
    status: str
    due_date: str
    target_name: str
    scope: str
    billing_month: str

class InvoiceResponse(InvoiceBase):
    id: int
    created_at: datetime
    project_id: str

    class Config:
        from_attributes = True

class PaymentRecord(BaseModel):
    invoice_id: int
    amount: float
    method: str = "promptpay"
    ref_no: Optional[str] = None

class ChargeRequest(BaseModel):
    invoice_id: int
    amount: float # in THB
    type: str = "promptpay" # promptpay, credit_card
    token: Optional[str] = None # For credit card
    project_id: Optional[str] = None


class TransactionCreateRequest(BaseModel):
    invoice_id: int
    amount: float
    phone: str # e.g. PromptPay recipient phone (digits only)
    project_id: Optional[str] = None
    metadata: Optional[dict] = None

class TransactionResponse(BaseModel):
    id: str
    invoice_id: int
    project_id: Optional[str] = None
    amount: float
    phone: str
    status: str
    type: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class TransactionAction(BaseModel):
    note: Optional[str] = None
    confirmed_by: Optional[str] = None
    ref_no: Optional[str] = None
