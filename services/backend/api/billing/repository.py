from sqlalchemy.orm import Session
from . import models, schemas
from datetime import datetime
from sqlalchemy import func
import json

class BillingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_config(self, project_id: str):
        return self.db.query(models.BillingConfig).filter(models.BillingConfig.project_id == project_id).first()

    def update_config(self, project_id: str, config: schemas.ConfigBase):
        db_config = self.get_config(project_id)
        if not db_config:
            db_config = models.BillingConfig(project_id=project_id)
            self.db.add(db_config)
        
        db_config.price_per_unit = config.price_per_unit
        db_config.currency = config.currency
        db_config.vat_rate = config.vat_rate
        db_config.ft_rate = config.ft_rate
        db_config.billing_day = config.billing_day
        db_config.cutoff_day = config.cutoff_day
        
        self.db.commit()
        self.db.refresh(db_config)
        return db_config

    def upsert_daily_usage(self, usage_data: dict):
        # usage_data keys: project_id, device_id, date, energy_used, cost, meter_start, meter_end, price_snapshot
        # Check conflict
        existing = self.db.query(models.DailyUsage).filter(
            models.DailyUsage.project_id == usage_data['project_id'],
            models.DailyUsage.device_id == usage_data['device_id'],
            models.DailyUsage.date == usage_data['date']
        ).first()

        if existing:
            existing.energy_used = usage_data['energy_used']
            existing.cost = usage_data['cost']
            existing.meter_start = usage_data['meter_start']
            existing.meter_end = usage_data['meter_end']
            existing.price_snapshot = usage_data['price_snapshot']
            existing.last_update = datetime.utcnow()
        else:
            new_record = models.DailyUsage(**usage_data)
            self.db.add(new_record)
        
        self.db.commit()

    def get_daily_usage(self, project_id: str, date: str):
        return self.db.query(models.DailyUsage).filter(
            models.DailyUsage.project_id == project_id,
            models.DailyUsage.date == date
        ).all()

    def get_last_usage(self, project_id: str, device_id: str, before_date: str):
        """Get the most recent usage record before the specific date."""
        return self.db.query(models.DailyUsage).filter(
            models.DailyUsage.project_id == project_id,
            models.DailyUsage.device_id == device_id,
            models.DailyUsage.date < before_date
        ).order_by(models.DailyUsage.date.desc()).first()

    def get_monthly_aggregation(self, project_id: str, month_prefix: str):
        # month_prefix like "2024-01"
        return self.db.query(
            models.DailyUsage.device_id,
            func.sum(models.DailyUsage.energy_used).label("total_energy"),
            func.sum(models.DailyUsage.cost).label("total_cost")
        ).filter(
            models.DailyUsage.project_id == project_id,
            models.DailyUsage.date.like(f"{month_prefix}%")
        ).group_by(models.DailyUsage.device_id).all()

    def create_invoice(self, invoice_data: dict):
        # invoice_data: project_id, target_id, target_name, scope, billing_month, amount, date, due_date
        # Check if exists? (Optional: regenerate logic)
        existing = self.db.query(models.Invoice).filter(
            models.Invoice.project_id == invoice_data['project_id'],
            models.Invoice.target_id == invoice_data['target_id'],
            models.Invoice.scope == invoice_data['scope'],
            models.Invoice.billing_month == invoice_data['billing_month']
        ).first()

        import uuid
        inv_num = f"INV-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        if existing:
            # Update amount if draft
            if existing.status == models.PaymentStatus.DUE:
                existing.amount = invoice_data['amount']
                existing.due_date = invoice_data['due_date']
                self.db.commit()
                return existing
            return existing # Already paid or generated, don't overwrite blindly
        
        new_inv = models.Invoice(**invoice_data, invoice_number=inv_num)
        self.db.add(new_inv)
        self.db.commit()
        self.db.refresh(new_inv)
        return new_inv

    def get_invoices(self, project_id: str, month: str = None):
        q = self.db.query(models.Invoice).filter(models.Invoice.project_id == project_id)
        if month:
            q = q.filter(models.Invoice.billing_month == month)
        return q.all()

    def get_payments(self, project_id: str):
        # Join with Invoice to filter by project_id
        return self.db.query(models.Payment).join(models.Invoice).filter(models.Invoice.project_id == project_id).all()

    def record_payment(self, payment_data: schemas.PaymentRecord):
        inv = self.db.query(models.Invoice).filter(models.Invoice.id == payment_data.invoice_id).first()

        if not inv:
            raise ValueError("Invoice not found")

        pay = models.Payment(
            invoice_id=inv.id,
            amount=payment_data.amount,
            method=payment_data.method,
            ref_no=payment_data.ref_no
        )
        self.db.add(pay)
        
        # Check if fully paid
        # Simple logic: if payment >= amount, mark paid
        # Ideally sum all payments
        total_paid = sum([p.amount for p in inv.payments]) + payment_data.amount
        if total_paid >= inv.amount:
            inv.status = models.PaymentStatus.PAID
        
        self.db.commit()
        return pay

    # -------------------------
    # Payment Transaction helpers
    # -------------------------
    def create_payment_transaction(self, tx_data: dict):
        """Create a payment transaction record (pending)"""
        import uuid
        tx_id = str(uuid.uuid4())
        tx = models.PaymentTransaction(
            id=tx_id,
            project_id=tx_data.get('project_id'),
            invoice_id=tx_data.get('invoice_id'),
            amount=tx_data.get('amount'),
            currency=tx_data.get('currency', 'THB'),
            status='pending',
            type=tx_data.get('type', 'promptpay'),
            metadata_json=json.dumps(tx_data.get('metadata') or {})
        )
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def get_payment_transaction(self, tx_id: str):
        return self.db.query(models.PaymentTransaction).filter(models.PaymentTransaction.id == tx_id).first()

    def list_payment_transactions(self, project_id: str = None):
        q = self.db.query(models.PaymentTransaction)
        if project_id:
            q = q.filter(models.PaymentTransaction.project_id == project_id)
        return q.order_by(models.PaymentTransaction.created_at.desc()).all()

    def update_payment_transaction_status(self, tx_id: str, status: str, ref_no: str = None):
        tx = self.db.query(models.PaymentTransaction).filter(models.PaymentTransaction.id == tx_id).first()
        if not tx:
            return None
        tx.status = status
        if ref_no:
            tx.omise_charge_id = ref_no
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def get_last_payment_date(self, project_id: str):
        """
        Get the most recent payment date for a project.
        """
        q = self.db.query(models.Payment).join(models.Invoice).filter(
            models.Invoice.project_id == project_id
        ).order_by(models.Payment.paid_at.desc()).first()
        return q.paid_at if q else None

    def reset_today_baseline(self, project_id: str, device_id: str, baseline: float, price_snapshot: float = 0.0):
        """
        After payment, reset measurement baseline for the current day:
        meter_start = baseline, meter_end = baseline, energy_used = 0
        """
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        existing = self.db.query(models.DailyUsage).filter(
            models.DailyUsage.project_id == project_id,
            models.DailyUsage.device_id == str(device_id),
            models.DailyUsage.date == today
        ).first()
        if existing:
            existing.meter_start = baseline
            existing.meter_end = baseline
            existing.energy_used = 0.0
            existing.cost = 0.0
            existing.price_snapshot = price_snapshot
            existing.last_update = datetime.utcnow()
        else:
            new_record = models.DailyUsage(
                project_id=project_id,
                device_id=str(device_id),
                date=today,
                meter_start=baseline,
                meter_end=baseline,
                energy_used=0.0,
                cost=0.0,
                price_snapshot=price_snapshot,
                last_update=datetime.utcnow()
            )
            self.db.add(new_record)
        self.db.commit()
