import math
from datetime import datetime
from app import db


# ---------------------------------------------------------------------------
# Income
# ---------------------------------------------------------------------------

class Income(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    # weekly | biweekly | monthly | annual
    frequency = db.Column(db.String(20), nullable=False, default="monthly")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    _FREQ = {"weekly": 52 / 12, "biweekly": 26 / 12, "monthly": 1, "annual": 1 / 12}

    @property
    def monthly_amount(self):
        return self.amount * self._FREQ.get(self.frequency, 1)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "amount": self.amount,
            "frequency": self.frequency,
            "monthly_amount": round(self.monthly_amount, 2),
        }


# ---------------------------------------------------------------------------
# Expense
# ---------------------------------------------------------------------------

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    frequency = db.Column(db.String(20), nullable=False, default="monthly")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    _FREQ = {"weekly": 52 / 12, "biweekly": 26 / 12, "monthly": 1, "annual": 1 / 12}

    CATEGORIES = [
        "Housing", "Car", "Food", "Insurance", "Subscriptions",
        "Student Loans", "Savings", "Investing", "Utilities",
        "Healthcare", "Entertainment", "Personal", "Other",
    ]

    @property
    def monthly_amount(self):
        return self.amount * self._FREQ.get(self.frequency, 1)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "amount": self.amount,
            "category": self.category,
            "frequency": self.frequency,
            "monthly_amount": round(self.monthly_amount, 2),
        }


# ---------------------------------------------------------------------------
# Savings Goal
# ---------------------------------------------------------------------------

class SavingsGoal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    current_amount = db.Column(db.Float, nullable=False, default=0)
    goal_amount = db.Column(db.Float, nullable=False)
    monthly_contribution = db.Column(db.Float, nullable=False, default=0)
    notes = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def progress_pct(self):
        if self.goal_amount == 0:
            return 100.0
        return min(100.0, round(self.current_amount / self.goal_amount * 100, 1))

    @property
    def months_remaining(self):
        remaining = self.goal_amount - self.current_amount
        if remaining <= 0:
            return 0
        if self.monthly_contribution <= 0:
            return None
        return math.ceil(remaining / self.monthly_contribution)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "current_amount": self.current_amount,
            "goal_amount": self.goal_amount,
            "monthly_contribution": self.monthly_contribution,
            "notes": self.notes,
            "progress_pct": self.progress_pct,
            "months_remaining": self.months_remaining,
        }


# ---------------------------------------------------------------------------
# Debt
# ---------------------------------------------------------------------------

class Debt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    balance = db.Column(db.Float, nullable=False)
    interest_rate = db.Column(db.Float, nullable=False, default=0)
    minimum_payment = db.Column(db.Float, nullable=False)
    extra_payment = db.Column(db.Float, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def total_payment(self):
        return self.minimum_payment + self.extra_payment

    @property
    def payoff_months(self):
        balance = self.balance
        rate = self.interest_rate / 100 / 12
        payment = self.total_payment

        if payment <= 0 or balance <= 0:
            return None
        if rate == 0:
            return math.ceil(balance / payment)
        if payment <= balance * rate:
            return None  # Doesn't cover interest
        months = -math.log(1 - (balance * rate) / payment) / math.log(1 + rate)
        return math.ceil(months)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "balance": self.balance,
            "interest_rate": self.interest_rate,
            "minimum_payment": self.minimum_payment,
            "extra_payment": self.extra_payment,
            "total_payment": self.total_payment,
            "payoff_months": self.payoff_months,
        }


# ---------------------------------------------------------------------------
# Allocation
# ---------------------------------------------------------------------------

class Allocation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(100), nullable=False, unique=True)
    amount = db.Column(db.Float, nullable=False, default=0)

    DEFAULT_CATEGORIES = [
        "Emergency Fund",
        "Student Loans",
        "Car Payment",
        "Investing",
        "Fun Money",
        "Miscellaneous",
    ]

    def to_dict(self):
        return {"id": self.id, "category": self.category, "amount": self.amount}


# ---------------------------------------------------------------------------
# Transaction (actual spending log)
# ---------------------------------------------------------------------------

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "description": self.description,
            "amount": self.amount,
            "category": self.category,
        }
