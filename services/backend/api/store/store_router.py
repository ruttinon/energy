from fastapi import APIRouter, HTTPException, Body, Depends, Cookie, Header
from typing import Optional, List, Dict, Any
import os, json, uuid, datetime
router = APIRouter()

def _root():
    import sys
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

ROOT = _root()
DATA_DIR = os.path.join(ROOT, 'services', 'backend', 'data')
os.makedirs(DATA_DIR, exist_ok=True)
ORDERS_FILE = os.path.join(DATA_DIR, 'orders.json')
PROJECTS_ROOT = os.path.join(ROOT, 'projects')

CATALOG = {
    "products": [
        {"id": "meter_plus", "name": "ชุดมิเตอร์พลังงานขั้นสูง", "price": 8900, "unit": "THB", "desc": "รวมเซ็นเซอร์ CT และกล่องสื่อสาร"},
        {"id": "gateway", "name": "Gateway SCADA", "price": 12900, "unit": "THB", "desc": "เกตเวย์เชื่อมต่อคลาวด์พร้อม PoE"},
        {"id": "sensor_pack", "name": "ชุดเซ็นเซอร์ 3 เฟส", "price": 4500, "unit": "THB", "desc": "CT คลิปออน 3 ตัว พร้อมสาย"}
    ],
    "services": [
        {"id": "install_basic", "name": "ติดตั้งพื้นฐาน", "price": 3500, "unit": "THB", "desc": "ติดตั้งอุปกรณ์มาตรฐาน 1 จุด"},
        {"id": "install_full", "name": "ติดตั้งเต็มระบบ", "price": 8900, "unit": "THB", "desc": "ติดตั้งครบชุดพร้อมทดสอบระบบ"},
        {"id": "maintenance", "name": "บำรุงรักษารายปี", "price": 4900, "unit": "THB", "desc": "ตรวจเช็คและปรับแต่งระบบรายปี"}
    ]
}

def _load_orders() -> List[Dict[str, Any]]:
    if not os.path.exists(ORDERS_FILE):
        return []
    try:
        return json.loads(open(ORDERS_FILE, 'r', encoding='utf-8').read())
    except Exception:
        return []

def _save_orders(items: List[Dict[str, Any]]):
    try:
        with open(ORDERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _sessions_file_path():
    # Match fastapi_app.py logic
    return os.path.join(ROOT, 'sessions.json')

def get_current_user_dep(
    session_id: Optional[str] = Cookie(None),
    user_session_id: Optional[str] = Cookie(None),
    admin_session_id: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    try:
        sid = None
        if authorization and str(authorization).lower().startswith("bearer "):
            sid = str(authorization).split(" ")[1]
        elif user_session_id:
            sid = user_session_id
        elif session_id:
            sid = session_id
        elif admin_session_id:
            sid = admin_session_id
        if not sid:
            raise HTTPException(status_code=401, detail="Unauthorized")
        sessions = {}
        sf = _sessions_file_path()
        if os.path.exists(sf):
            try:
                sessions = json.loads(open(sf, 'r', encoding='utf-8').read())
            except Exception:
                sessions = {}
        username = sessions.get(sid)
        if not username:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return username
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")

@router.get('/catalog')
def get_catalog(project_id: Optional[str] = None):
    # If project_id is provided, try to load from inventory
    if project_id:
        inv = _load_inventory(project_id)
        # Convert inventory items to catalog format if needed, or just return them
        # Inventory structure: {"categories": [...], "items": [{id, name, price, ...}]}
        # The frontend expects {products: [], services: []}
        # We need to map inventory items to this structure based on category maybe?
        # Or we can just return the inventory structure and update frontend to handle it.
        # Let's try to adapt inventory to catalog structure for backward compatibility
        products = []
        services = []
        for it in (inv.get('items') or []):
            # Simple heuristic: if category contains 'service' or 'installation', it's a service
            cat = str(it.get('category') or '').lower()
            if 'service' in cat or 'บริการ' in cat:
                services.append(it)
            else:
                products.append(it)
        
        if products or services:
            return {"products": products, "services": services, "categories": inv.get('categories') or []}
            
    return CATALOG

@router.post('/order')
def create_order(payload: dict = Body(...), username: str = Depends(get_current_user_dep)):
    # payload: {items: [{id, qty}], contact: {name, phone, address}, note, project_id}
    project_id = payload.get('project_id')
    
    # Load items source
    all_items = {}
    if project_id:
        inv = _load_inventory(project_id)
        for it in (inv.get('items') or []):
            all_items[str(it.get('id'))] = it
    else:
        all_items = {p['id']: p for p in CATALOG['products']} | {s['id']: s for s in CATALOG['services']}

    total = 0
    valid_items = []
    for it in (payload.get('items') or []):
        cid = str(it.get('id'))
        qty = int(it.get('qty') or 1)
        item_data = all_items.get(cid)
        if item_data:
            price = float(item_data.get('price') or 0)
            total += price * qty
            valid_items.append({
                "id": cid,
                "name": item_data.get('name'),
                "price": price,
                "qty": qty
            })

    oid = uuid.uuid4().hex
    order = {
        "id": oid,
        "username": username,
        "project_id": project_id,
        "items": valid_items,
        "contact": payload.get('contact') or {},
        "note": payload.get('note'),
        "total": total,
        "currency": "THB",
        "status": "pending",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }

    if project_id:
        # Save to project sales
        sales = _load_sales(project_id)
        sales.append(order)
        _save_sales(project_id, sales)
    else:
        # Fallback to global orders
        items = _load_orders()
        items.append(order)
        _save_orders(items)

    # Notify User
    try:
        from services.backend.api.notification.notification_router import create_notification_internal
        # Notify Customer
        create_notification_internal(
            username=username,
            project_id=project_id,
            title="คำสั่งซื้อสำเร็จ",
            message=f"ได้รับคำสั่งซื้อ #{oid} แล้ว กำลังดำเนินการ",
            type="success"
        )
        # Notify Admin
        create_notification_internal(
            username="admin",
            project_id=project_id,
            title="มีคำสั่งซื้อใหม่",
            message=f"คำสั่งซื้อ #{oid} จากคุณ {username} ยอดรวม {total:,.2f} THB",
            type="info"
        )
    except Exception as e:
        print(f"Failed to create notification: {e}")
        
    return {"ok": True, "order_id": oid}

@router.get('/orders')
def list_orders(project_id: Optional[str] = None, username: str = Depends(get_current_user_dep)):
    if project_id:
        items = _load_sales(project_id)
    else:
        items = _load_orders()
        
    out = [o for o in items if str(o.get('username')) == str(username)]
    out.sort(key=lambda x: x.get('created_at') or '', reverse=True)
    return {"items": out}

# =============================
# Inventory Management (per project)
# =============================

def _project_dir(pid: str):
    p = os.path.join(PROJECTS_ROOT, str(pid))
    os.makedirs(p, exist_ok=True)
    return p

def _inventory_file(pid: str):
    return os.path.join(_project_dir(pid), 'inventory.json')

def _sales_file(pid: str):
    return os.path.join(_project_dir(pid), 'sales.json')

def _load_inventory(pid: str) -> Dict[str, Any]:
    fp = _inventory_file(pid)
    if not os.path.exists(fp):
        return {"categories": [], "items": []}
    try:
        return json.loads(open(fp, 'r', encoding='utf-8').read())
    except Exception:
        return {"categories": [], "items": []}

def _save_inventory(pid: str, inv: Dict[str, Any]):
    fp = _inventory_file(pid)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(inv, f, ensure_ascii=False, indent=2)

def _load_sales(pid: str) -> List[Dict[str, Any]]:
    fp = _sales_file(pid)
    if not os.path.exists(fp):
        return []
    try:
        return json.loads(open(fp, 'r', encoding='utf-8').read())
    except Exception:
        return []

def _save_sales(pid: str, items: List[Dict[str, Any]]):
    fp = _sales_file(pid)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

@router.get('/inventory')
def inventory_get(project_id: str):
    inv = _load_inventory(project_id)
    return inv

@router.post('/inventory/category')
def inventory_add_category(payload: dict = Body(...)):
    project_id = payload.get('project_id')
    if not project_id:
         raise HTTPException(status_code=400, detail="project_id required")
    name = str(payload.get('name') or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name required")
    inv = _load_inventory(project_id)
    cats = set(inv.get('categories') or [])
    cats.add(name)
    inv['categories'] = sorted(cats)
    _save_inventory(project_id, inv)
    return {"ok": True, "categories": inv['categories']}

@router.post('/inventory/item')
def inventory_add_item(payload: dict = Body(...)):
    project_id = payload.get('project_id')
    if not project_id:
         raise HTTPException(status_code=400, detail="project_id required")
    name = str(payload.get('name') or '').strip()
    if not name:
        raise HTTPException(status_code=400, detail="Item name required")
    inv = _load_inventory(project_id)
    items = inv.get('items') or []
    iid = uuid.uuid4().hex
    item = {
        "id": iid,
        "sku": str(payload.get('sku') or '').strip(),
        "name": name,
        "category": payload.get('category'),
        "type": payload.get('type') or 'product',
        "price": float(payload.get('price') or 0),
        "stock": int(payload.get('stock') or 0),
        "unit": str(payload.get('unit') or 'pcs'),
        "meta": payload.get('meta') or {}
    }
    items.append(item)
    inv['items'] = items
    _save_inventory(project_id, inv)
    return {"ok": True, "id": iid}

@router.put('/inventory/item/{item_id}')
def inventory_update_item(item_id: str, payload: dict = Body(...)):
    project_id = payload.get('project_id')
    if not project_id:
         raise HTTPException(status_code=400, detail="project_id required")
    inv = _load_inventory(project_id)
    items = inv.get('items') or []
    found = False
    for it in items:
        if str(it.get('id')) == str(item_id):
            for k in ['sku', 'name', 'category', 'type', 'price', 'stock', 'unit', 'meta']:
                if k in payload:
                    it[k] = payload[k]
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Item not found")
    inv['items'] = items
    _save_inventory(project_id, inv)
    return {"ok": True}

@router.delete('/inventory/item/{item_id}')
def inventory_delete_item(item_id: str, project_id: str):
    inv = _load_inventory(project_id)
    items = inv.get('items') or []
    new_items = [it for it in items if str(it.get('id')) != str(item_id)]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="Item not found")
    inv['items'] = new_items
    _save_inventory(project_id, inv)
    return {"ok": True}

@router.post('/inventory/adjust')
def inventory_adjust(payload: dict = Body(...), username: str = Depends(get_current_user_dep)):
    project_id = payload.get('project_id')
    if not project_id:
         raise HTTPException(status_code=400, detail="project_id required")
    item_id = str(payload.get('item_id') or '')
    delta = int(payload.get('delta') or 0)
    reason = str(payload.get('reason') or '')
    inv = _load_inventory(project_id)
    items = inv.get('items') or []
    target = next((it for it in items if str(it.get('id')) == item_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Item not found")
    target['stock'] = int(target.get('stock') or 0) + delta
    _save_inventory(project_id, inv)
    sales = _load_sales(project_id)
    sales.append({
        "type": "adjust",
        "item_id": item_id,
        "delta": delta,
        "reason": reason,
        "by": username,
        "ts": datetime.datetime.utcnow().isoformat() + "Z"
    })
    _save_sales(project_id, sales)
    return {"ok": True, "stock": target['stock']}

@router.post('/sales/record')
def sales_record(payload: dict = Body(...), username: str = Depends(get_current_user_dep)):
    project_id = payload.get('project_id')
    if not project_id:
         raise HTTPException(status_code=400, detail="project_id required")
    items_in = payload.get('items') or []
    if not isinstance(items_in, list) or len(items_in) == 0:
        raise HTTPException(status_code=400, detail="items required")
    inv = _load_inventory(project_id)
    inv_map = {str(it.get('id')): it for it in (inv.get('items') or [])}
    total = 0.0
    for it in items_in:
        iid = str(it.get('item_id') or '')
        qty = int(it.get('qty') or 0)
        price = float(it.get('price') or (inv_map.get(iid) or {}).get('price') or 0)
        total += price * qty
        if iid in inv_map:
            inv_map[iid]['stock'] = int(inv_map[iid].get('stock') or 0) - qty
            if inv_map[iid]['stock'] < 0:
                inv_map[iid]['stock'] = 0
    inv['items'] = list(inv_map.values())
    _save_inventory(project_id, inv)
    sales = _load_sales(project_id)
    sid = uuid.uuid4().hex
    sales.append({
        "type": "sale",
        "sale_id": sid,
        "items": items_in,
        "total": total,
        "currency": "THB",
        "by": username,
        "ts": datetime.datetime.utcnow().isoformat() + "Z"
    })
    _save_sales(project_id, sales)
    return {"ok": True, "sale_id": sid, "total": total}

@router.get('/sales/summary')
def sales_summary(project_id: str):
    sales = _load_sales(project_id)
    inv = _load_inventory(project_id)
    name_map = {it['id']: it['name'] for it in (inv.get('items') or [])}
    out: Dict[str, Dict[str, Any]] = {}
    revenue = 0.0
    for s in sales:
        if s.get('type') != 'sale':
            continue
        revenue += float(s.get('total') or 0)
        for it in (s.get('items') or []):
            iid = str(it.get('item_id') or '')
            qty = int(it.get('qty') or 0)
            price = float(it.get('price') or 0)
            cur = out.get(iid) or {"sold_qty": 0, "revenue": 0.0, "name": name_map.get(iid)}
            cur["sold_qty"] += qty
            cur["revenue"] += price * qty
            out[iid] = cur
    return {"revenue": revenue, "items": out}
