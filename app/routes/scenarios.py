from flask import Blueprint, render_template, jsonify
from app.models import Income, Expense, SavingsGoal, Debt

scenarios_bp = Blueprint("scenarios", __name__)


@scenarios_bp.route("/scenarios")
def scenarios_page():
    return render_template("scenarios.html", active="scenarios")


@scenarios_bp.route("/api/scenarios/baseline")
def baseline():
    """Return the current financial snapshot so the JS planner can seed its inputs."""
    incomes = Income.query.all()
    expenses = Expense.query.all()
    debts = Debt.query.all()
    goals = SavingsGoal.query.all()

    monthly_income = sum(i.monthly_amount for i in incomes)
    monthly_expenses = sum(e.monthly_amount for e in expenses)
    total_debt = sum(d.balance for d in debts)
    current_savings = sum(g.current_amount for g in goals)

    # Extra payment already applied across all debts
    extra_debt_payments = sum(d.extra_payment for d in debts)

    return jsonify(
        {
            "monthly_income": round(monthly_income, 2),
            "monthly_expenses": round(monthly_expenses, 2),
            "cash_flow": round(monthly_income - monthly_expenses, 2),
            "total_debt": round(total_debt, 2),
            "current_savings": round(current_savings, 2),
            "extra_debt_payments": round(extra_debt_payments, 2),
            "debts": [d.to_dict() for d in debts],
            "goals": [g.to_dict() for g in goals],
        }
    )
