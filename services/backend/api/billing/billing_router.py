# --- Router definition must come first ---
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from datetime import datetime
from sqlalchemy.orm import Session
from typing import List, Optional

from . import schemas, database
from .billing_service import BillingService
from services.backend.shared_state import READINGS, load_active

router = APIRouter()

# Dependency (must be defined before use)
def get_billing_service():
    return BillingService(None)

# --- End router definition ---
# Endpoint สำหรับแจ้งชำระเงินแบบองค์กร (รับไฟล์สลิป)
@router.post('/payments/upload', status_code=201)
async def upload_payment(
    invoice_id: int = Form(...),
    amount: float = Form(...),
    method: str = Form('promptpay'),
    note: str = Form(''),
    slip: UploadFile = File(...),
    service: BillingService = Depends(get_billing_service)
):
    # บันทึกไฟล์สลิป
    slip_path = f"static/slips/{invoice_id}_{int(datetime.now().timestamp())}_{slip.filename}"
    with open(slip_path, "wb") as f:
        f.write(await slip.read())
    # สร้าง payment record
    payment = {
        "invoice_id": invoice_id,
        "amount": amount,
        "method": method,
        "note": note,
        "slip_path": slip_path,
        "status": "pending",
        "created_at": datetime.now().isoformat()
    }
    # TODO: save payment to DB (mock: save to file)
    with open(f"static/payments/{invoice_id}_{int(datetime.now().timestamp())}.json", "w", encoding="utf-8") as pf:
        import json; json.dump(payment, pf, ensure_ascii=False, indent=2)
    # TODO: แจ้งเตือน admin (email/LINE)
    return {"success": True, "payment": payment}
    return BillingService(None)

def _get_active_project(project_id: str = None):
    if project_id:
        return project_id
    active = load_active().get('active')
    if active:
        return active
    raise HTTPException(status_code=400, detail="No active project selected")

# ============================================================
# ⚙️ CONFIG
# ============================================================
@router.get("/config", response_model=schemas.ConfigResponse)
def get_config(project_id: Optional[str] = None):
    db = None
    try:
        pid = _get_active_project(project_id)
        db = database.get_project_session(pid)
        service = BillingService(db)
        result = service.get_config(pid)
        return result
    except Exception:
        pid = project_id or (load_active().get('active') or '')
        return schemas.ConfigResponse(
            project_id=pid,
            price_per_unit=5.0,
            currency="THB",
            vat_rate=7.0,
            ft_rate=0.0,
            updated_at=datetime.utcnow()
        )
    finally:
        try:
            if db:
                db.close()
        except Exception:
            pass

@router.post("/config", response_model=schemas.ConfigResponse)
def update_config(config: schemas.ConfigUpdate, project_id: Optional[str] = None):
    db = None
    try:
        pid = _get_active_project(project_id)
        db = database.get_project_session(pid)
        service = BillingService(db)
        return service.update_config(pid, config)
    except Exception as e:
        print(f"[BILLING CONFIG ERROR] {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update config: {str(e)}")
    finally:
        try:
            if db:
                db.close()
        except Exception:
            pass

# ============================================================
# 🔄 SYNC & CALCULATE
# ============================================================
@router.post("/sync")
def trigger_sync(
    background_tasks: BackgroundTasks,
    project_id: Optional[str] = None,
    service: BillingService = Depends(get_billing_service)
):
    pid = _get_active_project(project_id)
    readings = READINGS.get(pid, {})
    
    # Run synchronously for now to ensure immediate feedback, 
    # or background if too slow.
    service.calculate_sync(pid, readings)
    return {"status": "ok", "message": "Synced billing data"}

# ============================================================
# 🧾 INVOICES & PAYMENTS
# ============================================================
@router.get("/invoices", response_model=List[schemas.InvoiceResponse])
def list_invoices(
    project_id: Optional[str] = None,
    service: BillingService = Depends(get_billing_service)
):
    pid = _get_active_project(project_id)
    return service.get_invoices(pid)

@router.post("/invoices/generate", response_model=List[schemas.InvoiceResponse])
def generate_invoices(
    project_id: Optional[str] = None,
    service: BillingService = Depends(get_billing_service)
):
    pid = _get_active_project(project_id)
    return service.generate_invoices(pid)

@router.post("/payments")
def record_payment(
    payment: schemas.PaymentRecord,
    service: BillingService = Depends(get_billing_service)
):
    return service.record_payment(payment)

# ----------------------------------------
# PromptPay / Payment Transactions
# ----------------------------------------
@router.post('/transactions', response_model=schemas.TransactionResponse)
def create_transaction(
    req: schemas.TransactionCreateRequest,
    service: BillingService = Depends(get_billing_service)
):
    tx = service.create_payment_transaction(req.project_id or '', req.invoice_id, req.amount, req.phone, metadata=req.metadata)
    # Return minimal response — frontend will generate QR payload
    return schemas.TransactionResponse(
        id=tx.id,
        invoice_id=tx.invoice_id,
        project_id=tx.project_id,
        amount=tx.amount,
        phone=(tx.metadata_json and __import__('json').loads(tx.metadata_json).get('phone')) or '',
        status=tx.status,
        type=tx.type,
        created_at=tx.created_at
    )

@router.get('/transactions')
def list_transactions(project_id: Optional[str] = None, service: BillingService = Depends(get_billing_service)):
    txs = service.list_payment_transactions(project_id)
    def to_dict(t):
        return {
            'id': t.id,
            'invoice_id': t.invoice_id,
            'project_id': t.project_id,
            'amount': float(t.amount or 0),
            'phone': (t.metadata_json and __import__('json').loads(t.metadata_json).get('phone')) or '',
            'status': t.status,
            'type': t.type,
            'created_at': t.created_at.isoformat() if getattr(t, 'created_at', None) else None
        }
    return {'status': 'ok', 'data': [to_dict(t) for t in txs]}

@router.get('/transactions/{tx_id}')
def get_transaction(tx_id: str, service: BillingService = Depends(get_billing_service)):
    tx = service.get_payment_transaction(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail='Transaction not found')
    return {
        'id': tx.id,
        'invoice_id': tx.invoice_id,
        'project_id': tx.project_id,
        'amount': float(tx.amount or 0),
        'phone': (tx.metadata_json and __import__('json').loads(tx.metadata_json).get('phone')) or '',
        'status': tx.status,
        'type': tx.type,
        'created_at': tx.created_at.isoformat() if getattr(tx, 'created_at', None) else None
    }

@router.post('/transactions/{tx_id}/notify_paid')
def notify_paid(tx_id: str, service: BillingService = Depends(get_billing_service)):
    tx = service.set_transaction_status_pending_review(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail='Transaction not found')
    return {'status': 'ok', 'message': 'Marked as pending_review'}

@router.post('/transactions/{tx_id}/confirm')
def confirm_transaction(tx_id: str, action: schemas.TransactionAction, service: BillingService = Depends(get_billing_service)):
    # Admin only (get current user lazily to avoid circular imports)
    try:
        from services.backend.fastapi_app import get_current_user, is_admin
        current_user = get_current_user()
    except Exception:
        raise HTTPException(status_code=401, detail='Unauthorized')

    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail='Admin only')
    try:
        tx = service.confirm_payment_transaction(tx_id, confirmed_by=current_user, ref_no=action.ref_no)
        return {'status': 'ok', 'message': 'Transaction confirmed', 'tx_id': tx.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============================================================
# 🛑 LEGACY / COMPATIBILITY (Optional)
# ============================================================
# If frontend still calls old endpoints, we might need adapters here.
# For now, I'm assuming we update frontend or these new endpoints replace them.
# The user asked to "Adjust/Fix", so I'll leave old endpoints out to force clean usage,
# unless I see they are critical.
# The `BillingModule` frontend I read calls:
# /api/billing/summary
# /api/billing/all_bills
# /api/billing/payments
# /api/billing/record_payment

# I SHOULD RE-IMPLEMENT THESE TO KEEP FRONTEND WORKING!

@router.get("/summary")
def legacy_summary(project_id: Optional[str] = None, service: BillingService = Depends(get_billing_service)):
    pid = _get_active_project(project_id)
    return {"status": "ok", "data": service.get_dashboard_summary(pid)}

@router.get("/summary_excel")
def legacy_summary_excel(project_id: Optional[str] = None, service: BillingService = Depends(get_billing_service)):
    """Alias for /summary to support legacy frontend builds"""
    pid = _get_active_project(project_id)
    return {"status": "ok", "data": service.get_dashboard_summary(pid)}

@router.get("/all_bills")
def legacy_all_bills(project_id: Optional[str] = None, service: BillingService = Depends(get_billing_service)):
    # Legacy: returns list of daily records for today
    pid = _get_active_project(project_id)
    # We can fetch daily usage
    today = __import__("datetime").datetime.now().strftime("%Y-%m-%d")
    repo, session = service._get_project_repo(pid)
    usage = repo.get_daily_usage(pid, today)
    
    def get_name(did):
        info = map_device_to_convertor(did, pid)
        return info.get('device_name') or did

    return {"status": "ok", "data": [
        {
            "device_id": u.device_id,
            "device_name": get_name(u.device_id),
            "energy_used": u.energy_used,
            "total_money": u.cost
        } for u in usage
    ]}

@router.get("/payments")
def legacy_get_payments(project_id: Optional[str] = None, service: BillingService = Depends(get_billing_service)):
    pid = _get_active_project(project_id)
    payments = service.get_payments(pid)
    def to_dict(p):
        try:
            return {
                "id": p.id,
                "invoice_id": p.invoice_id,
                "ref_no": p.ref_no,
                "amount": float(p.amount or 0),
                "paid_at": p.paid_at.isoformat() if getattr(p, "paid_at", None) else None,
                "method": p.method
            }
        except:
            return {}
    return {"status": "ok", "data": [to_dict(p) for p in payments]}

@router.get("/history")
def get_billing_history(
    project_id: Optional[str] = None, 
    start: Optional[str] = None,
    end: Optional[str] = None,
    service: BillingService = Depends(get_billing_service)
):
    pid = _get_active_project(project_id)
    # Default 7 days if no dates provided, otherwise use start/end
    data = service.get_usage_history(pid, days=7, start=start, end=end)
    return {"status": "ok", "data": data}

@router.get("/daily/{month}")
def get_daily_billing(month: str, project_id: Optional[str] = None, service: BillingService = Depends(get_billing_service)):
    """Get daily billing data for a specific month (YYYY-MM)"""
    pid = _get_active_project(project_id)
    repo, session = service._get_project_repo(pid)
    try:
        # Query daily usage for the month
        from . import models
        from sqlalchemy import func
        results = session.query(
            models.DailyUsage.date,
            func.sum(models.DailyUsage.energy_used).label("total_energy"),
            func.sum(models.DailyUsage.cost).label("total_cost")
        ).filter(
            models.DailyUsage.project_id == pid,
            models.DailyUsage.date.like(f"{month}%")
        ).group_by(models.DailyUsage.date).order_by(models.DailyUsage.date).all()
        
        data = []
        for r in results:
            day = r.date.split("-")[-1] if r.date else ""
            data.append({
                "date": r.date,
                "day": f"{day} {['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][int(month.split('-')[1])]}",
                "total_energy": float(r.total_energy or 0),
                "total_cost": float(r.total_cost or 0)
            })
        return {"status": "ok", "data": data}
    except Exception as e:
        print(f"Error fetching daily billing: {e}")
        return {"status": "ok", "data": []}
    finally:
        session.close()

@router.get("/monthly/{year}")
def get_monthly_billing(year: str, project_id: Optional[str] = None, service: BillingService = Depends(get_billing_service)):
    """Get monthly billing data for a specific year (YYYY)"""
    pid = _get_active_project(project_id)
    repo, session = service._get_project_repo(pid)
    try:
        from . import models
        from sqlalchemy import func
        results = session.query(
            func.strftime('%Y-%m', models.DailyUsage.date).label("month"),
            func.sum(models.DailyUsage.energy_used).label("total_energy"),
            func.sum(models.DailyUsage.cost).label("total_cost")
        ).filter(
            models.DailyUsage.project_id == pid,
            models.DailyUsage.date.like(f"{year}%")
        ).group_by(func.strftime('%Y-%m', models.DailyUsage.date)).order_by(func.strftime('%Y-%m', models.DailyUsage.date)).all()
        
        month_names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        data = []
        for r in results:
            month_num = int(r.month.split('-')[1]) if r.month else 0
            data.append({
                "month": month_names[month_num] if month_num < len(month_names) else r.month,
                "total_energy": float(r.total_energy or 0),
                "total_cost": float(r.total_cost or 0)
            })
        return {"status": "ok", "data": data}
    except Exception as e:
        print(f"Error fetching monthly billing: {e}")
        return {"status": "ok", "data": []}
    finally:
        session.close()


# ============================================================
# 💳 OMISE PAYMENT GATEWAY
# ============================================================
from .omise_service import OmiseService
from .omise_webhook_logic import process_omise_webhook
from fastapi import Request

omise_svc = OmiseService()

@router.post("/pay/charge")
def create_charge(payload: schemas.ChargeRequest, service: BillingService = Depends(get_billing_service)):
    # 1. Verify Invoice
    # TODO: Fetch invoice and verify amount matches? For now assume valid request.
    
    pid = _get_active_project(payload.project_id)
    
    # 2. Record Transaction Request in DB
    from uuid import uuid4
    from . import models
    trx_id = str(uuid4())
    
    amount_thb = float(payload.amount)
    
    trx = models.PaymentTransaction(
        id=trx_id,
        project_id=pid,
        invoice_id=payload.invoice_id,
        amount=amount_thb,
        status="pending_provider",
        type=payload.type
    )
    repo, session = service._get_project_repo(pid)
    session.add(trx)
    session.commit()
    
    try:
        # 3. Call Omise
        if payload.type == "promptpay":
            res = omise_svc.create_charge_promptpay(amount_thb, pid, payload.invoice_id)
        elif payload.type == "credit_card":
            if not payload.token:
                raise HTTPException(status_code=400, detail="Token required for card payment")
            # Return URI to simple callback page
            ret_uri = f"http://localhost:5000/api/billing/callback/omise?inv={payload.invoice_id}" 
            res = omise_svc.create_charge_card(amount_thb, payload.token, pid, payload.invoice_id, ret_uri)
        else:
            raise HTTPException(status_code=400, detail="Invalid payment type")
            
        # 4. Update Transaction with Charge ID
        trx.omise_charge_id = res.get("omise_id")
        trx.status = res.get("status")
        session.commit()
        
        return res
        
    except Exception as e:
        trx.status = "failed"
        session.commit()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook/omise")
async def omise_webhook(request: Request):
    return await process_omise_webhook(request)

@router.get("/callback/omise")
def omise_callback(inv: int):
    # Retrieve charge status checks? 
    # For now just redirect to frontend success/fail page
    # Since we rely on Webhook for actual state, this is just UX.
    from starlette.responses import RedirectResponse
    # Redirect to frontend billing page
    return RedirectResponse(url=f"/#billing?invoiceId={inv}&checkStatus=true")

