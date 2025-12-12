import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from .billing_storage import upsert_daily_usage, get_daily_records, get_monthly_records, get_yearly_records
from services.backend.api.xlsx_storage import save_billing_daily, save_billing_weekly, save_billing_monthly, save_billing_yearly
from services.backend.api.xlsx_storage import generate_monthly_summary

print(f"[Billing] Module Loaded: {datetime.now()}")

# Path helper
def _get_project_config_path(project_id: str) -> str:
    return os.path.join(
        "projects", project_id, "billing", "config.json"
    )

def _get_readings_path(project_id: str) -> str:
    return os.path.join(
        "projects", project_id, "data", "readings.json"
    )

def _get_project_config(project_id: str) -> Dict:
    path = os.path.join("projects", project_id, "ConfigDevice.json")
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}

# Config Logic
def get_billing_config(project_id: str) -> Dict:
    path = _get_project_config_path(project_id)
    default_config = {"price_per_unit": 5.0, "currency": "THB"}
    
    if not os.path.exists(path):
        return default_config
    
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[Billing] Error reading config: {e}")
        return default_config

def update_billing_config(project_id: str, config: Dict) -> bool:
    path = _get_project_config_path(project_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[Billing] Error saving config: {e}")
        return False

# Calculation Logic
def sync_billing_for_project(project_id: str, readings: Dict = None):
    """
    Syncs current readings to the billing database for today.
    Should be called periodically or on-demand.
    """
    # 1. Get Config (Price)
    cfg = get_billing_config(project_id)
    price = float(cfg.get("price_per_unit", 5.0))
    
    # 2. Get Current Readings
    if not readings:
        # Fallback: try to read from project readings.json
        try:
            path = _get_readings_path(project_id)
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    readings = json.load(f) or {}
        except Exception as e:
            readings = None
    if not readings:
        return

    # Debug
    # print(f"[Billing] Syncing {len(readings)} devices for {project_id}")

    today = datetime.now().strftime("%Y-%m-%d")
    
    # 3. Get Yesterday's Data/Initial State if needed (Logic simplified for resilience)
    # We will fetch today's current DB record to compare or update
    
    existing_today = {r['device_id']: r for r in get_daily_records(project_id, today)}
    dev_cfg = _get_project_config(project_id)
    device_map = {}
    for conv in dev_cfg.get('converters', []):
        for d in conv.get('devices', []):
            device_map[str(d['id'])] = d.get('name', str(d['id']))
    
    for device_id, data in readings.items():
         # Extract Active Energy
        values = data.get("values", {})
        ae = None
        
        # Try common keys
        for k in ["ActiveEnergy_kWh", "ActiveEnergy", "TotalActiveEnergy", "kWh", "active_energy", "energy"]:
            if k in values and values[k] is not None:
                try:
                    ae = float(values[k])
                    print(f"[Billing] Found energy for {device_id}: {ae} (key={k})")
                    break
                except:
                    pass
        
        if ae is None:
            # Debug: List available keys if energy not found
            # print(f"[Billing] No energy key found for {device_id}. Keys: {list(values.keys())}")
            continue
            
        # Logic:
        # If record exists today: meter_start is already set. meter_end = ae. used = end - start.
        # If no record today: try to find start from yesterday? OR just initialize start = ae (0 usage first tick)
        
        rec = existing_today.get(device_id)
        
        if rec:
            meter_start = rec['meter_start']
            # Reset detection?
            if ae < meter_start: 
                # Meter reset or replaced
                meter_start = ae 
                
            meter_end = ae
            energy_used = max(0, meter_end - meter_start)
            cost = energy_used * price
            
            upsert_daily_usage(project_id, device_id, today, energy_used, cost, meter_start, meter_end, price)
            try:
                save_billing_daily(project_id, {
                    'date': today,
                    'device_id': device_id,
                    'device_name': device_map.get(str(device_id), str(device_id)),
                    'meter_start': meter_start,
                    'meter_end': meter_end,
                    'energy_used': energy_used,
                    'price_per_unit': price,
                    'cost': cost,
                    'last_update': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
            except Exception:
                pass
        else:
            # First time seeing this device today
            # ideally check yesterday's end. For now, simpliest approach: 
            # If we call this frequently, the "first tick" of the day sets the start.
            # If we miss 00:00, we miss usage involved before the first tick.
            # For robustness, we assume start = ae (0 usage) initally, unless we have yesterday records.
            # (In a real production system we'd query `date=yesterday`)
            
            # Simple Init
            upsert_daily_usage(project_id, device_id, today, 0.0, 0.0, ae, ae, price)
            try:
                save_billing_daily(project_id, {
                    'date': today,
                    'device_id': device_id,
                    'device_name': device_map.get(str(device_id), str(device_id)),
                    'meter_start': ae,
                    'meter_end': ae,
                    'energy_used': 0.0,
                    'price_per_unit': price,
                    'cost': 0.0,
                    'last_update': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
            except Exception:
                pass

def get_all_bills_today(project_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    recs = get_daily_records(project_id, today)
    dev_config = _get_project_config(project_id)
    device_map = {}
    for conv in dev_config.get('converters', []):
        for d in conv.get('devices', []):
            device_map[str(d['id'])] = d.get('name', str(d['id']))
    items = []
    for r in recs:
        did = r['device_id']
        items.append({
            "device_id": did,
            "device_name": device_map.get(did, did),
            "date": today,
            "meter_start": r['meter_start'],
            "meter_end": r['meter_end'],
            "energy_used": r['energy_used'],
            "total_money": r['cost'],
            "price_per_unit": r.get('price_per_unit', 0),
            "last_update": r.get('last_update')
        })
    return items

def get_device_bill(project_id: str, device_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    recs = get_daily_records(project_id, today)
    dev_config = _get_project_config(project_id)
    device_map = {}
    for conv in dev_config.get('converters', []):
        for d in conv.get('devices', []):
            device_map[str(d['id'])] = d.get('name', str(d['id']))
    for r in recs:
        if str(r['device_id']) == str(device_id):
            did = r['device_id']
            return {
                "device_id": did,
                "device_name": device_map.get(did, did),
                "date": today,
                "meter_start": r['meter_start'],
                "meter_end": r['meter_end'],
                "energy_used": r['energy_used'],
                "total_money": r['cost'],
                "price_per_unit": r.get('price_per_unit', 0),
                "last_update": r.get('last_update')
            }
    return None

def export_billing_to_excel_today(project_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    recs = get_daily_records(project_id, today)
    dev_config = _get_project_config(project_id)
    device_map = {}
    for conv in dev_config.get('converters', []):
        for d in conv.get('devices', []):
            device_map[str(d['id'])] = d.get('name', str(d['id']))
    for r in recs:
        try:
            save_billing_daily(project_id, {
                'date': today,
                'device_id': r['device_id'],
                'device_name': device_map.get(str(r['device_id']), str(r['device_id'])),
                'meter_start': r['meter_start'],
                'meter_end': r['meter_end'],
                'energy_used': r['energy_used'],
                'price_per_unit': r.get('price_per_unit', 0),
                'cost': r['cost'],
                'last_update': r.get('last_update')
            })
        except Exception:
            pass
    now = datetime.now()
    try:
        generate_monthly_summary(project_id, now.strftime('%Y'), now.strftime('%m'))
    except Exception:
        pass

def export_billing_aggregates(project_id: str):
    dev_config = _get_project_config(project_id)
    device_map = {}
    for conv in dev_config.get('converters', []):
        for d in conv.get('devices', []):
            device_map[str(d['id'])] = d.get('name', str(d['id']))
    year = datetime.now().strftime("%Y")
    # Weekly per device
    from .billing_storage import get_weekly_records, get_monthly_records, get_yearly_records
    wrecs = get_weekly_records(project_id, year)
    for w in wrecs:
        save_billing_weekly(project_id, year, w['week'], str(w['device_id']), device_map.get(str(w['device_id']), str(w['device_id'])), w['total_energy'], w['total_cost'])
    # Monthly per device for current month
    month = datetime.now().strftime('%Y-%m')
    mrecs = get_monthly_records(project_id, month)
    for m in mrecs:
        save_billing_monthly(project_id, month, str(m['device_id']), device_map.get(str(m['device_id']), str(m['device_id'])), m['total_energy'], m['total_cost'])
    # Yearly total across months
    yrecs = get_yearly_records(project_id, year)
    total_energy = sum(r['total_energy'] or 0 for r in yrecs)
    total_cost = sum(r['total_cost'] or 0 for r in yrecs)
    save_billing_yearly(project_id, year, datetime.now().strftime('%m'), total_energy, total_cost)

def get_dashboard_summary(project_id: str):
    """
    Returns summary for Today vs This Month
    """
    today = datetime.now().strftime("%Y-%m-%d")
    month = today[:7]
    
    today_recs = get_daily_records(project_id, today)
    month_recs = get_monthly_records(project_id, month)
    
    valid_today = [r for r in today_recs if r['energy_used'] > 0 or r['cost'] > 0]
    
    today_units = sum(r['energy_used'] for r in today_recs)
    today_cost = sum(r['cost'] for r in today_recs)
    
    month_units = sum(r['total_energy'] for r in month_recs)
    month_cost = sum(r['total_cost'] for r in month_recs)
    
    return {
        "today_units": round(today_units, 3),
        "today_money": round(today_cost, 2),
        "month_units": round(month_units, 3),
        "month_money": round(month_cost, 2),
        "device_count": len(valid_today)
    }

def get_device_usage_list(project_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    recs = get_daily_records(project_id, today)
    
    # Enrich with device names from Config
    dev_config = _get_project_config(project_id)
    device_map = {}
    for conv in dev_config.get('converters', []):
        for d in conv.get('devices', []):
            device_map[str(d['id'])] = d.get('name', str(d['id']))

    result = {}
    for r in recs:
        did = r['device_id']
        result[did] = {
            "device_name": device_map.get(did, did),
            "meter_now": r['meter_end'],
            "total_used_today": r['energy_used'],
            "money_today": r['cost'],
            "last_update": r['last_update']
        }

    # Include offline or no-reading devices with zeros
    for did, dname in device_map.items():
        if did not in result:
            result[did] = {
                "device_name": dname,
                "meter_now": 0.0,
                "total_used_today": 0.0,
                "money_today": 0.0,
                "last_update": None
            }
    return result

def get_convertor_summary_list(project_id: str):
    today = datetime.now().strftime("%Y-%m-%d")
    month = today[:7]
    
    today_recs = get_daily_records(project_id, today)
    month_recs = get_monthly_records(project_id, month)
    
    # Need to group by converter
    dev_config = _get_project_config(project_id)
    
    conv_map = {} # did -> conv_id
    conv_names = {} # conv_id -> name
    conv_devices = {} # conv_id -> [did]
    
    for conv in dev_config.get('converters', []):
        cid = str(conv.get('id', 'unknown'))
        cname = conv.get('name', 'Unknown')
        conv_names[cid] = cname
        conv_devices[cid] = []
        for d in conv.get('devices', []):
            did = str(d['id'])
            conv_map[did] = cid
            conv_devices[cid].append(did)
            
    # Aggregates
    summary = {}
    
    for cid in conv_names:
        summary[cid] = {
            "convertor_name": conv_names[cid],
            "meters": conv_devices[cid],
            "today_units": 0.0,
            "today_money": 0.0,
            "month_units": 0.0,
            "month_money": 0.0
        }
        
    for r in today_recs:
        did = r['device_id']
        cid = conv_map.get(did)
        if cid and cid in summary:
            summary[cid]["today_units"] += r['energy_used']
            summary[cid]["today_money"] += r['cost']
            
    for r in month_recs:
        did = r['device_id']
        cid = conv_map.get(did)
        if cid and cid in summary:
            summary[cid]["month_units"] += r['total_energy']
            summary[cid]["month_money"] += r['total_cost']
            
    return summary
