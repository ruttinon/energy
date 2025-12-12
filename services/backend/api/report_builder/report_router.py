
from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Body, Response
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
import os
import json
import shutil
import io
import csv
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from services.backend.api import xlsx_storage as storage
import openpyxl
from openpyxl.utils import get_column_letter

router = APIRouter()

@router.get("/")
def report_root():
    return {"status": "Report Service OK"}

# ==========================================================
# PATH UTILS
# ==========================================================
# Central templates for now? Or per project?
# User said "store where possible in .xlsx", "project based".
# But templates are usually global or system-wide initially.
# Let's stick to a central template folder for system templates, 
# and maybe project specific outputs.

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # services/backend
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates") # services/backend/api/report_builder/templates
os.makedirs(TEMPLATES_DIR, exist_ok=True)

def get_project_report_dir(project_id: str):
    d = os.path.join(storage.get_data_dir(project_id), "reports")
    os.makedirs(d, exist_ok=True)
    return d

def load_json(path, default=None):
    if default is None: default = {}
    if not os.path.exists(path): return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return default

# ==========================================================
# TEMPLATE MANAGEMENT
# ==========================================================

@router.get("/excel/templates")
def list_excel_templates():
    templates = []
    if os.path.exists(TEMPLATES_DIR):
        for f in os.listdir(TEMPLATES_DIR):
            if f.endswith(".xlsx") and not f.startswith("~$"):
                path = os.path.join(TEMPLATES_DIR, f)
                stat = os.stat(path)
                templates.append({
                    "id": f, 
                    "filename": f,
                    "size": stat.st_size,
                    "modified": stat.st_mtime
                })
    return {"templates": templates}

@router.post("/excel/template/upload")
def upload_excel_template(file: UploadFile = File(...)):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Only .xlsx files allowed")
    
    path = os.path.join(TEMPLATES_DIR, file.filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "ok", "filename": file.filename}

@router.delete("/excel/template/{filename}")
def delete_excel_template(filename: str):
    path = os.path.join(TEMPLATES_DIR, filename)
    if os.path.exists(path):
        os.remove(path)
        return {"status": "ok"}
    raise HTTPException(404, "Template not found")

@router.get("/excel/template/{filename}/content")
def get_template_content(filename: str):
    path = os.path.join(TEMPLATES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Template not found")
    
    try:
        print(f"[EXCEL] Loading template: {path}")
        wb = openpyxl.load_workbook(path, data_only=False) # Keep formulas
        ws = wb.active 
        print(f"[EXCEL] Active sheet: {ws.title}, max_row={ws.max_row}, max_col={ws.max_column}")
        
        data = []
        # Dynamic limits based on content
        # Reduce max limits to prevent frontend lag
        max_row = min(ws.max_row, 100) 
        max_col = min(ws.max_column, 26) 
        
        # Ensure minimal grid (smaller default)
        max_row = max(max_row, 20)
        max_col = max(max_col, 10)

        for row in ws.iter_rows(min_row=1, max_row=max_row, min_col=1, max_col=max_col, values_only=True):
            r_data = []
            for cell in row:
                if cell is None:
                    r_data.append("")
                else:
                    r_data.append(str(cell))
            data.append(r_data)
            
        print(f"[EXCEL] Loaded {len(data)} rows")
        return {"status": "ok", "data": data, "rows": max_row, "cols": max_col}
    except Exception as e:
         print(f"[EXCEL] Error loading {filename}: {e}")
         return JSONResponse({"status": "error", "msg": str(e)}, status_code=500)

@router.post("/excel/template/{filename}/save")
def save_template_content(filename: str, payload: dict = Body(...)):
    path = os.path.join(TEMPLATES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "Template not found")
    
    try:
        wb = openpyxl.load_workbook(path)
        ws = wb.active
        
        grid_data = payload.get("data", [])
        
        for r_idx, row_val in enumerate(grid_data):
            for c_idx, cell_val in enumerate(row_val):
                # 1-based index
                # Only update if changed (optimization) or just overwrite
                # Convert empty string back to None? optional.
                val = cell_val if cell_val != "" else None
                ws.cell(row=r_idx+1, column=c_idx+1, value=val)
                
        wb.save(path)
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse({"status": "error", "msg": str(e)}, status_code=500)



# ==========================================================
# DATA RETRIEVAL (Ported Logic)
# ==========================================================

@router.get("/{project_id}/data/billing")
def get_billing_data(project_id: str, date: str = Query(None), month: str = Query(None)):
    """
    Retrieves billing data for the report, calculated from project files.
    Replaces the old SQLite logic.
    """
    try:
        # 1. Configs
        project_dir = storage.get_project_dir(project_id)
        config_device_path = os.path.join(project_dir, "ConfigDevice.json")
        billing_path = os.path.join(project_dir, "config", "billing.json") # Assuming strict struct? Or root?
        # Fallback to root if config/billing.json not found
        if not os.path.exists(billing_path):
             billing_path = os.path.join(project_dir, "billing.json")

        convertors = {}
        if os.path.exists(config_device_path):
             cd = load_json(config_device_path)
             # Transform to old convertors format if needed, or simply use as is.
             # Old format: { "conv_id": { "devices": { "dev_id": { "name": ... } } } }
             # ConfigDevice.json format: { "converters": [ { "id":..., "devices": [...] } ] }
             for c in cd.get("converters", []):
                 cid = str(c.get("id"))
                 c_devices = {}
                 for d in c.get("devices", []):
                     did = str(d.get("id"))
                     c_devices[did] = {"name": d.get("name"), "model": d.get("model")}
                 convertors[cid] = {"devices": c_devices, "name": c.get("name")}

        billing_config = load_json(billing_path, {"price_per_unit": 5.0})
        price = float(billing_config.get("price_per_unit", 5.0))

        # 2. Determine Date
        target_date = date or datetime.now().strftime("%Y-%m-%d")
        target_month = month # YYYY-MM
        
        # 3. Read Data (From XLSX or Readings)
        # We need daily usage. 
        # Strategy: Read monthly XLSX file. It contains 15-min readings.
        # We can sum up usage or take max-min if it's cumulative.
        # Assuming cumulative 'ActiveEnergy_kWh' or similar.

        dt = datetime.strptime(target_date, "%Y-%m-%d")
        year = str(dt.year)
        mon = f"{dt.month:02d}"
        
        xlsx_file = storage.get_monthly_file(project_id, year, mon)
        
        daily_data = {} # { "YYYY-MM-DD": { ... } }
        
        # Helper: Process Data Frame
        import pandas as pd
        
        if os.path.exists(xlsx_file):
            try:
                df = pd.read_excel(xlsx_file, sheet_name="Readings")
                # Ensure columns: timestamp, device_id, key, value
                # Check for 'key' column structure vs wide structure
                # The xlsx_storage writes wide format: timestamp, device_id, device_name, col1, col2...
                
                # Filter by date
                # The sheet 'Readings' has 'date' column (YYYY-MM-DD)
                if 'date' not in df.columns:
                     # Fallback or empty
                     raise ValueError("'date' column missing in Readings sheet")

                df['date'] = df['date'].astype(str)
                
                # Filter for target date
                # Normalize date column to string YYYY-MM-DD
                # If date is datetime object in pandas
                if pd.api.types.is_datetime64_any_dtype(df['date']):
                    df['date'] = df['date'].dt.strftime('%Y-%m-%d')
                else:
                    df['date'] = df['date'].astype(str).str.strip()

                mask = df['date'] == target_date
                day_df = df[mask]
                
                # Compute usage per device
                devices_summary = {}
                total_used = 0
                
                # Identify Energy Column
                energy_col = next((c for c in df.columns if c.lower() in ['activeenergy_kwh', 'energy', 'kwh', 'total_energy']), None)
                
                if energy_col and not day_df.empty:
                    # Group by device
                    for dev_id, group in day_df.groupby("device_id"):
                        dev_id = str(dev_id)
                        # Get min and max of the day? Or Max(Day) - Max(PrevDay)?
                        # Simple approach: Max - Min of the day.
                        # Robust approach: Max(Day) - Min(Day). 
                        # Only works if we have multiple readings/day.
                        
                        readings_sorted = group.sort_values("timestamp")
                        first = float(readings_sorted.iloc[0][energy_col])
                        last = float(readings_sorted.iloc[-1][energy_col])
                        used = last - first
                        if used < 0: used = 0 # Counter reset?
                        
                        money = used * price
                        total_used += used
                        
                        # Find meta
                        dev_name = str(group.iloc[0].get("device_name", dev_id))
                        # Try to find in config
                        c_id = "unknown"
                        for cid, cdata in convertors.items():
                            if dev_id in cdata.get("devices", {}):
                                c_id = cid
                                dev_name = cdata["devices"][dev_id].get("name") or dev_name
                                break

                        devices_summary[dev_id] = {
                            "device_id": dev_id,
                            "device_name": dev_name,
                            "convertor_id": c_id,
                            "meter_start": round(first, 2),
                            "meter_end": round(last, 2),
                            "total_used_today": round(used, 2),
                            "money_today": round(money, 2)
                        }
                
                daily_data[target_date] = {
                    "devices": devices_summary,
                    "total_units_today": round(total_used, 2),
                    "total_money_today": round(total_used * price, 2)
                }
                
            except Exception as e:
                print(f"Error reading Excel: {e}")
        
        # If no data found (e.g. file missing), return structure with 0s?
        if not daily_data:
             daily_data[target_date] = { "devices": {}, "total_units_today": 0, "total_money_today": 0 }

        return {
            "status": "ok",
            "data": {
                "daily": daily_data,
                "monthly": {}, # ToDo: Calculate if needed
                "billing": billing_config,
                "convertors": convertors
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"status": "error", "msg": str(e)}, status_code=500)

# ==========================================================
# CSV GENERATION (Ported Logic)
# ==========================================================

# ==========================================================
# EXCEL GENERATION (Pandas)
# ==========================================================

@router.post("/report/render/excel")
def render_excel_report(
    template_id: str = Body(...), 
    data: dict = Body(...)
):
    try:
        # Create a BytesIO buffer to write the Excel file
        output = io.BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
        
        # Determine filename
        date_str = data.get('date', 'report')
        
        # 1. Summary Sheet
        summary_data = []
        if 'total_used' in data:
            summary_data.append({"Parameter": "Total Energy (kWh)", "Value": data['total_used']})
        if 'total_money' in data:
            summary_data.append({"Parameter": "Total Cost (THB)", "Value": data['total_money']})
        if 'month_total_units' in data:
            summary_data.append({"Parameter": "Month Total Energy", "Value": data['month_total_units']})
        
        if summary_data:
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name='Summary', index=False)
            
        # 2. Devices Sheet
        devices_list = []
        
        # Extract devices list based on data structure
        if 'devices' in data:
             devices_list = data['devices']
        elif 'converters' in data:
             for c in data['converters']:
                 devices_list.extend(c.get('devices', []))
        
        if devices_list:
            # Flatten the list if needed
            flat_devs = []
            for d in devices_list:
                flat_devs.append({
                    "Device ID": d.get("device_id"),
                    "Name": d.get("device_name"),
                    "Meter Start": d.get("meter_prev") or d.get("meter_start"),
                    "Meter End": d.get("meter_now") or d.get("meter_end"),
                    "Used (kWh)": d.get("used"),
                    "Cost (THB)": d.get("money")
                })
            
            df_devices = pd.DataFrame(flat_devs)
            df_devices.to_excel(writer, sheet_name='Devices', index=False)
            
        # Close writer
        writer.close()
        output.seek(0)
        
        filename = f"report_{template_id}_{date_str}.xlsx"
        
        return StreamingResponse(
            output, 
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"status": "error", "msg": str(e)}, status_code=500)

@router.post("/report/render/csv")
def render_csv_report(
    template_id: str = Body(...), 
    data: dict = Body(...)
):
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write BOM for Excel Thai support
        output.write('\ufeff')
        
        date_str = data.get('date', 'N/A')
        
        # Write Header
        writer.writerow([f"Report Date: {date_str}"])
        if 'total_used' in data:
            writer.writerow(["Total Energy (kWh)", data['total_used']])
        if 'total_money' in data:
            writer.writerow(["Total Cost (THB)", data['total_money']])
        writer.writerow([])
        
        # Extract devices
        devices_list = []
        if 'devices' in data:
             devices_list = data['devices']
        elif 'converters' in data:
             for c in data['converters']:
                 devices_list.extend(c.get('devices', []))
                 
        if devices_list:
            writer.writerow(["Device ID", "Name", "Meter Start", "Meter End", "Used (kWh)", "Cost (THB)"])
            for d in devices_list:
                writer.writerow([
                    d.get("device_id", ""),
                    d.get("device_name", ""),
                    d.get("meter_prev") or d.get("meter_start", 0),
                    d.get("meter_now") or d.get("meter_end", 0),
                    d.get("used", 0),
                    d.get("money", 0)
                ])
        else:
            writer.writerow(["No data found"])
            
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=report_{date_str}.csv"}
        )
    except Exception as e:
         return JSONResponse({"status": "error", "msg": str(e)}, status_code=500)

