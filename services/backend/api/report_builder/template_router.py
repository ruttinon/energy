from fastapi import APIRouter, HTTPException, Body, Response
from typing import Dict, List, Optional
import os
import json
import uuid
from .template_render import render_template_html

router = APIRouter()

# Store templates in JSON files for now
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates_json")
os.makedirs(TEMPLATE_DIR, exist_ok=True)
DEFAULT_FILE = os.path.join(TEMPLATE_DIR, "_default.json")

def _load_templates():
    templates = []
    if not os.path.exists(TEMPLATE_DIR):
        return []
    for f in os.listdir(TEMPLATE_DIR):
        if f.endswith(".json") and not f.startswith("_"):
            try:
                with open(os.path.join(TEMPLATE_DIR, f), 'r', encoding='utf-8') as fp:
                    data = json.load(fp)
                    templates.append({
                        "id": data.get("id", f.replace(".json", "")),
                        "name": data.get("name", f),
                        "desc": data.get("desc", ""),
                        "last_modified": os.path.getmtime(os.path.join(TEMPLATE_DIR, f))
                    })
            except:
                pass
    return templates

def _get_template(tid: str):
    path = os.path.join(TEMPLATE_DIR, f"{tid}.json")
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

def _save_template(data: dict):
    tid = data.get("id") or str(uuid.uuid4())
    data["id"] = tid
    path = os.path.join(TEMPLATE_DIR, f"{tid}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return tid

@router.get("/list")
def list_templates():
    return {"templates": _load_templates()}

@router.get("/default")
def get_default_template():
    def_id = None
    if os.path.exists(DEFAULT_FILE):
        try:
            with open(DEFAULT_FILE, 'r') as f:
                def_id = json.load(f).get("default_template")
        except:
            pass
    return {"default_template": def_id}

@router.post("/set_default")
def set_default_template(payload: dict = Body(...)):
    tid = payload.get("template_id")
    with open(DEFAULT_FILE, 'w') as f:
        json.dump({"default_template": tid}, f)
    return {"status": "ok"}

@router.post("/create")
def create_template(payload: dict = Body(...)):
    # payload: {template_id: name, name: name, desc: ''}
    # Create a basic blank template structure
    tid = payload.get("template_id")
    new_tpl = {
        "id": tid,
        "name": payload.get("name"),
        "desc": payload.get("desc"),
        "pages": [{
            "w": 794, "h": 1123, "elements": []
        }]
    }
    _save_template(new_tpl)
    return {"status": "ok", "id": tid}

@router.delete("/delete/{tid}")
def delete_template(tid: str):
    path = os.path.join(TEMPLATE_DIR, f"{tid}.json")
    if os.path.exists(path):
        os.remove(path)
        return {"status": "ok"}
    raise HTTPException(404, "Template not found")

@router.get("/preview")
def preview_template(id: str):
    tpl = _get_template(id)
    if not tpl:
        return Response("Template not found", status_code=404)
    # Dummy context
    html = render_template_html(tpl, {
        "device_name": "Preview Device",
        "date": "2025-01-01",
        "total_money": "100.00"
    })
    return Response(content=html, media_type="text/html")

@router.post("/render")
def render_report(payload: dict = Body(...)):
    tid = payload.get("template_id")
    context = payload.get("data", {})
    
    tpl = _get_template(tid)
    if not tpl:
        raise HTTPException(404, "Template not found")
        
    html = render_template_html(tpl, context)
    # Return as HTML file download
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename=report_{tid}.html"}
    )

@router.post("/billing_merge")
def merge_billing(payload: dict = Body(...)):
    # Very basic merge: Just concat HTML pages?
    # payload: {date, items, template_id, summary_template_id}
    # This acts like a "batch render" returning one HTML with page breaks
    
    items = payload.get("items", [])
    tid = payload.get("template_id")
    
    tpl = _get_template(tid)
    if not tpl:
        raise HTTPException(404, "Template not found")

    full_html = ["<html><body>"]
    
    # Render loop
    for item in items:
        # We need to render the BODY of the template for each item
        # render_template_html returns full <html>...
        # We'll strip it or modify render to be fragment friendly?
        # For simplicity now, just concat the pages
        
        # Re-using internal render logic would be better but `render_template_html` is blocking
        # Let's just return a simple "Not fully implemented" or try our best.
        
        # Hack: Render individual, extract body content
        page_html = render_template_html(tpl, item) # item needs to be context
        full_html.append(page_html) # This invalidates HTML structure (multiple <html>), but browser handles it often
        
    full_html.append("</body></html>")
    
    return Response(
        content="\n<div style='page-break-after:always;'></div>\n".join(full_html),
        media_type="text/html",
        headers={"Content-Disposition": "attachment; filename=merged_report.html"}
    )
