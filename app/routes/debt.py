from flask import Blueprint, render_template, request, jsonify
from app import db
from app.models import Debt

debt_bp = Blueprint("debt", __name__)


@debt_bp.route("/debt")
def debt_page():
    return render_template("debt.html", active="debt")


@debt_bp.route("/api/debt", methods=["GET"])
def list_debt():
    items = Debt.query.order_by(Debt.created_at).all()
    total_balance = sum(d.balance for d in items)
    total_payment = sum(d.total_payment for d in items)
    return jsonify(
        {
            "items": [d.to_dict() for d in items],
            "total_balance": round(total_balance, 2),
            "total_payment": round(total_payment, 2),
        }
    )


@debt_bp.route("/api/debt", methods=["POST"])
def create_debt():
    data = request.get_json()
    item = Debt(
        name=data["name"],
        balance=float(data["balance"]),
        interest_rate=float(data.get("interest_rate", 0)),
        minimum_payment=float(data["minimum_payment"]),
        extra_payment=float(data.get("extra_payment", 0)),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@debt_bp.route("/api/debt/<int:item_id>", methods=["PUT"])
def update_debt(item_id):
    item = Debt.query.get_or_404(item_id)
    data = request.get_json()
    item.name = data.get("name", item.name)
    item.balance = float(data.get("balance", item.balance))
    item.interest_rate = float(data.get("interest_rate", item.interest_rate))
    item.minimum_payment = float(data.get("minimum_payment", item.minimum_payment))
    item.extra_payment = float(data.get("extra_payment", item.extra_payment))
    db.session.commit()
    return jsonify(item.to_dict())


@debt_bp.route("/api/debt/<int:item_id>", methods=["DELETE"])
def delete_debt(item_id):
    item = Debt.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})
