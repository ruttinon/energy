import os
import json
from pathlib import Path

# ================================================
# Locate project root (modbus_json)
# ================================================

BASE_DIR = Path(__file__).resolve()

while BASE_DIR.name not in ("modbus_json",) and BASE_DIR.parent != BASE_DIR:
    BASE_DIR = BASE_DIR.parent

if BASE_DIR.name != "modbus_json":
    BASE_DIR = Path(__file__).resolve().parents[3]

TEMPLATE_DIR = BASE_DIR / "data" / "report_templates"
TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)

print(f"[TEMPLATE_STORAGE] USING TEMPLATE_DIR = {TEMPLATE_DIR}")


# ================================================
# Build full JSON file path
# ================================================
def template_path(template_id: str):
    return TEMPLATE_DIR / f"{template_id}.json"


# ================================================
# Normalize JSON (very important)
# ================================================
def normalize_template(template_id: str, data: dict):
    """
    Normalize template so every part of system uses same format.
    Also auto-migrate old format:
        - old: elements[] อยู่ root
        - new: pages[i]["elements"]
    """

    fixed_id = str(data.get("template_id", template_id))

    data["template_id"] = fixed_id
    data["id"] = fixed_id
    data["name"] = data.get("name", f"Template {fixed_id}")
    data["desc"] = data.get("desc", "")

    # Ensure keys exist
    pages = data.get("pages", [])
    root_elements = data.get("elements", [])

    # CASE A: no pages → create 1 page and move all elements to it
    if not pages:
        data["pages"] = [{
            "w": data.get("w", 794),
            "h": data.get("h", 1123),
            "elements": root_elements
        }]
        data["elements"] = []
        return data

    # CASE B: pages exist but NO elements inside page → migrate root elements
    moved = False
    for page in data["pages"]:
        if "elements" not in page or not isinstance(page["elements"], list):
            page["elements"] = []

    if root_elements:
        # migrate to first page
        data["pages"][0]["elements"].extend(root_elements)
        data["elements"] = []
        moved = True

    # Remove invalid empty fields
    data.setdefault("pages", [])
    data["elements"] = []  # always empty in new system

    return data


# ================================================
# SAVE
# ================================================
def save_template(template_id: str, data: dict):
    try:
        data = normalize_template(template_id, data)

        with open(template_path(template_id), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"[TEMPLATE_STORAGE] SAVED: {template_path(template_id)}")
        return True

    except Exception as e:
        print(f"[TEMPLATE_STORAGE] ERROR saving {template_id}: {e}")
        return False


# ================================================
# LOAD
# ================================================
def load_template(template_id: str):
    path = template_path(template_id)

    if not path.exists():
        print(f"[TEMPLATE_STORAGE] NOT FOUND: {path}")
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return normalize_template(template_id, data)
    except Exception as e:
        print(f"[TEMPLATE_STORAGE] ERROR loading {template_id}: {e}")
        return None


# ================================================
# LIST (FOR BILLING ADMIN UI)
# ================================================
def list_templates():
    templates = []

    try:
        for p in TEMPLATE_DIR.glob("*.json"):
            if p.name == "default_template.json":
                continue

            try:
                with open(p, "r", encoding="utf-8") as f:
                    js = json.load(f)

                js = normalize_template(p.stem, js)

                templates.append({
                    "id": js["template_id"],
                    "name": js["name"],
                    "desc": js["desc"]
                })

            except Exception as e:
                print(f"[TEMPLATE_STORAGE] ERROR reading {p}: {e}")

        print(f"[TEMPLATE_STORAGE] LIST = {templates}")
        return templates

    except Exception as e:
        print(f"[TEMPLATE_STORAGE] ERROR listing: {e}")
        return []


# ================================================
# LIST RAW (FOR REPORT EDITOR)
# ================================================
def list_templates_raw():
    try:
        items = [
            p.stem for p in TEMPLATE_DIR.glob("*.json")
            if p.name != "default_template.json"
        ]
        return items
    except:
        return []


# ================================================
# DELETE
# ================================================
def delete_template(template_id: str):
    path = template_path(template_id)
    try:
        if path.exists():
            path.unlink()
            print(f"[TEMPLATE_STORAGE] DELETED: {path}")
            return True
    except Exception as e:
        print(f"[TEMPLATE_STORAGE] ERROR deleting {template_id}: {e}")

    return False
