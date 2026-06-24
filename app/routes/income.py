from flask import Blueprint, render_template, request, jsonify
from app import db
from app.models import Income

income_bp = Blueprint("income", __name__)


@income_bp.route("/income")
def income_page():
    return render_template("income.html", active="income")


@income_bp.route("/api/income", methods=["GET"])
def list_income():
    items = Income.query.order_by(Income.created_at).all()
    total = sum(i.monthly_amount for i in items)
    return jsonify({"items": [i.to_dict() for i in items], "monthly_total": round(total, 2)})


@income_bp.route("/api/income", methods=["POST"])
def create_income():
    data = request.get_json()
    item = Income(
        name=data["name"],
        amount=float(data["amount"]),
        frequency=data.get("frequency", "monthly"),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@income_bp.route("/api/income/<int:item_id>", methods=["PUT"])
def update_income(item_id):
    item = Income.query.get_or_404(item_id)
    data = request.get_json()
    item.name = data.get("name", item.name)
    item.amount = float(data.get("amount", item.amount))
    item.frequency = data.get("frequency", item.frequency)
    db.session.commit()
    return jsonify(item.to_dict())


@income_bp.route("/api/income/<int:item_id>", methods=["DELETE"])
def delete_income(item_id):
    item = Income.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})
