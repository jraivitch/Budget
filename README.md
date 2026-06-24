# Budget Planner

A polished, interactive personal finance dashboard built with Python (Flask) + SQLite + vanilla JS.

## Features

| Section | What you can do |
|---|---|
| **Dashboard** | Monthly income, expenses, cash flow, savings rate, debt payments, net worth |
| **Income** | Add/edit/delete income sources with frequency (weekly → annual auto-conversion) |
| **Expenses** | Categorized recurring expenses with full CRUD |
| **Savings Goals** | Track current vs. target with progress bars and ETA calculations |
| **Debt Tracker** | Balance, APR, minimum + extra payments, payoff timeline |
| **Allocation Planner** | Assign every dollar to a bucket, see over/under budget live |
| **Scenario Planner** | Drag sliders to model extra savings/investing/debt payments — 5-year chart updates in real time |

## Tech Stack

- **Backend**: Python 3.11+, Flask 3, Flask-SQLAlchemy, SQLite
- **Frontend**: Vanilla JS (no frameworks), Chart.js, Font Awesome
- **Styling**: Custom CSS with CSS variables — no Bootstrap or Tailwind

## Quick Start

### 1. Clone and enter the project

```bash
git clone <your-repo-url>
cd Budget
```

### 2. Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate        # Mac / Linux
# venv\Scripts\activate         # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Seed the database with example data

```bash
python seed_data.py
```

This pre-fills the app with realistic fictional data across all sections — income, expenses, savings goals, debts, and allocations — so you can explore the UI right away and replace values with your own.

### 5. Run the app

```bash
python run.py
```

Open **http://localhost:5001** in your browser.

> **Note**: Port 5001 is used because macOS AirPlay Receiver occupies port 5000 by default. Change the port in `run.py` if needed.

## Project Structure

```
Budget/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── models.py            # SQLAlchemy models (Income, Expense, SavingsGoal, Debt, Allocation)
│   ├── routes/
│   │   ├── dashboard.py     # / and /api/dashboard
│   │   ├── income.py        # /income, /api/income CRUD
│   │   ├── expenses.py      # /expenses, /api/expenses CRUD
│   │   ├── savings.py       # /savings, /api/savings CRUD
│   │   ├── debt.py          # /debt, /api/debt CRUD
│   │   ├── allocation.py    # /allocation, /api/allocation CRUD
│   │   └── scenarios.py     # /scenarios, /api/scenarios/baseline
│   ├── static/
│   │   ├── css/main.css     # All styles — dark sidebar, card layout, responsive
│   │   └── js/app.js        # All client JS — fetch helpers, chart renderers, page inits
│   └── templates/
│       ├── base.html        # Sidebar layout, nav, CDN imports
│       ├── dashboard.html
│       ├── income.html
│       ├── expenses.html
│       ├── savings.html
│       ├── debt.html
│       ├── allocation.html
│       └── scenarios.html
├── instance/
│   └── budget.db            # SQLite database (auto-created, gitignored)
├── config.py                # Flask config (DB path, secret key)
├── run.py                   # App entry point
├── seed_data.py             # One-time database seeder
└── requirements.txt
```

## Development Tips

- **Re-seed**: Run `python seed_data.py` any time to wipe and reset example data.
- **Custom secret key**: Set `SECRET_KEY` environment variable before running in production.
- **Database location**: `instance/budget.db` — back it up to preserve your data.
- **Adding categories**: Expense categories are defined in `app/models.py` → `Expense.CATEGORIES`.

## Roadmap Ideas

- [ ] CSV export of transactions
- [ ] Monthly snapshots / historical tracking
- [ ] Multiple user accounts
- [ ] Mobile PWA (add to home screen)
- [ ] Plaid integration for automatic transaction import
- [ ] Dark mode toggle
