from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Dict, Optional, Any
import os
import sys
import json
import shutil
from urllib.parse import unquote
import sqlite3
import time
from datetime import datetime
# from services.backend.api import xlsx_storage as storage # REMOVED
from services.backend.shared_state import READINGS

# Determine ROOT for Resources
if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
else:
    ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

RESOURCES_DIR = os.path.join(ROOT, 'resources')

router = APIRouter()

# ==========================================================
# PATH UTILS (Project/PID based)
# ==========================================================
def get_project_dir(project_id: str):
    # Determine projects root dynamically like elsewhere
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))) # backend/api/photoview -> projects?
    # No, backend/api/photoview.py -> backend/api -> backend -> services -> root? 
    # Use standard lookup
    if getattr(sys, 'frozen', False):
        root = os.path.dirname(sys.executable)
    else:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
    
    return os.path.join(root, 'projects', project_id)

def get_data_dir_placeholder(project_id: str):
    return os.path.join(get_project_dir(project_id), 'data') # Approx


def get_photoview_dir(project_id: str):
    root = get_project_dir(project_id)
    preferred = os.path.join(root, "data", "photoview")
    legacy = os.path.join(root, "photoview")
    try:
        if os.path.isdir(os.path.join(root, "data")) or os.path.isdir(preferred):
            os.makedirs(preferred, exist_ok=True)
            return preferred
    except Exception:
        pass
    os.makedirs(legacy, exist_ok=True)
    return legacy

def get_upload_dir(project_id: str):
    d = os.path.join(get_photoview_dir(project_id), "uploads")
    os.makedirs(d, exist_ok=True)
    return d

def get_pages_file(project_id: str):
    return os.path.join(get_photoview_dir(project_id), "pages.json")

def style_file_path(project_id: str, page_id: str):
    d = os.path.join(get_photoview_dir(project_id), "styles")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"style_{page_id}.json")

def marker_file_path(project_id: str, page_id: str):
    return os.path.join(get_photoview_dir(project_id), f"markers_{page_id}.json")

def drawing_file_path(project_id: str, page_id: str):
    # This file will now store the entire Fabric.js canvas JSON
    return os.path.join(get_photoview_dir(project_id), f"drawings_{page_id}.json")

def telemetry_db_path(project_id: str, ts: Optional[int] = None):
    """
    Store telemetry per month under projects/<pid>/data/<YYYY>/telemetry_YYYY_MM.db
    """
    if ts is None:
        ts = int(time.time() * 1000)
    dt = datetime.fromtimestamp(ts / 1000.0)
    year_dir = os.path.join(get_project_dir(project_id), "data", f"{dt.year}")
    os.makedirs(year_dir, exist_ok=True)
    return os.path.join(year_dir, f"telemetry_{dt.year:04d}_{dt.month:02d}.db")

def ensure_telemetry(project_id: str, ts: Optional[int] = None):
    path = telemetry_db_path(project_id, ts)
    conn = sqlite3.connect(path)
    try:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            ts INTEGER NOT NULL,
            device_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            PRIMARY KEY (ts, device_id, key)
        )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_readings_device_key_ts ON readings(device_id, key, ts)")
        conn.commit()
    finally:
        conn.close()
    return path

# ==========================================================
# JSON HELPERS
# ==========================================================
def load_json(path, default=None):
    if default is None: default = {}
    if not os.path.exists(path): return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        # If file is empty or corrupted, return default
        return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def ensure_file(path, default_content):
    if not os.path.exists(path):
        save_json(path, default_content)
    return path

# Default empty canvas state for Fabric.js
EMPTY_CANVAS = {"version": "5.3.0", "objects": []}

# ==========================================================
# API ENDPOINTS
# ==========================================================

# --- PAGES ---

@router.get("/{project_id}/pages")
def list_pages(project_id: str):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    # Ensure ancillary files exist for each page
    for p in pages:
        ensure_file(marker_file_path(project_id, p["id"]), [])
        ensure_file(drawing_file_path(project_id, p["id"]), EMPTY_CANVAS)
    return {"pages": pages}

@router.post("/{project_id}/create_page")
def create_page(
    project_id: str,
    name: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    existing_image: Optional[str] = Form(None),
    width: Optional[str] = Form(None),
    height: Optional[str] = Form(None),
    bg: Optional[str] = Form(None),
):
    print(f"[CreatePage] Received: name={name}, file={file.filename if file else None}, w={width}, h={height}, bg={bg}")
    
    # robust name handling
    final_name = name
    if not final_name and file and file.filename:
        final_name = os.path.splitext(file.filename)[0]
    
    if not final_name:
        # Emergency fallback or error
        raise HTTPException(400, "Missing page name")

    # Determine creation mode
    from_image_mode = bool(file and file.filename) or bool(existing_image)
    if from_image_mode and not (file and file.filename) and not existing_image:
        raise HTTPException(400, "Missing image file or selection")
    if not from_image_mode and not (width or height):
        # Blank page must have at least one dimension provided (we will default the other)
        raise HTTPException(400, "Missing width/height for blank page")

    page_id = final_name.lower().replace(" ", "_").replace("(", "").replace(")", "")
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    
    # Ensure unique ID
    if any(p["id"] == page_id for p in pages):
        base = page_id
        idx = 2
        while any(p["id"] == f"{base}-{idx}" for p in pages):
            idx += 1
            if idx > 100: break # Safety break
        page_id = f"{base}-{idx}"

    image_filename = None
    if file is not None and file.filename:
        upload_dir = get_upload_dir(project_id)
        ext = os.path.splitext(file.filename)[1].lower() or '.png'
        image_filename = f"{page_id}{ext}"
        file_path = os.path.join(upload_dir, image_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    elif existing_image:
        # Use existing file as reference if it exists in uploads
        upload_dir = get_upload_dir(project_id)
        cand = os.path.join(upload_dir, existing_image)
        if not os.path.exists(cand):
            raise HTTPException(400, f"Selected image not found: {existing_image}")
        image_filename = os.path.basename(existing_image)

    new_page = {"id": page_id, "name": final_name, "image": image_filename}
    pages.append(new_page)
    save_json(pages_file, pages)

    # Create ancillary files
    ensure_file(marker_file_path(project_id, page_id), [])
    ensure_file(drawing_file_path(project_id, page_id), EMPTY_CANVAS)
    
    # Style logic
    style_path = style_file_path(project_id, page_id)
    
    # Robust int parsing
    def safe_int(v, default=None):
        try:
            return int(float(v)) if v else default
        except:
            return default
            
    w_val = safe_int(width)
    h_val = safe_int(height)
    
    style_payload = {}
    
    # Always save style if any param is present, or if it's a blank page (no image)
    if not image_filename or (w_val and h_val):
        # Default for blank page if missing
        if not w_val: w_val = 1920
        if not h_val: h_val = 1080
        
        style_payload = {"canvas": {"width": w_val, "height": h_val}}
        if bg:
            style_payload["canvas"]["backgroundColor"] = bg
            
    ensure_file(style_path, style_payload)

    return {"status": "ok", "page": new_page, "next": {"page_id": page_id}}

@router.post("/{project_id}/telemetry/ingest")
def ingest_readings(project_id: str, payload: Dict[str, Any] = Body(...)):
    """
    payload: { device_id: str, ts?: int(ms), values: { key: value, ... } }
    """
    device_id = str(payload.get("device_id") or "")
    values = payload.get("values") or {}
    ts = int(payload.get("ts") or int(time.time() * 1000))
    if not device_id or not isinstance(values, dict):
        raise HTTPException(400, "Invalid payload")
    ensure_telemetry(project_id, ts)
    conn = sqlite3.connect(telemetry_db_path(project_id, ts))
    try:
        cur = conn.cursor()
        for k, v in values.items():
            cur.execute("INSERT OR REPLACE INTO readings (ts, device_id, key, value) VALUES (?, ?, ?, ?)",
                        (ts, device_id, str(k), str(v)))
        conn.commit()
    finally:
        conn.close()
    return {"status": "ok"}

def _month_range(frm_ts: int, to_ts: int):
    frm = datetime.fromtimestamp(frm_ts / 1000.0)
    to = datetime.fromtimestamp(to_ts / 1000.0)
    months = []
    y, m = frm.year, frm.month
    while (y < to.year) or (y == to.year and m <= to.month):
        months.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months

@router.post("/{project_id}/readings/batch")
def get_readings_batch(project_id: str, device_ids: List[str] = Body(...)):
    """
    Returns latest readings per device_id for provided list
    Response: { data: { device_id: { key: value, ... }, ... } }
    """
    ids = [str(i) for i in (device_ids or [])]
    res: Dict[str, Dict[str, Any]] = {i: {} for i in ids}
    if not ids:
        return {"data": res}
    # Search current and previous month to find latest
    now_ms = int(time.time() * 1000)
    months_to_check = []
    dt = datetime.fromtimestamp(now_ms / 1000.0)
    months_to_check.append((dt.year, dt.month))
    prev_y = dt.year if dt.month > 1 else dt.year - 1
    prev_m = dt.month - 1 if dt.month > 1 else 12
    months_to_check.append((prev_y, prev_m))
    for (y, m) in months_to_check:
        db_path = os.path.join(get_project_dir(project_id), "data", f"{y}", f"telemetry_{y:04d}_{m:02d}.db")
        if not os.path.exists(db_path): 
            continue
        conn = sqlite3.connect(db_path)
        try:
            cur = conn.cursor()
            for did in ids:
                cur.execute("""
                    SELECT key, value FROM readings
                    WHERE device_id = ?
                    AND ts = (SELECT MAX(ts) FROM readings WHERE device_id = ?)
                """, (did, did))
                for key, val in cur.fetchall():
                    res[did][key] = val
        finally:
            conn.close()
    return {"data": res}

@router.get("/{project_id}/telemetry/history")
def history(project_id: str, device_id: str, key: str, frm: Optional[int] = None, to: Optional[int] = None, limit: int = 500):
    """
    Query historical readings by device_id and key.
    """
    rows: List[Dict[str, Any]] = []
    if frm is None and to is None:
        # default: current month only
        frm = int(time.time() * 1000)
        to = frm
    if frm is None:
        frm = to
    if to is None:
        to = frm
    for (y, m) in _month_range(int(frm), int(to)):
        db_path = os.path.join(get_project_dir(project_id), "data", f"{y}", f"telemetry_{y:04d}_{m:02d}.db")
        if not os.path.exists(db_path):
            continue
        conn = sqlite3.connect(db_path)
        try:
            cur = conn.cursor()
            params: List[Any] = [device_id, key]
            where = "device_id = ? AND key = ?"
            if frm is not None:
                where += " AND ts >= ?"
                params.append(int(frm))
            if to is not None:
                where += " AND ts <= ?"
                params.append(int(to))
            cur.execute(f"SELECT ts, value FROM readings WHERE {where} ORDER BY ts DESC LIMIT ?", (*params, int(limit)))
            rows += [{"ts": ts, "value": val} for ts, val in cur.fetchall()]
        finally:
            conn.close()
    rows.sort(key=lambda r: r["ts"], reverse=True)
    rows = rows[:int(limit)]
    return {"status": "ok", "data": rows}

# Alias for add_page (from logic in api_photoview.py)
@router.post("/{project_id}/add_page")
def add_page(project_id: str, page_name: str = Form(...), file: UploadFile = File(...)):
    return create_page(project_id, page_name, file)


@router.post("/{project_id}/delete_page/{page_id}")
def delete_page(project_id: str, page_id: str):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    
    page = next((p for p in pages if p["id"] == page_id), None)
    if not page: raise HTTPException(404, "Page not found")
    
    # Remove from list
    pages = [p for p in pages if p["id"] != page_id]
    save_json(pages_file, pages)
    
    # Delete associated files
    try:
        os.remove(marker_file_path(project_id, page_id))
        os.remove(drawing_file_path(project_id, page_id))
        os.remove(style_file_path(project_id, page_id))
        if page.get("image"):
            img_path = os.path.join(get_upload_dir(project_id), page["image"])
            if os.path.exists(img_path): os.remove(img_path)
    except OSError:
        pass # Ignore file not found errors
        
    return {"status": "ok"}

@router.post("/{project_id}/rename_page")
def rename_page(project_id: str, page_id: str = Body(...), new_name: str = Body(...)):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    for p in pages:
        if str(p.get("id")) == str(page_id):
            p["name"] = new_name
            save_json(pages_file, pages)
            return {"status": "ok", "page": p}
    raise HTTPException(404, "Page not found")

@router.post("/{project_id}/update_image")
def update_image(project_id: str, page_id: str = Form(...), file: UploadFile = File(...)):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    page = next((p for p in pages if str(p.get("id")) == str(page_id)), None)
    if not page:
        raise HTTPException(404, "Page not found")
    upload_dir = get_upload_dir(project_id)
    filename = file.filename
    path = os.path.join(upload_dir, filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    page["image"] = filename
    save_json(pages_file, pages)
    return {"status": "ok", "page": page}

@router.post("/{project_id}/set_image")
def set_image(project_id: str, page_id: str = Form(...), filename: str = Form(...)):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    page = next((p for p in pages if str(p.get("id")) == str(page_id)), None)
    if not page:
        raise HTTPException(404, "Page not found")
    upload_dir = get_upload_dir(project_id)
    cand = os.path.join(upload_dir, filename)
    if not os.path.exists(cand):
        raise HTTPException(400, f"Selected image not found: {filename}")
    page["image"] = os.path.basename(filename)
    save_json(pages_file, pages)
    return {"status": "ok", "page": page}

@router.post("/{project_id}/clear_image")
def clear_image(project_id: str, page_id: str = Form(...)):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    page = next((p for p in pages if str(p.get("id")) == str(page_id)), None)
    if not page:
        raise HTTPException(404, "Page not found")
    page["image"] = None
    save_json(pages_file, pages)
    return {"status": "ok", "page": page}

# --- MARKERS (Unchanged) ---

@router.get("/{project_id}/markers/{page_id}")
def get_markers(project_id: str, page_id: str):
    path = ensure_file(marker_file_path(project_id, page_id), [])
    return load_json(path, [])

@router.post("/{project_id}/add_marker/{page_id}")
def add_marker(project_id: str, page_id: str, marker: dict = Body(...)):
    path = ensure_file(marker_file_path(project_id, page_id), [])
    arr = load_json(path, [])
    arr.append(marker)
    save_json(path, arr)
    return {"status": "ok"}

@router.post("/{project_id}/update_marker/{page_id}/{index}")
def update_marker(project_id: str, page_id: str, index: int, marker: dict = Body(...)):
    path = marker_file_path(project_id, page_id)
    arr = load_json(path, [])
    if 0 <= index < len(arr):
        arr[index] = marker
        save_json(path, arr)
        return {"status": "ok"}
    raise HTTPException(400, "Index out of range")

@router.delete("/{project_id}/delete_marker/{page_id}/{index}")
def delete_marker(project_id: str, page_id: str, index: int):
    path = marker_file_path(project_id, page_id)
    arr = load_json(path, [])
    if 0 <= index < len(arr):
        arr.pop(index)
        save_json(path, arr)
        return {"status": "ok"}
    raise HTTPException(400, "Index out of range")

# --- DRAWINGS (REVISED FOR FABRIC.JS CANVAS) ---

@router.get("/{project_id}/drawings/{page_id}")
def get_drawings(project_id: str, page_id: str):
    """
    Retrieves the entire Fabric.js canvas data for a page.
    """
    path = ensure_file(drawing_file_path(project_id, page_id), EMPTY_CANVAS)
    return load_json(path, EMPTY_CANVAS)

@router.post("/{project_id}/drawings/{page_id}")
def save_drawings(project_id: str, page_id: str, canvas_data: Any = Body(...)):
    """
    Saves the entire Fabric.js canvas data for a page.
    The request body should be the JSON output from canvas.toJSON().
    """
    path = drawing_file_path(project_id, page_id)
    save_json(path, canvas_data)
    return {"status": "ok", "message": "Canvas state saved."}


# --- STYLES (Unchanged) ---

@router.get("/{project_id}/get_style/{page_id}")
def get_style(project_id: str, page_id: str):
    path = style_file_path(project_id, page_id)
    return {"status": "ok", "style": load_json(path, {})}

@router.post("/{project_id}/save_style/{page_id}")
def save_style(project_id: str, page_id: str, style: dict = Body(...)):
    path = style_file_path(project_id, page_id)
    save_json(path, style)
    return {"status": "ok"}

# --- IMAGES / ASSETS (Unchanged) ---

@router.get("/{project_id}/images/{filename}")
def get_image(project_id: str, filename: str):
    # Decode percent-encoded filename and try multiple fallbacks
    upload_dir = get_upload_dir(project_id)
    candidates = []
    decoded = unquote(filename)
    candidates.append(os.path.join(upload_dir, decoded))
    if decoded != filename:
        candidates.append(os.path.join(upload_dir, filename))
    # Fallback: try case-insensitive match in directory
    try:
        files = os.listdir(upload_dir)
        lower_map = {f.lower(): f for f in files}
        lf = lower_map.get(decoded.lower())
        if lf:
            candidates.append(os.path.join(upload_dir, lf))
    except Exception:
        pass
    for p in candidates:
        if p and os.path.exists(p):
            return FileResponse(p)
            
    # Fallback to Global Resources (for device images like DIRIS A-20.png)
    # Check resources/devices/...
    # Check resources/...
    res_candidates = []
    # clean filename (remove path traversal)
    clean_name = os.path.basename(filename) 
    
    # 1. Direct match in resources
    res_candidates.append(os.path.join(RESOURCES_DIR, clean_name))
    
    # 2. Match in resources/devices
    res_candidates.append(os.path.join(RESOURCES_DIR, "devices", clean_name))
    
    # 3. Recursive search in resources/devices if needed (e.g. socomec/DIRIS A-20.png)
    # But usually filename here is just "DIRIS A-20.png"
    # We will search recursively in resources/devices for this filename
    for root, _, files in os.walk(os.path.join(RESOURCES_DIR, "devices")):
        if clean_name in files:
            res_candidates.append(os.path.join(root, clean_name))
            
    for p in res_candidates:
        if p and os.path.exists(p):
            return FileResponse(p)
            
    raise HTTPException(404, f"Image not found: {filename}")

# --- DEVICE & DATA ENDPOINTS (Unchanged) ---
# (The rest of your endpoints: upload_icon, icon_list, device_list, device_params, device_data, etc. remain the same)
@router.post("/{project_id}/upload_icon")
def upload_icon(project_id: str, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg')):
        raise HTTPException(400, "Invalid file type")
    filename = file.filename
    upload_dir = get_upload_dir(project_id)
    path = os.path.join(upload_dir, filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "ok", "filename": filename}

@router.get("/{project_id}/icon_list")
def icon_list(project_id: str):
    d = get_upload_dir(project_id)
    if not os.path.exists(d): return {"status": "ok", "icons": []}
    files = [f for f in os.listdir(d) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg'))]
    return {"status": "ok", "icons": files}

@router.get("/{project_id}/uploads_list")
def uploads_list(project_id: str):
    return icon_list(project_id)

@router.get("/{project_id}/device_list")
def device_list(project_id: str):
    cfg_file = os.path.join(get_project_dir(project_id), "..", "ConfigDevice.json")
    if not os.path.exists(cfg_file): return []
    try:
        data = load_json(cfg_file)
        result = []
        for conv in data.get("converters", []):
            conv_name = conv.get("name") or conv.get("protocol") or "Unknown"
            for dev in conv.get("devices", []):
                if dev.get("id"):
                    result.append({
                        "id": str(dev["id"]),
                        "name": dev.get("name") or dev.get("model") or str(dev["id"]),
                        "model": dev.get("model") or "",
                        "manufacturer": dev.get("manufacturer") or "",
                        "converter": conv_name
                    })
        # Remove duplicates if any (though duplicates with different converters might be valid issues, we'll keep unique ID logic for now but usually IDs should be unique globally)
        seen = set()
        unique_res = []
        for x in result:
             if x["id"] not in seen:
                 seen.add(x["id"])
                 unique_res.append(x)
                 
        return sorted(unique_res, key=lambda x: (x["converter"], x["name"]))
    except:
        return []

@router.get("/{project_id}/device_params/{dev_id}")
def device_params(project_id: str, dev_id: str):
    params_set = set()
    if project_id in READINGS and dev_id in READINGS[project_id]:
        rec = READINGS[project_id][dev_id]
        vals = rec.get('values') or {}
        params_set.update(vals.keys())
    # Other logic to find params can be added here
    if not params_set:
        return {"status": "ok", "device_id": dev_id, "params": []}
    return {
        "status": "ok", 
        "device_id": dev_id, 
        "params": [{"key": k} for k in sorted(list(params_set))]
    }

@router.get("/{project_id}/device_template_registers/{dev_id}")
def device_template_registers(project_id: str, dev_id: str):
    cfg_file = os.path.join(get_project_dir(project_id), "ConfigDevice.json")
    if not os.path.exists(cfg_file):
        return {"status": "ok", "device_id": dev_id, "registers": []}
    try:
        cfg = load_json(cfg_file, {})
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
        
        for conv in cfg.get("converters", []):
            for dev in conv.get("devices", []):
                if str(dev.get("id")) == str(dev_id):
                    # Robust Template Finding
                    candidates = []
                    ref = dev.get("template_ref") or ""
                    
                    # 1. Exact ref path relative to root
                    if ref:
                        candidates.append(os.path.join(root, ref.lstrip("/").lstrip("\\")))
                        # 2. Ref relative to services/backend (legacy)
                        candidates.append(os.path.join(root, "services", "backend", ref.lstrip("/").lstrip("\\")))
                    
                    # 3. Fallback: Manufacturer/Model
                    manu = (dev.get("manufacturer") or "").strip()
                    model = (dev.get("model") or "").strip()
                    if manu and model:
                        candidates.append(os.path.join(root, "services", "backend", "device_templates", manu, f"{model}.json"))
                        
                    template_path = None
                    for p in candidates:
                        if p and os.path.exists(p):
                            template_path = p
                            break
                            
                    if not template_path:
                        # Final attempt: direct name match in subfolders
                        driver = dev.get("driver") or f"{model}.json"
                        if driver:
                            tpl_root = os.path.join(root, "services", "backend", "device_templates")
                            for r, _, files in os.walk(tpl_root):
                                if driver in files:
                                    template_path = os.path.join(r, driver)
                                    break

                    if (not template_path) or (not os.path.exists(template_path)):
                        return {"status": "ok", "device_id": dev_id, "registers": []}
                        
                    tpl = load_json(template_path, {})
                    regs = tpl.get("registers", [])
                    keys = []
                    for r in regs:
                        k = r.get("key")
                        if k:
                            keys.append({"key": k, "address": r.get("address"), "unit": r.get("unit")})
                    return {"status": "ok", "device_id": dev_id, "registers": keys}
        return {"status": "ok", "device_id": dev_id, "registers": []}
    except Exception as e:
        print(f"Error finding template: {e}")
        return {"status": "ok", "device_id": dev_id, "registers": []}

@router.get("/{project_id}/device_data/{dev_id}")
def device_data(project_id: str, dev_id: str):
    if project_id in READINGS and dev_id in READINGS.get(project_id, {}):
        rec = READINGS[project_id][dev_id]
        return {"status": "ok", "data": rec.get("values", {})}
    return {"status": "error", "msg": "No data found or device offline"}

@router.get("/{project_id}/converter_ping/{conv_name}")
def converter_ping(project_id: str, conv_name: str):
    cfg_file = os.path.join(get_project_dir(project_id), "ConfigDevice.json")
    if not os.path.exists(cfg_file):
        return {"online": False}
    try:
        data = load_json(cfg_file, {})
        for conv in data.get("converters", []):
            name = str(conv.get("name") or conv.get("id") or "")
            if str(name) == str(conv_name):
                host = (conv.get("settings") or {}).get("host")
                port = (conv.get("settings") or {}).get("port")
                if not host or not port:
                    return {"online": False}
                try:
                    import socket
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(1.0)
                    s.connect((host, int(port)))
                    s.close()
                    return {"online": True}
                except Exception:
                    return {"online": False}
        return {"online": False}
    except Exception:
        return {"online": False}
@router.post("/{project_id}/readings/batch")
def batch_readings(project_id: str, device_ids: List[str] = Body(...)):
    """
    Fetch readings for multiple devices in one go.
    """
    if project_id not in READINGS:
        return {"data": {}}
    
    result = {}
    proj_data = READINGS[project_id]
    
    for dev_id in device_ids:
        if dev_id in proj_data:
            result[dev_id] = proj_data[dev_id].get("values", {})
        else:
            result[dev_id] = {}
            
    return {"data": result}

# --- COMBINED PAGE CONFIG (Updated to use new drawing default) ---

@router.get("/{project_id}/page_config/{page_id}")
def get_page_config(project_id: str, page_id: str):
    pages = load_json(get_pages_file(project_id), [])
    page = next((p for p in pages if p.get("id") == page_id), None)
    if not page:
        raise HTTPException(404, "Page not found")
        
    markers = load_json(ensure_file(marker_file_path(project_id, page_id), []), [])
    drawings = load_json(ensure_file(drawing_file_path(project_id, page_id), EMPTY_CANVAS), EMPTY_CANVAS)
    style = load_json(ensure_file(style_file_path(project_id, page_id), {}), {})
    
    return {"status": "ok", "page": page, "markers": markers, "drawings": drawings, "style": style}

# --- STATUS ASSETS (Dynamic) ---

def _get_status_assets_dir(category: str):
    # services/backend/assets/status/{on|off|src}
    d = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "assets", "status", category)
    os.makedirs(d, exist_ok=True)
    return d

@router.get("/status_assets/list")
def list_status_assets():
    res = {"on": [], "off": [], "src": []}
    for cat in ["on", "off", "src"]:
        d = _get_status_assets_dir(cat)
        if os.path.exists(d):
            res[cat] = [f for f in os.listdir(d) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg'))]
    return res

@router.get("/status_assets/{category}/{filename}")
def get_status_asset(category: str, filename: str):
    d = _get_status_assets_dir(category)
    path = os.path.join(d, filename)
    if os.path.exists(path):
        return FileResponse(path)
    # Check if frontend assets exist as fallback? No, frontend serves them via Vite if static.
    # But backend logic should check if user uploaded something.
    raise HTTPException(404, "Asset not found")

@router.post("/status_assets/upload")
def upload_status_asset(category: str = Form(...), file: UploadFile = File(...)):
    if category not in ["on", "off", "src"]:
        raise HTTPException(400, "Invalid category")
    d = _get_status_assets_dir(category)
    path = os.path.join(d, file.filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "ok", "filename": file.filename}
