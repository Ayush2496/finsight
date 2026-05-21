# FinSight 💰
> A full-stack personal finance manager with AI-powered spending predictions, built as a college project.

---

## Overview

FinSight lets users track income and expenses, visualize spending patterns, set category budgets, and get ML-based predictions for next month's spending — all in a clean, dark-themed dashboard.

---

## Features

- **Dashboard** — Monthly summary, all-time balance, savings yield, and a 6-month income vs expense trend
- **Smart Categorization** — Transaction descriptions are automatically classified into categories using a trained SVM model
- **Spending Prediction** — Linear regression predicts next month's total based on recent history
- **Overspending Alerts** — Warns when predicted spending exceeds the 3-month average by more than 20%
- **Analytics** — Category-wise expense breakdowns with Chart.js visualizations
- **Secure Auth** — Cookie-based sessions with bcrypt password hashing

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, Vanilla JS, AngularJS 1.8, Tailwind CSS, Chart.js |
| Backend | Node.js, Express, express-session, bcrypt |
| Database | MySQL |
| ML Microservice | Python, Flask, scikit-learn (TF-IDF + LinearSVC, Linear Regression) |

---

## Folder Structure

```
finsight/
├── frontend/
│   ├── index.html
│   ├── regis.html
│   ├── dashboard.html
│   ├── transactions.html
│   ├── analytics.html
│   ├── app.js
│   └── style.css
│
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── middleware/
│   │   └── auth.js
│   └── routes/
│       ├── auth.js
│       ├── transactions.js
│       └── dashboard.js
│
└── ml/
    ├── train.py
    ├── flask_app.py
    ├── expanded_india_expense_dataset.csv
    ├── category_model.pkl
    └── regression_model.pkl
```

---

## Architecture

Three independently running services:

```
Frontend (port 5500)  →  Node.js Backend (port 3000)  →  MySQL
                                   ↓
                         Python Flask ML (port 5000)
```

The ML layer is fully decoupled — if it goes offline, the app falls back gracefully without crashing.

---

## Design Decisions

**Expenses as negative numbers** — Stored as negative values in the DB, so `WHERE amount < 0` means expenses and `WHERE amount >= 0` means income. No need for a separate `type` column.

**Isolated ML microservice** — Flask runs as a separate process so models can be retrained or swapped without touching the backend. Node.js catches any axios errors and falls back to "Miscellaneous" silently.

**Session-based auth over JWT** — Keeps auth logic entirely server-side and makes logout (session destroy) reliable. Cookies use `httpOnly` and `sameSite: lax`.

**Budgets in localStorage** — Budget limits are a UI preference, so they live in the browser rather than adding an extra DB table.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
