from flask import Blueprint, render_template, request, jsonify
from app import db
from app.models import Allocation, Income

allocation_bp = Blueprint("allocation", __name__)


def _ensure_defaults():
    """Seed default allocation categories if none exist yet."""
    if Allocation.query.count() == 0:
        for cat in Allocation.DEFAULT_CATEGORIES:
            db.session.add(Allocation(category=cat, amount=0))
        db.session.commit()


@allocation_bp.route("/allocation")
def allocation_page():
    _ensure_defaults()
    return render_template("allocation.html", active="allocation")


@allocation_bp.route("/api/allocation", methods=["GET"])
def list_allocation():
    _ensure_defaults()
    items = Allocation.query.order_by(Allocation.id).all()
    monthly_income = sum(i.monthly_amount for i in Income.query.all())
    total_allocated = sum(a.amount for a in items)
    return jsonify(
        {
            "items": [a.to_dict() for a in items],
            "monthly_income": round(monthly_income, 2),
            "total_allocated": round(total_allocated, 2),
            "remaining": round(monthly_income - total_allocated, 2),
        }
    )


@allocation_bp.route("/api/allocation/<int:item_id>", methods=["PUT"])
def update_allocation(item_id):
    item = Allocation.query.get_or_404(item_id)
    data = request.get_json()
    item.amount = float(data.get("amount", item.amount))
    db.session.commit()
    return jsonify(item.to_dict())


@allocation_bp.route("/api/allocation/category", methods=["POST"])
def add_allocation_category():
    data = request.get_json()
    cat = data.get("category", "").strip()
    if not cat:
        return jsonify({"error": "Category name required"}), 400
    existing = Allocation.query.filter_by(category=cat).first()
    if existing:
        return jsonify({"error": "Category already exists"}), 409
    item = Allocation(category=cat, amount=float(data.get("amount", 0)))
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@allocation_bp.route("/api/allocation/<int:item_id>", methods=["DELETE"])
def delete_allocation(item_id):
    item = Allocation.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})
