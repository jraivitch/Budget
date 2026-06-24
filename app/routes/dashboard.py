from flask import Blueprint, render_template, jsonify
from app.models import Income, Expense, SavingsGoal, Debt

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
def index():
    return render_template("dashboard.html", active="dashboard")


@dashboard_bp.route("/api/dashboard")
def api_dashboard():
    incomes = Income.query.all()
    expenses = Expense.query.all()
    savings_goals = SavingsGoal.query.all()
    debts = Debt.query.all()

    total_income = sum(i.monthly_amount for i in incomes)
    total_expenses = sum(e.monthly_amount for e in expenses)
    cash_flow = total_income - total_expenses
    savings_rate = (cash_flow / total_income * 100) if total_income > 0 else 0

    # Aggregate expenses by category for pie chart
    by_category: dict[str, float] = {}
    for e in expenses:
        by_category[e.category] = by_category.get(e.category, 0) + e.monthly_amount

    total_debt_payments = sum(d.minimum_payment + d.extra_payment for d in debts)
    total_debt_balance = sum(d.balance for d in debts)
    total_savings = sum(g.current_amount for g in savings_goals)

    return jsonify(
        {
            "monthly_income": round(total_income, 2),
            "monthly_expenses": round(total_expenses, 2),
            "cash_flow": round(cash_flow, 2),
            "savings_rate": round(savings_rate, 1),
            "total_debt_payments": round(total_debt_payments, 2),
            "total_debt_balance": round(total_debt_balance, 2),
            "total_savings": round(total_savings, 2),
            "net_worth": round(total_savings - total_debt_balance, 2),
            "expense_by_category": {k: round(v, 2) for k, v in by_category.items()},
        }
    )
