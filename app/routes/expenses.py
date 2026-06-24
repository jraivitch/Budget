from flask import Blueprint, render_template, request, jsonify
from app import db
from app.models import Expense

expenses_bp = Blueprint("expenses", __name__)


@expenses_bp.route("/expenses")
def expenses_page():
    return render_template("expenses.html", active="expenses", categories=Expense.CATEGORIES)


@expenses_bp.route("/api/expenses", methods=["GET"])
def list_expenses():
    items = Expense.query.order_by(Expense.category, Expense.name).all()
    total = sum(e.monthly_amount for e in items)
    return jsonify({"items": [e.to_dict() for e in items], "monthly_total": round(total, 2)})


@expenses_bp.route("/api/expenses", methods=["POST"])
def create_expense():
    data = request.get_json()
    item = Expense(
        name=data["name"],
        amount=float(data["amount"]),
        category=data["category"],
        frequency=data.get("frequency", "monthly"),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@expenses_bp.route("/api/expenses/<int:item_id>", methods=["PUT"])
def update_expense(item_id):
    item = Expense.query.get_or_404(item_id)
    data = request.get_json()
    item.name = data.get("name", item.name)
    item.amount = float(data.get("amount", item.amount))
    item.category = data.get("category", item.category)
    item.frequency = data.get("frequency", item.frequency)
    db.session.commit()
    return jsonify(item.to_dict())


@expenses_bp.route("/api/expenses/<int:item_id>", methods=["DELETE"])
def delete_expense(item_id):
    item = Expense.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})
