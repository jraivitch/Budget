from flask import Blueprint, render_template, request, jsonify
from app import db
from app.models import SavingsGoal

savings_bp = Blueprint("savings", __name__)


@savings_bp.route("/savings")
def savings_page():
    return render_template("savings.html", active="savings")


@savings_bp.route("/api/savings", methods=["GET"])
def list_savings():
    items = SavingsGoal.query.order_by(SavingsGoal.created_at).all()
    return jsonify({"items": [g.to_dict() for g in items]})


@savings_bp.route("/api/savings", methods=["POST"])
def create_savings():
    data = request.get_json()
    item = SavingsGoal(
        name=data["name"],
        current_amount=float(data.get("current_amount", 0)),
        goal_amount=float(data["goal_amount"]),
        monthly_contribution=float(data.get("monthly_contribution", 0)),
        notes=data.get("notes", ""),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@savings_bp.route("/api/savings/<int:item_id>", methods=["PUT"])
def update_savings(item_id):
    item = SavingsGoal.query.get_or_404(item_id)
    data = request.get_json()
    item.name = data.get("name", item.name)
    item.current_amount = float(data.get("current_amount", item.current_amount))
    item.goal_amount = float(data.get("goal_amount", item.goal_amount))
    item.monthly_contribution = float(data.get("monthly_contribution", item.monthly_contribution))
    item.notes = data.get("notes", item.notes)
    db.session.commit()
    return jsonify(item.to_dict())


@savings_bp.route("/api/savings/<int:item_id>", methods=["DELETE"])
def delete_savings(item_id):
    item = SavingsGoal.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})
