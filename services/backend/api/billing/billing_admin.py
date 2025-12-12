# utils/billing_admin.py
from flask import Blueprint, request, jsonify
import json, os

billing_api = Blueprint("billing_admin_api", __name__)
CONFIG_PATH = os.path.join("data", "billing.json")


# --------------------------
# GET /api/billing/get_price
# --------------------------
@billing_api.route("/get_price", methods=["GET"])
def get_price():
    if not os.path.exists(CONFIG_PATH):
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, "w") as f:
            json.dump({"price_per_unit": 0.0}, f, indent=2)
        return jsonify({"price": 0.0})

    with open(CONFIG_PATH, "r") as f:
        data = json.load(f)
    return jsonify({"price": data.get("price_per_unit", 0.0)})


# --------------------------
# POST /api/billing/set_price
# --------------------------
@billing_api.route("/set_price", methods=["POST"])
def set_price():
    req = request.json
    price = req.get("price", None)
    if price is None:
        return jsonify({"status": "error", "message": "Missing price"}), 400

    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump({"price_per_unit": price}, f, indent=2)

    return jsonify({"status": "success", "price": price})
