"""
FinSight – ML Microservice
──────────────────────────
Endpoints
  POST /predict-category   →  classify a transaction description
  POST /predict-spending   →  predict next-month spending (LinearRegression)
  GET  /health             →  liveness check

Run:
  pip install flask scikit-learn joblib pandas numpy
  python train.py          ← run this FIRST to generate the .pkl files
  python flask_app.py
"""

import os
import joblib
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────
# Load both models at startup
# ─────────────────────────────────────────────

# 1. Classification model  (TF-IDF + LinearSVC)
CLF_PATH = os.path.join(BASE_DIR, "category_model.pkl")
try:
    clf_pipeline = joblib.load(CLF_PATH)
    print(f"✅ Classification model loaded  →  {CLF_PATH}")
except FileNotFoundError:
    clf_pipeline = None
    print("⚠️  category_model.pkl not found — run train.py first!")

# 2. Regression model  (LinearRegression, window=3)
REG_PATH = os.path.join(BASE_DIR, "regression_model.pkl")
try:
    reg_model = joblib.load(REG_PATH)
    print(f"✅ Regression model loaded      →  {REG_PATH}")
except FileNotFoundError:
    reg_model = None
    print("⚠️  regression_model.pkl not found — run train.py first!")


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status"              : "ok",
        "classification_model": clf_pipeline is not None,
        "regression_model"    : reg_model    is not None
    })


# ── /predict-category ──────────────────────────────────────────────────────
@app.route("/predict-category", methods=["POST"])
def predict_category():
    """
    Request:
      { "description": "Zomato food order" }

    Response:
      { "category": "Food", "confidence": "high" }

    Categories your model knows:
      Bills | Entertainment | Food | Groceries |
      Healthcare | Miscellaneous | Shopping | Travel
    """
    if clf_pipeline is None:
        return jsonify({"error": "Classification model not loaded. Run train.py first."}), 503

    data = request.get_json(silent=True)

    if not data or "description" not in data:
        return jsonify({"error": "Missing 'description' in request body"}), 400

    description = str(data["description"]).strip()
    if not description:
        return jsonify({"error": "'description' cannot be empty"}), 400

    try:
        # Predict category
        category = clf_pipeline.predict([description])[0]

        # LinearSVC exposes decision_function (margin scores), not probabilities
        # Max absolute margin → proxy for how confident the model is
        decision   = clf_pipeline.decision_function([description])[0]
        max_margin = float(np.max(np.abs(decision)))
        confidence = (
            "high"   if max_margin > 1.0 else
            "medium" if max_margin > 0.4 else
            "low"
        )

        return jsonify({
            "category"  : category,
            "confidence": confidence
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── /predict-spending ──────────────────────────────────────────────────────
@app.route("/predict-spending", methods=["POST"])
def predict_spending():
    """
    Uses a trained LinearRegression model (regression_model.pkl).
    The model was trained with a sliding window of 3 months,
    so it needs exactly the last 3 monthly totals to predict the next month.

    Request:
      { "monthly_totals": [32000, 35000, 29000] }
        oldest → newest order

    Response (enough data):
      {
        "predicted_next_month": 31200.45,
        "data_points"         : 3,
        "enough_data"         : true
      }

    Response (not enough data):
      {
        "predicted_next_month": null,
        "data_points"         : 1,
        "enough_data"         : false,
        "message"             : "Need at least 3 months..."
      }
    """
    if reg_model is None:
        return jsonify({"error": "Regression model not loaded. Run train.py first."}), 503

    data = request.get_json(silent=True)

    if not data or "monthly_totals" not in data:
        return jsonify({"error": "Missing 'monthly_totals' in request body"}), 400

    totals = data["monthly_totals"]

    if not isinstance(totals, list):
        return jsonify({"error": "'monthly_totals' must be a list of numbers"}), 400

    try:
        totals = [float(v) for v in totals]
    except (TypeError, ValueError):
        return jsonify({"error": "All values in 'monthly_totals' must be numbers"}), 400

    WINDOW = 3  # must match what train.py used

    if len(totals) < WINDOW:
        return jsonify({
            "predicted_next_month": None,
            "data_points"         : len(totals),
            "enough_data"         : False,
            "message"             : f"Need at least {WINDOW} months of data for a reliable prediction."
        })

    # Use only the most recent WINDOW months
    input_window = np.array(totals[-WINDOW:]).reshape(1, -1)

    try:
        predicted = reg_model.predict(input_window)[0]
        predicted = max(0.0, round(float(predicted), 2))   # clamp negative to 0

        return jsonify({
            "predicted_next_month": predicted,
            "data_points"         : len(totals),
            "enough_data"         : True
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)