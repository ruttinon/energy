import sys
sys.path.insert(0, r"C:\Users\promb\Desktop\energylink3 - mobile")
from services.backend.api.billing import database, models
from datetime import datetime, timedelta
s = database.get_project_session('CPRAM-639ec8')
inv = models.Invoice(project_id='CPRAM-639ec8', target_id='DEV-TEST', target_name='Test Device', scope='device', billing_month='2026-02', amount=150.0, due_date=(datetime.now()+timedelta(days=7)).strftime('%Y-%m-%d'), invoice_number='INV-MANUAL-TEST')
s.add(inv)
s.commit()
print('Created invoice id', inv.id)
s.close()
