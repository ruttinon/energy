# ==========================================================
# utils/api_photoview.py — ADMIN Photoview API (2025 STYLE-SYNC)
# รองรับ: Upload / Pages / Markers / Devices / Converters / Icons / Styles / DRAWINGS (NEW)
# Compatible with Photoview Admin + Photoview User
# ==========================================================

from flask import Blueprint, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os, json

photoview_bp = Blueprint("photoview", __name__)
CORS(photoview_bp)

# ==========================================================
# PATH CONFIG
# ==========================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Admin folder
PHOTOVIEW_DIR = os.path.join(BASE_DIR, "web", "admin", "photoview_admin")
UPLOAD_FOLDER = os.path.join(PHOTOVIEW_DIR, "uploads")
PAGES_FILE = os.path.join(PHOTOVIEW_DIR, "pages.json")

# Style folder (NEW)
STYLE_DIR = os.path.join(PHOTOVIEW_DIR, "styles")
os.makedirs(STYLE_DIR, exist_ok=True)

def style_file_path(page_id):
    return os.path.join(STYLE_DIR, f"style_{page_id}.json")

# Data folder
DATA_DIR = os.path.join(BASE_DIR, "data")
READINGS_FILE = os.path.join(DATA_DIR, "readings.json")
CONVERTORS_FILE = os.path.join(DATA_DIR, "convertors.json")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

if not os.path.exists(PAGES_FILE):
    with open(PAGES_FILE, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)

# ==========================================================
# UTIL FUNCTIONS
# ==========================================================

def load_json(path, default=None):
    if default is None:
        default = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def marker_file_path(page_id):
    return os.path.join(PHOTOVIEW_DIR, f"markers_{page_id}.json")

def ensure_marker_file(page_id):
    path = marker_file_path(page_id)
    if not os.path.exists(path):
        save_json(path, [])
    return path

# ⭐ NEW: DRAWING FILE PATH & ENSURE
def drawing_file_path(page_id):
    return os.path.join(PHOTOVIEW_DIR, f"drawings_{page_id}.json")

def ensure_drawing_file(page_id):
    path = drawing_file_path(page_id)
    if not os.path.exists(path):
        save_json(path, [])
    return path
# ----------------------------------------------------------

# ⭐ NEW UTILITY: Refactor page creation logic to one place
def _handle_page_creation(name, file):
    """Encapsulates the core logic for creating a new photoview page."""
    if not name:
        return {"status": "error", "message": "missing page name"}, 400
    if not file:
        return {"status": "error", "message": "missing image file"}, 400

    page_id = name.lower().replace(" ", "_")
    filename = secure_filename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))

    pages = load_json(PAGES_FILE, [])

    if any(p["id"] == page_id for p in pages):
        # Delete the uploaded file if page ID already exists
        os.remove(os.path.join(UPLOAD_FOLDER, filename))
        return {"status": "error", "message": f"page ID '{page_id}' already exists"}, 400

    new_page = {
        "id": page_id,
        "name": name,
        "image": filename
    }

    pages.append(new_page)
    save_json(PAGES_FILE, pages)
    ensure_marker_file(page_id)
    ensure_drawing_file(page_id) 

    # create empty style file
    save_json(style_file_path(page_id), {})

    return {"status": "ok", "page": new_page}, 200

# ==========================================================
# GET PAGE LIST
# ==========================================================

@photoview_bp.route("/pages", methods=["GET"])
def list_pages():
    pages = load_json(PAGES_FILE, [])
    for p in pages:
        ensure_marker_file(p["id"])
        ensure_drawing_file(p["id"]) # ⭐ เพิ่ม: ตรวจสอบและสร้างไฟล์ Drawing
    return jsonify(pages)

# ==========================================================
# CREATE PAGE (Main)
# ==========================================================

@photoview_bp.route("/create_page", methods=["POST"])
def create_page():
    try:
        # Use "name" as the primary key for the main function
        name = request.form.get("name", "").strip()
        file = request.files.get("file")
        
        response, status_code = _handle_page_creation(name, file)
        return jsonify(response), status_code

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================================
# STYLE SYNC (NEW)
# ==========================================================

@photoview_bp.route("/save_style/<page_id>", methods=["POST"])
def save_style(page_id):
    try:
        style = request.get_json()
        if not style:
            return jsonify({"status": "error", "msg": "no style data"}), 400

        save_json(style_file_path(page_id), style)
        return jsonify({"status": "ok", "msg": "style saved"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

@photoview_bp.route("/get_style/<page_id>", methods=["GET"])
def get_style(page_id):
    try:
        style = load_json(style_file_path(page_id), {})
        return jsonify({"status": "ok", "style": style})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

# ==========================================================
# UPDATE PAGE IMAGE
# ==========================================================

@photoview_bp.route("/update_image", methods=["POST"])
def update_image():
    try:
        page_id = request.form.get("page_id")
        file = request.files.get("file")

        if not page_id or not file:
            return jsonify({"status": "error", "msg": "missing data"}), 400

        filename = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))

        pages = load_json(PAGES_FILE, [])
        for p in pages:
            if p["id"] == page_id:
                p["image"] = filename
                save_json(PAGES_FILE, pages)
                return jsonify({"status": "ok", "image": filename})

        return jsonify({"status": "error", "msg": "page not found"}), 404

    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

# ==========================================================
# RENAME PAGE
# ==========================================================

@photoview_bp.route("/rename_page", methods=["POST"])
def rename_page():
    try:
        data = request.get_json(silent=True) or {}
        page_id = data.get("page_id")
        new_name = data.get("new_name", "").strip()

        if not page_id or not new_name:
            return jsonify({"status": "error", "msg": "invalid params"}), 400

        pages = load_json(PAGES_FILE, [])
        found = False

        for p in pages:
            if p["id"] == page_id:
                p["name"] = new_name
                found = True
                break

        if not found:
            return jsonify({"status": "error", "msg": "page not found"}), 404

        save_json(PAGES_FILE, pages)
        return jsonify({"status": "ok"})

    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

# ==========================================================
# DELETE PAGE
# ==========================================================

@photoview_bp.route("/delete_page/<page_id>", methods=["DELETE"])
def delete_page(page_id):
    try:
        pages = load_json(PAGES_FILE, [])

        page = next((p for p in pages if p["id"] == page_id), None)
        if not page:
            return jsonify({"status": "error", "msg": "page not found"}), 404

        pages = [p for p in pages if p["id"] != page_id]
        save_json(PAGES_FILE, pages)

        # delete marker file
        marker_path = marker_file_path(page_id)
        if os.path.exists(marker_path):
            os.remove(marker_path)

        # delete style file
        style_path = style_file_path(page_id)
        if os.path.exists(style_path):
            os.remove(style_path)

        # ⭐ เพิ่ม: ลบไฟล์ Drawing file
        drawing_path = drawing_file_path(page_id)
        if os.path.exists(drawing_path):
            os.remove(drawing_path)

        # delete image
        img = page.get("image")
        if img:
            img_path = os.path.join(UPLOAD_FOLDER, img)
            if os.path.exists(img_path):
                os.remove(img_path)

        return jsonify({"status": "ok"})

    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

# ==========================================================
# MARKERS CRUD
# ==========================================================

@photoview_bp.route("/markers/<page_id>", methods=["GET"])
def get_markers(page_id):
    path = ensure_marker_file(page_id)
    arr = load_json(path, [])
    return jsonify(arr)

@photoview_bp.route("/add_marker/<page_id>", methods=["POST"])
def add_marker(page_id):
    marker = request.get_json()
    if not marker:
        return jsonify({"status": "error", "message": "invalid marker"}), 400

    path = ensure_marker_file(page_id)
    arr = load_json(path, [])
    arr.append(marker)
    save_json(path, arr)
    return jsonify({"status": "ok"})

@photoview_bp.route("/update_marker/<page_id>/<int:index>", methods=["POST"])
def update_marker(page_id, index):
    new_data = request.get_json()
    if not new_data:
        return jsonify({"status": "error", "message": "invalid data"}), 400

    path = ensure_marker_file(page_id)
    arr = load_json(path, [])

    if index < 0 or index >= len(arr):
        return jsonify({"status": "error", "message": "index out of range"}), 400

    arr[index] = new_data
    save_json(path, arr)
    return jsonify({"status": "ok"})

@photoview_bp.route("/delete_marker/<page_id>/<int:index>", methods=["DELETE"])
def delete_marker(page_id, index):
    path = ensure_marker_file(page_id)
    arr = load_json(path, [])

    if index < 0 or index >= len(arr):
        return jsonify({"status": "error", "message": "index out of range"}), 400

    arr.pop(index)
    save_json(path, arr)
    return jsonify({"status": "ok"})


# ==========================================================
# ⭐ NEW: DRAWINGS CRUD (วัตถุตกแต่งแบบกำหนดเอง)
# ==========================================================

@photoview_bp.route("/drawings/<page_id>", methods=["GET"])
def get_drawings(page_id):
    """
    ดึงข้อมูลวัตถุวาดทั้งหมดของหน้านั้น
    """
    path = ensure_drawing_file(page_id)
    arr = load_json(path, [])
    return jsonify(arr)

@photoview_bp.route("/add_drawing/<page_id>", methods=["POST"])
def add_drawing(page_id):
    """
    เพิ่มวัตถุวาดใหม่ (Line, Rect, Text) และคืนค่า index ที่เพิ่ม
    """
    drawing = request.get_json()
    if not drawing:
        return jsonify({"status": "error", "message": "invalid drawing data"}), 400

    path = ensure_drawing_file(page_id)
    arr = load_json(path, [])
    arr.append(drawing)
    save_json(path, arr)
    # คืนค่า index เพื่อใช้ในการอ้างอิงสำหรับการ update/delete
    return jsonify({"status": "ok", "index": len(arr) - 1})

@photoview_bp.route("/update_drawing/<page_id>/<int:index>", methods=["POST"])
def update_drawing(page_id, index):
    """
    อัปเดตข้อมูลวัตถุวาดที่ index ที่กำหนด
    """
    new_data = request.get_json()
    if not new_data:
        return jsonify({"status": "error", "message": "invalid data"}), 400

    path = ensure_drawing_file(page_id)
    arr = load_json(path, [])

    if index < 0 or index >= len(arr):
        return jsonify({"status": "error", "message": "index out of range"}), 400

    arr[index] = new_data
    save_json(path, arr)
    return jsonify({"status": "ok"})

@photoview_bp.route("/delete_drawing/<page_id>/<int:index>", methods=["DELETE"])
def delete_drawing(page_id, index):
    """
    ลบวัตถุวาดที่ index ที่กำหนด
    """
    path = ensure_drawing_file(page_id)
    arr = load_json(path, [])

    if index < 0 or index >= len(arr):
        return jsonify({"status": "error", "message": "index out of range"}), 400

    arr.pop(index)
    save_json(path, arr)
    return jsonify({"status": "ok"})

# ----------------------------------------------------------


# ==========================================================
# DEVICE / CONVERTER
# ==========================================================

@photoview_bp.route("/device_list", methods=["GET"])
def device_list():
    readings = load_json(READINGS_FILE, {})
    convs = load_json(CONVERTORS_FILE, {})

    found = set(readings.keys())

    for conv in convs.values():
        devs = conv.get("devices", {})
        if isinstance(devs, dict):
            found.update(devs.keys())
        elif isinstance(devs, list):
            for d in devs:
                if isinstance(d, dict) and "device_id" in d:
                    found.add(d["device_id"])

    return jsonify(sorted(list(found)))

@photoview_bp.route("/converter_list", methods=["GET"])
def converter_list():
    convs = load_json(CONVERTORS_FILE, {})
    return jsonify(sorted(list(convs.keys())))

# ==========================================================
# DEVICE DATA
# ==========================================================

@photoview_bp.route("/device_data/<dev_id>", methods=["GET"])
def device_data(dev_id):
    readings = load_json(READINGS_FILE, {})

    if dev_id not in readings:
        return jsonify({
            "status": "error",
            "msg": "device not found"
        }), 404

    return jsonify({"status": "ok", "data": readings[dev_id]})

# ==========================================================
# CONVERTER INFO
# ==========================================================

@photoview_bp.route("/convertor_info/<conv_id>", methods=["GET"])
def convertor_info(conv_id):
    convs = load_json(CONVERTORS_FILE, {})

    if conv_id not in convs:
        return jsonify({"status": "error", "msg": "converter not found"}), 404

    conv = convs[conv_id]

    info = {
        "status": "ok",
        "id": conv_id,
        "name": conv.get("name", conv_id),
        "ip": conv.get("ip"),
        "protocol": conv.get("protocol"),
        "devices": []
    }

    devs = conv.get("devices", {})
    if isinstance(devs, dict):
        for dev_id, dev in devs.items():
            info["devices"].append({
                "device_id": dev_id,
                "name": dev.get("name", dev_id),
                "registers": dev.get("registers", [])
            })

    return jsonify(info)

# ==========================================================
# DEVICE PARAMS
# ==========================================================

@photoview_bp.route("/device_params/<dev_id>", methods=["GET"])
def device_params(dev_id):
    readings = load_json(READINGS_FILE, {})
    convs = load_json(CONVERTORS_FILE, {})

    key_list = []
    if dev_id in readings and isinstance(readings[dev_id], dict):
        key_list = [
            k for k in readings[dev_id].keys()
            if k.lower() not in ["timestamp", "device_id", "online"]
        ]

    reg_map = {}
    for conv_id, conv in convs.items():
        devs = conv.get("devices", {})

        if isinstance(devs, dict) and dev_id in devs:
            for r in devs[dev_id].get("registers", []):
                k = r.get("key")
                if k:
                    reg_map[k] = {
                        "unit": r.get("unit"),
                        "address": r.get("address"),
                        "scale": r.get("scale"),
                        "source_conv": conv_id
                    }

        elif isinstance(devs, list):
            for d in devs:
                if d.get("device_id") == dev_id:
                    for r in d.get("registers", []):
                        k = r.get("key")
                        if k:
                            reg_map[k] = {
                                "unit": r.get("unit"),
                                "address": r.get("address"),
                                "scale": r.get("scale"),
                                "source_conv": conv_id
                            }

    all_keys = sorted(list(set(key_list).union(reg_map.keys())))

    params = []
    for k in all_keys:
        info = reg_map.get(k, {})
        params.append({
            "key": k,
            "unit": info.get("unit"),
            "address": info.get("address"),
            "scale": info.get("scale"),
            "source_conv": info.get("source_conv")
        })

    return jsonify({"status": "ok", "device_id": dev_id, "params": params})

# ==========================================================
# ICON UPLOAD
# ==========================================================

@photoview_bp.route("/upload_icon", methods=["POST"])
def upload_icon():
    try:
        if "file" not in request.files:
            return jsonify({"status": "error", "message": "no file"}), 400

        f = request.files["file"]
        name = secure_filename(f.filename)

        if not name.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg")):
            return jsonify({"status": "error", "message": "invalid file type"}), 400

        f.save(os.path.join(UPLOAD_FOLDER, name))

        return jsonify({"status": "ok", "filename": name})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@photoview_bp.route("/icon_list", methods=["GET"])
def icon_list():
    try:
        L = [
            f for f in os.listdir(UPLOAD_FOLDER)
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg"))
        ]
    except:
        return jsonify({"status": "error"}), 500

    return jsonify({"status": "ok", "icons": L})

# ==========================================================
# DEBUG PATH
# ==========================================================

@photoview_bp.route("/debug_path")
def debug_path():
    return jsonify({
        "BASE_DIR": BASE_DIR,
        "PHOTOVIEW_DIR": PHOTOVIEW_DIR,
        "UPLOAD_FOLDER": UPLOAD_FOLDER,
        "PAGES_FILE": PAGES_FILE,
        "STYLES_DIR": STYLE_DIR,
        "READINGS_FILE": READINGS_FILE,
        "CONVERTORS_FILE": CONVERTORS_FILE
    })

# ==========================================================
# ALIAS: ADD PAGE (Uses same core logic as /create_page)
# ==========================================================

@photoview_bp.route("/add_page", methods=["POST"])
def add_page():
    try:
        # Use "page_name" key for this alias route
        name = request.form.get("page_name", "").strip()
        file = request.files.get("file")

        response, status_code = _handle_page_creation(name, file)
        return jsonify(response), status_code

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500