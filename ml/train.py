import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report, mean_absolute_error

# ─────────────────────────────────────────────
# 1. Load dataset
#    Put expanded_india_expense_dataset.csv in
#    the same folder as this file, then run it.
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH  = os.path.join(BASE_DIR, "expense_dataset.csv")

print("Loading dataset...")
df = pd.read_csv(CSV_PATH)

# 2. Features and Labels
X = df['description']
y = df['category']

print(f"Total samples : {len(df)}")
print(f"Categories    : {sorted(y.unique())}\n")

# 3. Train / test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# 4. Build pipeline  (TF-IDF → LinearSVC)
svm_pipeline = Pipeline([
    ('vectorizer', TfidfVectorizer(
        ngram_range=(1, 2),
        stop_words='english',
        sublinear_tf=True       # log-scale TF → better on imbalanced data
    )),
    ('classifier', LinearSVC(
        random_state=42,
        max_iter=2000           # avoid convergence warnings
    ))
])

# 5. Train
print("Training SVM model...")
svm_pipeline.fit(X_train, y_train)

# 6. Evaluate
predictions = svm_pipeline.predict(X_test)
accuracy    = accuracy_score(y_test, predictions)

print(f"\n✅ Accuracy on test set: {accuracy * 100:.2f}%\n")
print("Per-class report:")
print(classification_report(y_test, predictions))

# 7. Quick sanity checks
test_cases = [
    "Zomato online food order",
    "Uber cab ride to airport",
    "Netflix subscription monthly",
    "Electricity bill payment BESCOM",
    "Apollo hospital consultation fee",
    "Amazon shopping kurta",
    "BigBasket grocery delivery",
    "Random expense petty cash",
]

print("--- Sanity Check ---")
for t in test_cases:
    cat = svm_pipeline.predict([t])[0]
    print(f"  '{t}'  →  {cat}")

print(df.head())

# 8. Save classification model
MODEL_PATH = os.path.join(BASE_DIR, "category_model.pkl")
joblib.dump(svm_pipeline, MODEL_PATH)
print(f"\n✅ Classification model saved → {MODEL_PATH}")

# ─────────────────────────────────────────────
# PART 2 — Linear Regression (Spending Predictor)
# ─────────────────────────────────────────────
# We train on synthetic sequences derived from
# the real monthly totals in the CSV dataset.
#
# Real logic: given [month1, month2, month3 ...]
# predict month_next.
#
# We build training sequences like:
#   X_row = [m1, m2, m3]  →  y_row = m4
#   X_row = [m2, m3, m4]  →  y_row = m5
# using a sliding window of size WINDOW.
# ─────────────────────────────────────────────

print("\n─────────────────────────────────────")
print("Training Linear Regression model...")
print("─────────────────────────────────────")

WINDOW = 3   # use last 3 months to predict next month

# Generate synthetic monthly expense sequences for training
# (In production, this will use real per-user monthly totals from MySQL)
# Here we simulate realistic Indian monthly expense values
np.random.seed(42)
num_sequences = 500

X_reg = []
y_reg = []

for _ in range(num_sequences):
    # Simulate a user's 7-month expense history
    base    = np.random.randint(15000, 80000)
    trend   = np.random.uniform(-500, 800)      # slight upward/downward drift
    noise   = np.random.randint(500, 5000)

    monthly = [
        max(0, base + trend * i + np.random.randint(-noise, noise))
        for i in range(WINDOW + 1)
    ]

    # sliding window: first WINDOW months → predict month WINDOW+1
    X_reg.append(monthly[:WINDOW])
    y_reg.append(monthly[WINDOW])

X_reg = np.array(X_reg)
y_reg = np.array(y_reg)

# Train / test split
X_rtrain, X_rtest, y_rtrain, y_rtest = train_test_split(
    X_reg, y_reg, test_size=0.2, random_state=42
)

# Train LinearRegression
reg_model = LinearRegression()
reg_model.fit(X_rtrain, y_rtrain)

# Evaluate
reg_predictions = reg_model.predict(X_rtest)
mae = mean_absolute_error(y_rtest, reg_predictions)
print(f"✅ Regression MAE on test set: ₹{mae:.2f}")
print(f"   (Mean Absolute Error — how far off predictions are on average)")

# Sanity check
sample_months = [32000.0, 35000.0, 29000.0]
pred = reg_model.predict([sample_months])[0]
print(f"\n--- Regression Sanity Check ---")
print(f"  Input  : {sample_months}")
print(f"  Predicted next month: ₹{pred:.2f}")

# Save regression model
REG_MODEL_PATH = os.path.join(BASE_DIR, "regression_model.pkl")
joblib.dump(reg_model, REG_MODEL_PATH)
print(f"\n✅ Regression model saved → {REG_MODEL_PATH}")
print(f"\n🎉 Both models trained and saved successfully!")
print(f"   Now run: python flask_app.py")
