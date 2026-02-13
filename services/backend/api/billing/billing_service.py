from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from . import repository, schemas, models, database

class BillingService:
    def __init__(self, db: Session = None):
        # db is optional now, we prefer opening per-project session
        self.db_fallback = db
        # self.repo will be created on the fly or we update repo too.
        
    def _get_project_repo(self, project_id: str):
        from . import database
        session = database.get_project_session(project_id)
        return repository.BillingRepository(session), session

    def get_config(self, project_id: str) -> schemas.ConfigResponse:
        repo, session = self._get_project_repo(project_id)
        try:
            cfg = repo.get_config(project_id)
            if not cfg:
                return schemas.ConfigResponse(
                    project_id=project_id,
                    price_per_unit=5.0,
                    currency="THB",
                    vat_rate=7.0,
                    ft_rate=0.0,
                    updated_at=datetime.utcnow()
                )
            try:
                # Pydantic v2-compatible conversion
                return schemas.ConfigResponse.model_validate(cfg, from_attributes=True)
            except Exception:
                # Fallback manual mapping
                return schemas.ConfigResponse(
                    project_id=getattr(cfg, "project_id", project_id),
                    price_per_unit=getattr(cfg, "price_per_unit", 0.0),
                    currency=getattr(cfg, "currency", "THB"),
                    vat_rate=getattr(cfg, "vat_rate", 7.0),
                    ft_rate=getattr(cfg, "ft_rate", 0.0),
                    updated_at=getattr(cfg, "updated_at", datetime.utcnow()),
                    billing_day=getattr(cfg, "billing_day", 25),
                    cutoff_day=getattr(cfg, "cutoff_day", 20)
                )
        except Exception:
            # Complete fallback
            return schemas.ConfigResponse(
                project_id=project_id,
                price_per_unit=5.0,
                currency="THB",
                vat_rate=7.0,
                ft_rate=0.0,
                updated_at=datetime.utcnow()
            )
        finally:
            if session:
                session.close()

    def update_config(self, project_id: str, config: schemas.ConfigUpdate):
        repo, session = self._get_project_repo(project_id)
        try:
            return repo.update_config(project_id, config)
        finally:
            session.close()

    def calculate_sync(self, project_id: str, readings: dict):
        """
        Main logic to process real-time readings and update DailyUsage.
        """
        # Debug logging
        try:
            with open("services/backend/data/billing_debug.log", "a") as f:
                f.write(f"[{datetime.now()}] Syncing {project_id}, devices: {len(readings)}\n")
        except:
            pass
            
        repo, session = self._get_project_repo(project_id)
        try:
            # 1. Get Rates
            cfg = repo.get_config(project_id) # Using local repo instance
            if not cfg:
                # Helper to create if not exists inside update_config, but here we just need values
                # Create a temporary config object with defaults
                class MockConfig:
                    price_per_unit = 5.0
                    currency = "THB"
                    vat_rate = 7.0
                    ft_rate = 0.0
                cfg = MockConfig()

            today = datetime.now().strftime("%Y-%m-%d")
            
            # 2. Get existing state for today to efficiently update
            existing_today = {r.device_id: r for r in repo.get_daily_usage(project_id, today)}

            for device_id, data in readings.items():
                values = data.get("values", {})
                ae = None
                # Extract Energy
    
                for k in ["ActiveEnergy_kWh", "ActiveEnergy", "TotalActiveEnergy", "kWh", "energy_active", "Active Energy", "Import Active Energy"]:
                    if k in values and values[k] is not None:
                        try:
                            ae = float(values[k])
                            break
                        except:
                            pass
                
                if ae is None:
                    # Try case-insensitive search
                    for k, v in values.items():
                        if "energy" in k.lower() and "active" in k.lower():
                            try:
                                ae = float(v)
                                break
                            except:
                                pass
                
                if ae is None:
                    continue
                
                # DEBUG: Log the value
                try:
                    with open("services/backend/data/billing_debug.log", "a") as f:
                        f.write(f"  [DEBUG] Device {device_id}: ActiveEnergy = {ae}\n")
                except:
                    pass
    
                # Logic
                meter_start = ae
                meter_end = ae
                energy_used = 0.0
    
                if device_id in existing_today:
                    rec = existing_today[device_id]
                    meter_start = rec.meter_start
                    # Reset check (unlikely with accumulators, but safe to have)
                    if ae < meter_start:
                        meter_start = ae
                    
                    meter_end = ae
                    energy_used = max(0, meter_end - meter_start)
                else:
                    # Cold start for today. Check for yesterday/previous day
                    # Use 'repo' to call get_last_usage. BillingRepository needs to support it. 
                    # Assuming repo.get_last_usage exists (it was used as self.repo.get_last_usage before)
                    last_rec = repo.get_last_usage(project_id, str(device_id), today)
                    if last_rec:
                        # Continuity: Today's start = Previous end
                        meter_start = last_rec.meter_end
                        # Handle rollover or meter replacement case
                        if ae < meter_start:
                             # Assume meter reset or new meter, start fresh from current
                             meter_start = ae
                    else:
                        # Brand new device, never seen before
                        meter_start = ae
                    
                    meter_end = ae
                    energy_used = max(0, meter_end - meter_start)
    
                # Calculate Cost with FT and VAT
                # Formula: Energy * (Base + FT) * (1 + VAT/100)
                base_price = cfg.price_per_unit or 0.0
                ft = cfg.ft_rate or 0.0
                vat_mul = 1 + ((cfg.vat_rate or 7.0) / 100.0)
                
                unit_price = base_price + ft
                cost = energy_used * unit_price * vat_mul
    
                repo.upsert_daily_usage({
                    "project_id": project_id,
                    "device_id": str(device_id),
                    "date": today,
                    "meter_start": meter_start,
                    "meter_end": meter_end,
                    "energy_used": energy_used,
                    "cost": cost,
                    "price_snapshot": cfg.price_per_unit
                })

        except Exception as e:
            print(f"Sync Billing Error: {e}")
            try:
                with open("services/backend/data/billing_debug.log", "a") as f:
                    f.write(f"ERROR: {e}\n")
            except:
                pass
        finally:
            session.close()

    def generate_invoices(self, project_id: str):
        """
        Generate monthly invoices based on CUT-OFF DATE.
        If today is Jan 25, and cutoff is 20.
        Current Cycle = Jan 20 to Feb 19 (if we are looking ahead) or Dec 20 to Jan 19?
        
        Standard Practice:
        If cutoff is 20.
        Bill for 'Jan' covers: Dec 20 - Jan 19.
        Generated on Jan 25 (Billing Day).
        
        Algorithm:
        1. Determine current "Billing Month" based on today.
        2. Calculate start_date and end_date of that cycle.
        3. Query daily_usage between start_date and end_date.
        """
        cfg = self.get_config(project_id)
        cutoff_day = cfg.cutoff_day or 20
        
        now = datetime.now()
        
        # Calculate Cycle Dates
        # If today is after cutoff, we are in the *beginning* of next cycle, 
        # BUT we probably want to generate bill for the *just finished* cycle?
        # User request: "Check notification due today". 
        # Usually invoices are generated for the period that JUST finished.
        
        # If today.day >= cutoff_day:
        #    Cycle just finished is: previous_month.cutoff to this_month.(cutoff-1)
        #    e.g. Jan 25 (cutoff 20). Period: Dec 20 - Jan 19.
        # If today.day < cutoff_day:
        #    Cycle just finished is: prev_prev_month.cutoff to previous_month.(cutoff-1)
        #    e.g. Jan 10 (cutoff 20). Period: Nov 20 - Dec 19.
        
        # Simpler approach: 
        # Always generate for the "Latest Completed Cycle".
        
        if now.day >= cutoff_day:
            # We are past cutoff, so the cycle ending on 'cutoff_day' this month is complete.
            # End Date = This Month, Cutoff Day - 1 (or Cutoff Day? usually end is exclusive or inclusive.. let's say up to Cutoff Day 00:00, or Cutoff Day is the start of new?)
            # Let's say Cutoff 20 means: Jan 19 is last day. Jan 20 is start of new.
            
            end_date_obj = datetime(now.year, now.month, cutoff_day) - timedelta(days=1)
            # Start Date = Previous Month, Cutoff Day
            # logic to get prev month
            if now.month == 1:
                start_date_obj = datetime(now.year - 1, 12, cutoff_day)
            else:
                start_date_obj = datetime(now.year, now.month - 1, cutoff_day)
                
            billing_month_str = now.strftime("%Y-%m") # Invoice for "Jan" (generated in Jan)
            
        else:
            # We are before cutoff. The last complete cycle ended last month.
            # e.g. Jan 10. Cutoff 20. Last complete cycle ended Dec 19.
            # End Date = Prev Month, Cutoff - 1
             if now.month == 1:
                end_date_obj = datetime(now.year - 1, 12, cutoff_day) - timedelta(days=1)
                start_date_obj = datetime(now.year - 1, 11, cutoff_day)
             else:
                 if now.month == 2:
                     end_date_obj = datetime(now.year, 1, cutoff_day) - timedelta(days=1)
                     start_date_obj = datetime(now.year - 1, 12, cutoff_day)
                 else:
                     end_date_obj = datetime(now.year, now.month - 1, cutoff_day) - timedelta(days=1)
                     start_date_obj = datetime(now.year, now.month - 2, cutoff_day)
            
             billing_month_str = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")

        start_str = start_date_obj.strftime("%Y-%m-%d")
        end_str = end_date_obj.strftime("%Y-%m-%d")
        
        repo, session = self._get_project_repo(project_id)
        aggregates = session.query(
            models.DailyUsage.device_id,
            func.sum(models.DailyUsage.cost).label("total_cost")
        ).filter(
            models.DailyUsage.project_id == project_id,
            models.DailyUsage.date >= start_str,
            models.DailyUsage.date <= end_str
        ).group_by(models.DailyUsage.device_id).all()
        
        invoices = []
        for agg in aggregates:
            device_id = agg.device_id
            cost = agg.total_cost or 0.0
            
            if cost <= 0:
                continue

            # Create Invoice
            inv = repo.create_invoice({
                "project_id": project_id,
                "target_id": device_id,
                "target_name": f"Device {device_id}", 
                "scope": "device",
                "billing_month": billing_month_str, # e.g. "2024-01"
                "amount": cost,
                "due_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
            })
            invoices.append(inv)
            invoices.append(inv)
        
        # Trigger Limit/Cutoff Check
        # This is a good place to check, as this is likely called daily or periodically
        try:
            self.check_overdue_and_cutoff(project_id)
        except Exception as e:
            print(f"[BILLING] Failed to run overdue check: {e}")

        return invoices

    def get_invoices(self, project_id: str):
        repo, session = self._get_project_repo(project_id)
        try:
            items = repo.get_invoices(project_id)
            if not items or len(items) == 0:
                try:
                    gen = self.generate_invoices(project_id)
                    if gen and len(gen) > 0:
                        items = repo.get_invoices(project_id)
                except Exception as e:
                    print(f"[BILLING] Auto-generate invoices failed: {e}")
            return items
        finally:
            session.close()

    def get_payments(self, project_id: str):
        repo, session = self._get_project_repo(project_id)
        try:
            return repo.get_payments(project_id)
        finally:
            session.close()

    # -----------------------------
    # Payment Transaction helpers
    # -----------------------------
    def create_payment_transaction(self, project_id: str, invoice_id: int, amount: float, phone: str, metadata: dict = None):
        repo, session = self._get_project_repo(project_id)
        try:
            tx = repo.create_payment_transaction({
                'project_id': project_id,
                'invoice_id': invoice_id,
                'amount': amount,
                'currency': 'THB',
                'type': 'promptpay',
                'metadata': {'phone': phone, **(metadata or {})}
            })
            return tx
        finally:
            session.close()

    def get_payment_transaction(self, tx_id: str, project_id: str = None):
        # project_id optional filter
        repo, session = self._get_project_repo(project_id or '')
        try:
            return repo.get_payment_transaction(tx_id)
        finally:
            session.close()

    def list_payment_transactions(self, project_id: str = None):
        repo, session = self._get_project_repo(project_id or '')
        try:
            return repo.list_payment_transactions(project_id)
        finally:
            session.close()

    def set_transaction_status_pending_review(self, tx_id: str):
        repo, session = self._get_project_repo(None)
        try:
            return repo.update_payment_transaction_status(tx_id, 'pending_review')
        finally:
            session.close()

    def confirm_payment_transaction(self, tx_id: str, confirmed_by: str = None, ref_no: str = None):
        repo, session = self._get_project_repo(None)
        try:
            tx = repo.get_payment_transaction(tx_id)
            if not tx:
                raise ValueError('Transaction not found')
            # Mark transaction as successful
            repo.update_payment_transaction_status(tx_id, 'successful', ref_no=ref_no)
            # Create a Payment record linked to invoice
            if tx.invoice_id:
                from . import schemas as sch
                pay = sch.PaymentRecord(invoice_id=tx.invoice_id, amount=tx.amount, method='promptpay', ref_no=ref_no or tx.id)
                repo.record_payment(pay)
            return tx
        finally:
            session.close()

    def record_payment(self, payment: schemas.PaymentRecord):
        repo, session = self._get_project_repo(payment.project_id)
        res = repo.record_payment(payment)
        try:
            inv = repo.db.query(models.Invoice).filter(models.Invoice.id == payment.invoice_id).first()
            if inv and inv.status == models.PaymentStatus.PAID:
                pid = inv.project_id
                target_dev = inv.target_id
                # Read current Active Energy from shared READINGS
                from services.backend.shared_state import READINGS
                ae = None
                proj_map = READINGS.get(pid, {})
                rec = proj_map.get(str(target_dev)) or {}
                vals = rec.get("values") or {}
                for k in ["ActiveEnergy_kWh", "ActiveEnergy", "TotalActiveEnergy", "kWh", "energy_active"]:
                    if k in vals and vals[k] is not None:
                        try:
                            ae = float(vals[k])
                            break
                        except:
                            pass
                if ae is None:
                    # Fallback to 0 baseline if meter not readable at this instant
                    ae = 0.0
                cfg = self.get_config(pid)
                repo.reset_today_baseline(pid, target_dev, ae, (cfg.price_per_unit or 0.0))
        except Exception as e:
            print(f"[BILLING] Baseline reset failed: {e}")
        finally:
            session.close()
        return res

    def check_overdue_and_cutoff(self, project_id: str):
        """
        Check for overdue invoices and trigger cutoff if necessary.
        User Rule: "If overdue > X days (e.g. 7), cut off DO1/2, Alarm 1/2, Digital Input 1/2".
        Cutoff means: Turn OFF.
        With Inverted Low logic: OFF = Write 1.
        """
        # 1. Get Unpaid Invoices
        invoices = self.get_invoices(project_id)
        unpaid = [inv for inv in invoices if inv.status != 'paid']
        
        cutoff_triggered = False
        
        now = datetime.now()
        overdue_threshold_days = 7 # Configurable?
        
        for inv in unpaid:
            if not inv.due_date:
                continue
            
            # Simple date parse
            try:
                due_dt = datetime.strptime(str(inv.due_date), "%Y-%m-%d")
                delta = (now - due_dt).days
                
                if delta > overdue_threshold_days:
                    cutoff_triggered = True
                    break
            except:
                pass
        
        if cutoff_triggered:
            print(f"[BILLING] Overdue detected for {project_id}. Triggering CUTOFF.")
            from services.backend.api.control.models import ControlDescriptor
            from services.backend.api.control.service import control_service
            
            # Devices to cut? We need to know WHICH device. 
            # The prompt implies "The System" or specific devices associated with the bill.
            # Ideally each invoice targets a device.
            # "Target Name": Device X.
            
            # If cutoff triggered, we might want to cut ALL devices in project? or just the one with overdue bill?
            # Safe bet: Cut the device associated with the invoice.
            
            for inv in unpaid:
                 try:
                    due_dt = datetime.strptime(str(inv.due_date), "%Y-%m-%d")
                    if (now - due_dt).days > overdue_threshold_days:
                        # Cut off THIS device
                        target_dev = inv.target_id
                        print(f"[BILLING] Cutting off Device {target_dev} due to Invoice {inv.id}")
                        
                        targets = ["digital_output_1", "digital_output_2", "alarm_relay_1", "alarm_relay_2"]
                        for t in targets:
                            desc = ControlDescriptor(
                                device_id=target_dev,
                                control_target=t,
                                control_mode="manual",
                                action="OFF", # Logic handle: OFF -> 1 (Active Low)
                                reason="Overdue Bill Auto-Cutoff",
                                operator="system"
                            )
                            control_service.execute_control(desc)
                 except Exception as e:
                     print(f"[BILLING] Error executing cutoff: {e}")
        else:
             print(f"[BILLING] No overdue bills for {project_id}.")

    def get_dashboard_summary(self, project_id: str):
        repo, session = self._get_project_repo(project_id)
        try:
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")
            
            # Today
            today_usage = repo.get_daily_usage(project_id, today_str)
            today_units = sum(u.energy_used for u in today_usage)
            today_cost = sum(u.cost for u in today_usage)
            
            # Cycle since last payment
            last_paid_at = repo.get_last_payment_date(project_id)
            # If no payment, use month start
            cycle_start = None
            if last_paid_at:
                cycle_start = last_paid_at.strftime("%Y-%m-%d")
            else:
                cycle_start = now.strftime("%Y-%m-01")

            # Aggregate since cycle_start to today
            cycle_results = session.query(
                models.DailyUsage.date,
                func.sum(models.DailyUsage.energy_used).label("total_energy"),
                func.sum(models.DailyUsage.cost).label("total_cost")
            ).filter(
                models.DailyUsage.project_id == project_id,
                models.DailyUsage.date >= cycle_start,
                models.DailyUsage.date <= today_str
            ).group_by(models.DailyUsage.date).all()
            month_units = sum(r.total_energy or 0 for r in cycle_results)
            month_cost = sum(r.total_cost or 0 for r in cycle_results)
            
            # --- Compare vs Last Month (Same Period) ---
            # Current: YYYY-MM-01 ... YYYY-MM-DD
            # Previous: (YYYY-MM-1)-01 ... (YYYY-MM-1)-DD
            
            # 1. Get Start of Current Month
            curr_month_start = now.replace(day=1)
            
            # 2. Get Start of Previous Month
            # (First day of current month - 1 day) gives last day of prev month. 
            # Then replace day=1 to get start.
            last_day_prev = curr_month_start - timedelta(days=1)
            prev_month_start = last_day_prev.replace(day=1)
            
            # 3. Get End of Previous Month Period
            # Min of (Today's Day, Last Day of Prev Month)
            target_day = min(now.day, last_day_prev.day)
            prev_month_end = prev_month_start.replace(day=target_day)
            
            prev_start_str = prev_month_start.strftime("%Y-%m-%d")
            prev_end_str = prev_month_end.strftime("%Y-%m-%d")
            
            prev_usage_val = session.query(func.sum(models.DailyUsage.energy_used))\
                .filter(
                    models.DailyUsage.project_id == project_id,
                    models.DailyUsage.date >= prev_start_str,
                    models.DailyUsage.date <= prev_end_str
                ).scalar() or 0.0

            compare_percent = 0.0
            if prev_usage_val > 0:
                diff = month_units - prev_usage_val
                compare_percent = (diff / prev_usage_val) * 100.0
                
            # --- Target kWh ---
            # Default to 500 if not configured. 
            # ideally, we should fetch from models.BillingConfig if we add a column later.
            target_kwh = 500.0 
            
            return {
                "today_units": today_units,
                "today_money": today_cost,
                "month_units": month_units,
                "month_money": month_cost,
                "target_kwh": target_kwh,
                "compare_percent": round(compare_percent, 1)
            }
        finally:
            session.close()

    def get_usage_history(self, project_id: str, days: int = 7, start: str = None, end: str = None):
        """
        Get aggregated usage/cost for the last N days (including today),
        OR for a specific date range if start/end are provided (YYYY-MM-DD).
        Returns list of { "date": "YYYY-MM-DD", "total_energy": X, "total_cost": Y }
        """
        repo, session = self._get_project_repo(project_id)
        try:
            if start and end:
                start_str = start
                end_str = end
                start_date = datetime.strptime(start, "%Y-%m-%d")
                end_date = datetime.strptime(end, "%Y-%m-%d")
            else:
                end_date = datetime.now()
                start_date = end_date - timedelta(days=days-1)
                start_str = start_date.strftime("%Y-%m-%d")
                end_str = end_date.strftime("%Y-%m-%d")
            
            # Use 'session' directly or 'repo.db' (repo.db == session)
            results = session.query(
                models.DailyUsage.date,
                func.sum(models.DailyUsage.energy_used).label("total_energy"),
                func.sum(models.DailyUsage.cost).label("total_cost")
            ).filter(
                models.DailyUsage.project_id == project_id,
                models.DailyUsage.date >= start_str,
                models.DailyUsage.date <= end_str
            ).group_by(models.DailyUsage.date).order_by(models.DailyUsage.date).all()
            
            # Fill missing days with 0
            history_map = {r.date: r for r in results}
            final_data = []
            
            current = start_date
            while current <= end_date:
                d_str = current.strftime("%Y-%m-%d")
                row = history_map.get(d_str)
                final_data.append({
                    "date": d_str,
                    "total_energy": row.total_energy if row else 0.0,
                    "total_cost": row.total_cost if row else 0.0
                })
                current += timedelta(days=1)
            
            return final_data
        finally:
            if session:
                session.close()
