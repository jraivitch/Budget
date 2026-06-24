"""
Run once to pre-populate the database with example data.
Usage:  python seed_data.py
"""

from app import create_app, db
from app.models import Income, Expense, SavingsGoal, Debt, Allocation


def seed():
    app = create_app()
    with app.app_context():
        # Wipe existing seed data so re-runs are idempotent
        for model in (Income, Expense, SavingsGoal, Debt, Allocation):
            model.query.delete()
        db.session.commit()

        # ------------------------------------------------------------------
        # Income
        # ------------------------------------------------------------------
        # Net take-home after taxes and 401k deduction
        db.session.add(Income(name="Salary (Net Take-Home)", amount=4800, frequency="monthly"))
        db.session.commit()

        # ------------------------------------------------------------------
        # Expenses
        # ------------------------------------------------------------------
        expenses = [
            # Housing
            Expense(name="Rent", amount=1200, category="Housing", frequency="monthly"),
            # Car
            Expense(name="Car Payment", amount=280, category="Car", frequency="monthly"),
            Expense(name="Car Insurance", amount=95, category="Car", frequency="monthly"),
            Expense(name="Gas", amount=60, category="Car", frequency="monthly"),
            # Food
            Expense(name="Groceries", amount=300, category="Food", frequency="monthly"),
            Expense(name="Dining Out", amount=150, category="Food", frequency="monthly"),
            # Student Loans
            Expense(name="Student Loan", amount=185, category="Student Loans", frequency="monthly"),
            Expense(name="Better Career Loan", amount=250, category="Student Loans", frequency="monthly"),
            # Insurance
            Expense(name="Health Insurance", amount=120, category="Insurance", frequency="monthly"),
            # Subscriptions
            Expense(name="Netflix / Streaming", amount=40, category="Subscriptions", frequency="monthly"),
            Expense(name="Gym Membership", amount=35, category="Subscriptions", frequency="monthly"),
            Expense(name="Phone", amount=65, category="Subscriptions", frequency="monthly"),
            # Utilities
            Expense(name="Electric & Internet", amount=110, category="Utilities", frequency="monthly"),
            # Investing (tracked as an expense so it shows up in budget)
            Expense(name="401k Contribution (4%)", amount=220, category="Investing", frequency="monthly"),
            Expense(name="Brokerage / IRA", amount=150, category="Investing", frequency="monthly"),
            # Personal
            Expense(name="Clothing / Personal", amount=75, category="Personal", frequency="monthly"),
        ]
        db.session.add_all(expenses)
        db.session.commit()

        # ------------------------------------------------------------------
        # Savings Goals
        # ------------------------------------------------------------------
        db.session.add(
            SavingsGoal(
                name="Emergency Fund (6 months)",
                current_amount=8500,
                goal_amount=15000,
                monthly_contribution=300,
                notes="Target: 6 months of expenses in HYSA",
            )
        )
        db.session.add(
            SavingsGoal(
                name="House Down Payment",
                current_amount=2000,
                goal_amount=25000,
                monthly_contribution=400,
                notes="20% down on a starter home",
            )
        )
        db.session.commit()

        # ------------------------------------------------------------------
        # Debts
        # ------------------------------------------------------------------
        debts = [
            Debt(
                name="Car Loan",
                balance=7200,
                interest_rate=6.9,
                minimum_payment=280,
                extra_payment=0,
            ),
            Debt(
                name="Student Loan",
                balance=9400,
                interest_rate=4.5,
                minimum_payment=185,
                extra_payment=0,
            ),
            # 4 payments remaining × $250 = $1,000 balance
            Debt(
                name="Better Career Loan",
                balance=1000,
                interest_rate=0.0,
                minimum_payment=250,
                extra_payment=0,
            ),
        ]
        db.session.add_all(debts)
        db.session.commit()

        # ------------------------------------------------------------------
        # Allocations
        # ------------------------------------------------------------------
        allocations = [
            Allocation(category="Emergency Fund", amount=300),
            Allocation(category="Student Loans", amount=185),
            Allocation(category="Car Payment", amount=280),
            Allocation(category="Investing", amount=150),
            Allocation(category="Fun Money", amount=200),
            Allocation(category="Miscellaneous", amount=100),
        ]
        db.session.add_all(allocations)
        db.session.commit()

        print("✓ Database seeded successfully.")
        print("  Income sources : 1")
        print(f"  Expenses       : {len(expenses)}")
        print("  Savings goals  : 2")
        print(f"  Debts          : {len(debts)}")
        print("  Allocations    : 6")


if __name__ == "__main__":
    seed()
