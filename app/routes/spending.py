import calendar
from datetime import date, datetime
from flask import Blueprint, render_template, request, jsonify
from app import db
from app.models import Expense, Transaction, CategoryLimit

spending_bp = Blueprint("spending", __name__)


@spending_bp.route("/spending")
def spending_page():
    return render_template("spending.html", active="spending", categories=Expense.CATEGORIES)


@spending_bp.route("/api/spending", methods=["GET"])
def list_spending():
    month_str = request.args.get("month")
    if not month_str:
        month_str = date.today().strftime("%Y-%m")

    year, month = map(int, month_str.split("-"))
    _, last_day = calendar.monthrange(year, month)
    start = date(year, month, 1)
    end = date(year, month, last_day)

    transactions = (
        Transaction.query
        .filter(Transaction.date >= start, Transaction.date <= end)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .all()
    )

    expenses = Expense.query.all()
    budgeted = {}
    for e in expenses:
        budgeted[e.category] = budgeted.get(e.category, 0) + e.monthly_amount

    actual = {}
    for t in transactions:
        actual[t.category] = actual.get(t.category, 0) + t.amount

    all_cats = sorted(set(list(budgeted.keys()) + list(actual.keys())))
    by_category = {}
    for cat in all_cats:
        b = round(budgeted.get(cat, 0), 2)
        a = round(actual.get(cat, 0), 2)
        pct = round(a / b * 100, 1) if b > 0 else None
        by_category[cat] = {"budgeted": b, "actual": a, "diff": round(b - a, 2), "pct": pct}

    total_budgeted = round(sum(budgeted.values()), 2)
    total_actual = round(sum(v["actual"] for v in by_category.values()), 2)

    limits = {l.category: l.monthly_limit for l in CategoryLimit.query.all()}

    return jsonify({
        "month": month_str,
        "transactions": [t.to_dict() for t in transactions],
        "by_category": by_category,
        "total_budgeted": total_budgeted,
        "total_actual": total_actual,
        "total_remaining": round(total_budgeted - total_actual, 2),
        "limits": limits,
    })


@spending_bp.route("/api/spending", methods=["POST"])
def create_transaction():
    data = request.get_json()
    t = Transaction(
        date=date.fromisoformat(data["date"]),
        description=data["description"],
        amount=float(data["amount"]),
        category=data["category"],
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@spending_bp.route("/api/spending/<int:item_id>", methods=["PUT"])
def update_transaction(item_id):
    t = Transaction.query.get_or_404(item_id)
    data = request.get_json()
    t.date = date.fromisoformat(data.get("date", t.date.isoformat()))
    t.description = data.get("description", t.description)
    t.amount = float(data.get("amount", t.amount))
    t.category = data.get("category", t.category)
    db.session.commit()
    return jsonify(t.to_dict())


@spending_bp.route("/api/spending/<int:item_id>", methods=["DELETE"])
def delete_transaction(item_id):
    t = Transaction.query.get_or_404(item_id)
    db.session.delete(t)
    db.session.commit()
    return jsonify({"ok": True})


@spending_bp.route("/api/limits", methods=["GET"])
def list_limits():
    limits = CategoryLimit.query.order_by(CategoryLimit.category).all()
    return jsonify({"limits": [l.to_dict() for l in limits]})


@spending_bp.route("/api/limits", methods=["POST"])
def upsert_limit():
    data = request.get_json()
    category = data.get("category", "").strip()
    monthly_limit = float(data.get("monthly_limit", 0))
    if not category or monthly_limit <= 0:
        return jsonify({"error": "category and positive monthly_limit required"}), 400
    limit = CategoryLimit.query.filter_by(category=category).first()
    if limit:
        limit.monthly_limit = monthly_limit
    else:
        limit = CategoryLimit(category=category, monthly_limit=monthly_limit)
        db.session.add(limit)
    db.session.commit()
    return jsonify(limit.to_dict()), 201


@spending_bp.route("/api/limits/<int:item_id>", methods=["DELETE"])
def delete_limit(item_id):
    limit = CategoryLimit.query.get_or_404(item_id)
    db.session.delete(limit)
    db.session.commit()
    return jsonify({"ok": True})
