from fastapi import Request, HTTPException
from .omise_service import OmiseService
from . import repository, models, database
from datetime import datetime

async def process_omise_webhook(request: Request):
    try:
        payload = await request.json()
    except:
        return {"status": "ignored", "reason": "invalid_json"}
    
    event_key = payload.get("key")
    
    if event_key == "charge.complete":
        data = payload.get("data", {})
        status = data.get("status")
        charge_id = data.get("id")
        metadata = data.get("metadata", {})
        
        invoice_id_str = metadata.get("invoice_id")
        
        if not invoice_id_str or not charge_id:
            return {"status": "ignored", "reason": "missing_meta"}
            
        # Update DB
        db = database.SessionLocal()
        try:
            # 1. Update Transaction
            trx = db.query(models.PaymentTransaction).filter(models.PaymentTransaction.omise_charge_id == charge_id).first()
            if trx:
                trx.status = status
                trx.updated_at = datetime.utcnow()
                # 2. If successful, mark Invoice as PAID
                if status == "successful":
                    inv_id = int(invoice_id_str)
                    inv = db.query(models.Invoice).filter(models.Invoice.id == inv_id).first()
                    if inv and inv.status != models.PaymentStatus.PAID:
                        inv.status = models.PaymentStatus.PAID
                        # Record formatted payment
                        pay_rec = models.Payment(
                           invoice_id=inv_id,
                           ref_no=charge_id,
                           amount=float(data.get("amount", 0) / 100.0),
                           paid_at=datetime.utcnow(),
                           method=metadata.get("type", "omise")
                        )
                        db.add(pay_rec)
                
                db.commit()
            else:
                print(f"[WEBHOOK] Transaction not found for {charge_id}")
        finally:
            db.close()
            
    return {"status": "ok"}
