import json
import os
import sys

if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
    PROJECTS_ROOT = os.path.join(ROOT, 'projects')
else:
    PROJECTS_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "projects"))

def _get_rules_path(project_id):
    if not project_id:
        return os.path.join(os.path.dirname(__file__), "storage.json")
    return os.path.join(PROJECTS_ROOT, project_id, "alert", "alert_rules.json")

def load_rules(project_id=None):
    file_path = _get_rules_path(project_id)
    if not os.path.exists(file_path):
        # Return empty list and don't create file yet, or create empty list file
        return []

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            rules = json.load(f)
    except:
        rules = []

    # Backward compatibility defaults
    for r in rules:
        r.setdefault("rule_name", r.get("metric", "Untitled rule"))
        r.setdefault("metric", r.get("metric", ""))
        r.setdefault("operator", r.get("operator", ">"))
        r.setdefault("threshold", r.get("threshold", 0))
        r.setdefault("severity", r.get("severity", "info"))
        r.setdefault("message", r.get("message", ""))
        r.setdefault("is_active", r.get("is_active", True))

    return rules

def save_rules(project_id, rules):
    file_path = _get_rules_path(project_id)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=4)

def add_rule(project_id, rule):
    rules = load_rules(project_id)
    # Generate new ID based on existing max
    existing_ids = [int(r.get("id", 0)) for r in rules if str(r.get("id", "")).isdigit()]
    new_id = (max(existing_ids) + 1) if existing_ids else 1
    
    rule["id"] = new_id
    rule.setdefault("rule_name", rule.get("metric", "Untitled rule"))
    rule.setdefault("severity", "info")
    rule.setdefault("is_active", True)
    
    rules.append(rule)
    save_rules(project_id, rules)
    return rule

def update_rule(project_id, rule_id, new_data):
    rules = load_rules(project_id)
    updated = None
    for r in rules:
        if str(r.get("id")) == str(rule_id):
            r.update(new_data)
            updated = r
            break
    save_rules(project_id, rules)
    return updated

def delete_rule(project_id, rule_id):
    rules = load_rules(project_id)
    original_len = len(rules)
    rules = [r for r in rules if str(r.get("id")) != str(rule_id)]
    if len(rules) != original_len:
        save_rules(project_id, rules)
        return True
    return False
