from fastapi import APIRouter, HTTPException, Request, Body, Query
from typing import Optional, Dict, List
from .billing_service import (
    get_billing_config, update_billing_config, sync_billing_for_project,
    get_dashboard_summary, get_device_usage_list, get_convertor_summary_list,
    get_yearly_records, get_monthly_records, get_all_bills_today, get_device_bill, export_billing_to_excel_today, export_billing_aggregates
)
from .billing_storage import get_daily_series
from services.backend.api.xlsx_storage import get_billing_summary_from_excel, get_daily_series_from_excel
from services.backend.shared_state import load_active, save_active

router = APIRouter()

def _get_active_project(project_id: str = None):
    if project_id:
        return project_id
    active = load_active().get('active')
    if active:
        return active
    import os
    projects_dir = os.path.join("projects")
    if os.path.isdir(projects_dir):
        for name in os.listdir(projects_dir):
            p = os.path.join(projects_dir, name)
            if os.path.isdir(p):
                save_active(name)
                return name
    raise HTTPException(status_code=400, detail="No active project selected")

# ============================================================
# ⚙️ CONFIGURATION & SYNC
# ============================================================
@router.get("/config")
def api_get_config(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    return get_billing_config(pid)

@router.post("/config")
def api_set_config(payload: dict = Body(...), project_id: Optional[str] = None):
    """
    { "price_per_unit": 5.0, "currency": "THB" }
    """
    pid = _get_active_project(project_id)
    success = update_billing_config(pid, payload)
    if success:
        # Trigger re-calc/sync immediately?? Maybe not full history, just sync current state
        sync_billing_for_project(pid)
        return {"status": "success", "config": payload}
    return {"status": "error", "message": "Failed to save config"}

@router.post("/sync")
def api_force_sync(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    sync_billing_for_project(pid)
    return {"status": "ok", "message": f"Synced billing for {pid}"}

# ============================================================
# 📊 ASHBOARD DATA
# ============================================================
@router.get("/summary")
def api_dashboard_summary(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    # Ensure fresh data?
    # sync_billing_for_project(pid) # Optional: lightweight sync on refresh?
    return {"status": "ok", "data": get_dashboard_summary(pid)}

@router.get("/summary_excel")
def api_dashboard_summary_excel(project_id: Optional[str] = None, year: Optional[str] = None, month: Optional[str] = None):
    pid = _get_active_project(project_id)
    s = get_billing_summary_from_excel(pid, year, month)
    # include legacy keys
    return {
        "status": "ok",
        "data": {
            **s,
            "today_kwh": s.get("today_units", 0.0),
            "month_kwh": s.get("month_units", 0.0),
            "month_cost": s.get("month_money", 0.0),
        }
    }

@router.get("/device_usage")
def api_device_usage(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    return {"status": "ok", "data": get_device_usage_list(pid)}

@router.get("/convertor_summary")
def api_convertor_summary(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    return {"status": "ok", "data": get_convertor_summary_list(pid)}

@router.get("/chart/yearly")
def api_chart_yearly(project_id: Optional[str] = None, year: str = "2025"):
    pid = _get_active_project(project_id)
    records = get_yearly_records(pid, year)
    
    # Format for chart
    result = []
    for r in records:
        result.append({
            "month": r['month'],
            "value": r['total_energy'],
            "cost": r['total_cost']
        })
    return {"status": "ok", "data": result}

@router.get("/chart/daily")
def api_chart_daily(project_id: Optional[str] = None, month: Optional[str] = None):
    pid = _get_active_project(project_id)
    if not month:
        today = __import__("datetime").datetime.now().strftime("%Y-%m")
        month = today
    records = get_daily_series(pid, month)
    result = [{"day": r['day'], "value": r['total_energy'], "cost": r['total_cost']} for r in records]
    return {"status": "ok", "data": result}

@router.get("/chart/daily_excel")
def api_chart_daily_excel(project_id: Optional[str] = None, month: Optional[str] = None):
    pid = _get_active_project(project_id)
    if not month:
        month = __import__("datetime").datetime.now().strftime("%Y-%m")
    records = get_daily_series_from_excel(pid, month)
    result = [{"day": r['day'], "value": r['total_energy'], "cost": r['total_cost']} for r in records]
    return {"status": "ok", "data": result}

@router.get("/chart/monthly")
def api_chart_monthly(project_id: Optional[str] = None, year: Optional[str] = None):
    pid = _get_active_project(project_id)
    if not year:
        year = __import__("datetime").datetime.now().strftime("%Y")
    records = get_yearly_records(pid, year)
    result = [{"month": r['month'], "value": r['total_energy'], "cost": r['total_cost']} for r in records]
    return {"status": "ok", "data": result}


# ============================================================
# 💰 LEGACY COMPATIBILITY (Wrappers)
# ============================================================
@router.get("/get_price") 
def legacy_get_price(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    cfg = get_billing_config(pid)
    return {"status": "ok", "price_per_unit": cfg.get("price_per_unit", 0)}

@router.get("/price") 
def legacy_price(project_id: Optional[str] = None):
    return legacy_get_price(project_id)

@router.post("/set_price")
def legacy_set_price(payload: dict = Body(...), project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    price = float(payload.get("price", 0))
    update_billing_config(pid, {"price_per_unit": price})
    try:
        sync_billing_for_project(pid)
    except Exception:
        pass
    return {"status": "success", "price": price}

@router.get("/total_summary")
def legacy_total_summary(project_id: Optional[str] = None):
    # Map directly to new summary
    return api_dashboard_summary(project_id)

# ============================================================
# 🧾 BILLS & HISTORY (for frontend compatibility)
# ============================================================
@router.get("/all_bills")
def api_all_bills(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    return {"status": "ok", "data": get_all_bills_today(pid)}

@router.get("/device_bill/{device_id}")
def api_device_bill(device_id: str, project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    bill = get_device_bill(pid, device_id)
    if not bill:
        raise HTTPException(status_code=404, detail="No bill for device today")
    return {"status": "ok", "data": bill}

@router.get("/history")
def api_history(project_id: Optional[str] = None, month: Optional[str] = None, year: Optional[str] = None):
    pid = _get_active_project(project_id)
    # Monthly per-device totals
    if month:
        recs = get_monthly_records(pid, month)
        # Enrich with name and normalize keys for frontend
        from .billing_service import _get_project_config
        dev_config = _get_project_config(pid)
        name_map = {}
        for conv in dev_config.get('converters', []):
            for d in conv.get('devices', []):
                name_map[str(d['id'])] = d.get('name', str(d['id']))
        out = []
        for r in recs:
            did = r['device_id']
            out.append({
                "device_id": did,
                "device_name": name_map.get(did, did),
                "energy_used": r['total_energy'],
                "total_cost": r['total_cost'],
                "meter_start": r.get('meter_start_month'),
                "meter_end": r.get('meter_end_month'),
                "month": month
            })
        return {"status": "ok", "data": out}
    # Yearly monthly series
    y = year or __import__("datetime").datetime.now().strftime("%Y")
    recs = get_yearly_records(pid, y)
    out = [{"month": r['month'], "energy_used": r['total_energy'], "total_cost": r['total_cost']} for r in recs]
    return {"status": "ok", "data": out}

# ============================================================
# 📤 Export today's billing rows to Excel
# ============================================================
@router.post("/export_excel_today")
def api_export_excel_today(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    export_billing_to_excel_today(pid)
    return {"status": "ok", "message": "Exported today's billing to Excel"}

@router.post("/export_excel_aggregates")
def api_export_excel_aggregates(project_id: Optional[str] = None):
    pid = _get_active_project(project_id)
    export_billing_aggregates(pid)
    return {"status": "ok", "message": "Exported weekly/monthly/yearly aggregates to Excel"}
