
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Dict, Optional
import os
import json
import shutil
from services.backend.api import xlsx_storage as storage
from services.backend.shared_state import READINGS

router = APIRouter()

# ==========================================================
# PATH UTILS (Project/PID based)
# ==========================================================
def get_project_dir(project_id: str):
    return storage.get_data_dir(project_id)

def get_photoview_dir(project_id: str):
    d = os.path.join(get_project_dir(project_id), "photoview")
    os.makedirs(d, exist_ok=True)
    return d

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
    return os.path.join(get_photoview_dir(project_id), f"drawings_{page_id}.json")

# ==========================================================
# JSON HELPERS
# ==========================================================
def load_json(path, default=None):
    if default is None: default = {}
    if not os.path.exists(path): return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def ensure_file(path, default_content):
    if not os.path.exists(path):
        save_json(path, default_content)
    return path

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
        ensure_file(drawing_file_path(project_id, p["id"]), [])
    return {"pages": pages}

@router.post("/{project_id}/create_page")
def create_page(project_id: str, name: str = Form(...), file: UploadFile = File(...)):
    if not name: raise HTTPException(400, "Missing page name")
    
    page_id = name.lower().replace(" ", "_")
    filename = file.filename
    upload_dir = get_upload_dir(project_id)
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    
    if any(p["id"] == page_id for p in pages):
        raise HTTPException(400, f"Page ID '{page_id}' already exists")
        
    new_page = {"id": page_id, "name": name, "image": filename}
    pages.append(new_page)
    save_json(pages_file, pages)
    
    ensure_file(marker_file_path(project_id, page_id), [])
    ensure_file(drawing_file_path(project_id, page_id), [])
    ensure_file(style_file_path(project_id, page_id), {})
    
    return {"status": "ok", "page": new_page}

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
    
    # Delete files
    try:
        os.remove(marker_file_path(project_id, page_id))
        os.remove(drawing_file_path(project_id, page_id))
        os.remove(style_file_path(project_id, page_id))
        if page.get("image"):
            img_path = os.path.join(get_upload_dir(project_id), page["image"])
            if os.path.exists(img_path): os.remove(img_path)
    except:
        pass # Ignore delete errors
        
    return {"status": "ok"}

@router.post("/{project_id}/rename_page")
def rename_page(project_id: str, page_id: str = Body(...), new_name: str = Body(...)):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    for p in pages:
        if p.get("id") == page_id:
            p["name"] = new_name
            save_json(pages_file, pages)
            return {"status": "ok", "page": p}
    raise HTTPException(404, "Page not found")

@router.post("/{project_id}/update_image")
def update_image(project_id: str, page_id: str = Body(...), file: UploadFile = File(...)):
    pages_file = get_pages_file(project_id)
    pages = load_json(pages_file, [])
    page = next((p for p in pages if p.get("id") == page_id), None)
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

# --- MARKERS ---

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

# --- DRAWINGS ---

@router.get("/{project_id}/drawings/{page_id}")
def get_drawings(project_id: str, page_id: str):
    path = ensure_file(drawing_file_path(project_id, page_id), [])
    return load_json(path, [])

@router.post("/{project_id}/add_drawing/{page_id}")
def add_drawing(project_id: str, page_id: str, drawing: dict = Body(...)):
    path = ensure_file(drawing_file_path(project_id, page_id), [])
    arr = load_json(path, [])
    arr.append(drawing)
    save_json(path, arr)
    return {"status": "ok", "index": len(arr) - 1}

@router.post("/{project_id}/update_drawing/{page_id}/{index}")
def update_drawing(project_id: str, page_id: str, index: int, drawing: dict = Body(...)):
    path = drawing_file_path(project_id, page_id)
    arr = load_json(path, [])
    if 0 <= index < len(arr):
        arr[index] = drawing
        save_json(path, arr)
        return {"status": "ok"}
    raise HTTPException(400, "Index out of range")

@router.delete("/{project_id}/delete_drawing/{page_id}/{index}")
def delete_drawing(project_id: str, page_id: str, index: int):
    path = drawing_file_path(project_id, page_id)
    arr = load_json(path, [])
    if 0 <= index < len(arr):
        arr.pop(index)
        save_json(path, arr)
        return {"status": "ok"}
    raise HTTPException(400, "Index out of range")


# --- STYLES ---

@router.get("/{project_id}/get_style/{page_id}")
def get_style(project_id: str, page_id: str):
    path = style_file_path(project_id, page_id)
    return {"status": "ok", "style": load_json(path, {})}

@router.post("/{project_id}/save_style/{page_id}")
def save_style(project_id: str, page_id: str, style: dict = Body(...)):
    path = style_file_path(project_id, page_id)
    save_json(path, style)
    return {"status": "ok"}

# --- IMAGES / ASSETS ---

@router.get("/{project_id}/images/{filename}")
def get_image(project_id: str, filename: str):
    path = os.path.join(get_upload_dir(project_id), filename)
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(404, "Image not found")

@router.post("/{project_id}/upload_icon")
def upload_icon(project_id: str, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg')):
        raise HTTPException(400, "Invalid file type")
        
    filename = file.filename
    upload_dir = get_upload_dir(project_id) # Using same upload dir for now, or separate 'icons'? 
    # Logic in api_photoview.py used a global upload folder, let's keep it project specific.
    
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

# --- DEVICE LIST (Integrated with xlsx_storage) ---

@router.get("/{project_id}/device_list")
def device_list(project_id: str):
    # Use ConfigDevice.json
    cfg_file = os.path.join(get_project_dir(project_id), "..", "ConfigDevice.json")
    if not os.path.exists(cfg_file): return []
    
    try:
        data = load_json(cfg_file)
        result = []
        for conv in data.get("converters", []):
            for dev in conv.get("devices", []):
                if dev.get("id"):
                    # Return object with id and name
                    result.append({
                        "id": String(dev["id"]),
                        "name": dev.get("name") or dev.get("model") or String(dev["id"])
                    })
        # Deduplicate based on ID
        seen = set()
        unique_res = []
        for r in result:
            if r["id"] not in seen:
                seen.add(r["id"])
                unique_res.append(r)
        
        return sorted(unique_res, key=lambda x: x["name"])
    except:
        return []

@router.get("/{project_id}/device_params/{dev_id}")
def device_params(project_id: str, dev_id: str):
    # Get parameters from ConfigDevice.json (template_ref) or scan Excel headers
    # First try Excel headers for historical keys
    params_set = set()
    
    # scan realtime readings if available
    if project_id in READINGS and dev_id in READINGS[project_id]:
        rec = READINGS[project_id][dev_id]
        vals = rec.get('values') or {}
        for k in vals.keys():
            params_set.add(k)
            
    # Then try ConfigDevice for template registers
    try:
        cfg_file = os.path.join(get_project_dir(project_id), "..", "ConfigDevice.json")
        data = load_json(cfg_file)
        # Find device to check template
        target_template = None
        for conv in data.get("converters", []):
            for dev in conv.get("devices", []):
                if String(dev.get("id")) == String(dev_id):
                    target_template = dev.get("template_ref")
                    break
            if target_template: break
            
        if target_template:
            # Load template
            # Assumes template path relative to services/backend
            # But here we might just list keys found in realtime/history as fallback
            pass 
    except:
        pass

    # Finally try Excel
    try:
        import datetime
        now = datetime.datetime.now()
        f = storage.get_monthly_file(project_id, now.strftime('%Y'), now.strftime('%m'))
        if os.path.exists(f):
            import pandas as pd
            df = pd.read_excel(f, sheet_name="Readings", nrows=0)
            cols = [c for c in df.columns if c not in ["date", "time", "device_id", "device_name", "key", "value", "unit"]]
            # Actually standard schema: date, time, device_id... key.
            # So keys are in 'key' column rows. We can't get them from headers (headers are fixed).
            # We need to read 'key' column unique values.
            # This is slow for large files.
            pass
    except:
        pass

    # If we found nothing, return common keys
    if not params_set:
        return {"status": "ok", "device_id": dev_id, "params": []}

    return {
        "status": "ok", 
        "device_id": dev_id, 
        "params": [{"key": k} for k in sorted(list(params_set))]
    }

@router.get("/{project_id}/device_data/{dev_id}")
def device_data(project_id: str, dev_id: str):
    if project_id in READINGS:
        proj_data = READINGS[project_id]
        if dev_id in proj_data:
            rec = proj_data[dev_id]
            # Convert to flat dict {key: val}
            return {
                "status": "ok",
                "data": rec.get("values", {})
            }
    
    return {"status": "error", "msg": "No data found or device offline"}

@router.get("/{project_id}/converter_list")
def converter_list(project_id: str):
    cfg_file = os.path.join(get_project_dir(project_id), "..", "ConfigDevice.json")
    if not os.path.exists(cfg_file): return []
    try:
        data = load_json(cfg_file)
        return [c.get("name") or c.get("protocol") for c in data.get("converters", [])]
    except:
        return []

# Helper for string comparison 
def String(s):
    return str(s)

# --- COMBINED PAGE CONFIG ---

@router.get("/{project_id}/page_config/{page_id}")
def get_page_config(project_id: str, page_id: str):
    pages = load_json(get_pages_file(project_id), [])
    page = next((p for p in pages if p.get("id") == page_id), None)
    if not page:
        raise HTTPException(404, "Page not found")
    markers = load_json(ensure_file(marker_file_path(project_id, page_id), []), [])
    drawings = load_json(ensure_file(drawing_file_path(project_id, page_id), []), [])
    style = load_json(ensure_file(style_file_path(project_id, page_id), {}), {})
    return {"status": "ok", "page": page, "markers": markers, "drawings": drawings, "style": style}

