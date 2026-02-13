import json, os, sys

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    ROOT = os.path.dirname(sys.executable)
else:
    ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", "..", "..", ".."))
DATA_DIR = os.path.join(ROOT, "data")
RULE_PATH = os.path.join(DATA_DIR, "event_rules.json")

if not os.path.exists(os.path.dirname(RULE_PATH)):
    os.makedirs(os.path.dirname(RULE_PATH), exist_ok=True)

if not os.path.exists(RULE_PATH):
    with open(RULE_PATH, "w", encoding="utf-8") as f:
        f.write("[]")


def load_event_rules():
    with open(RULE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_event_rules(rules):
    with open(RULE_PATH, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)


def add_event_rule(rule):
    rules = load_event_rules()
    rule["id"] = (rules[-1]["id"] + 1) if rules else 1
    rules.append(rule)
    save_event_rules(rules)
    return rule


def update_event_rule(rule_id, data):
    rules = load_event_rules()
    for r in rules:
        if r["id"] == rule_id:
            r.update(data)
            save_event_rules(rules)
            return r
    return None


def delete_event_rule(rule_id):
    rules = load_event_rules()
    rules = [r for r in rules if r["id"] != rule_id]
    save_event_rules(rules)
