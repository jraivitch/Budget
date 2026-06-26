from flask import Blueprint, render_template, jsonify, request
from app import db
from app.models import Asset, Debt

networth_bp = Blueprint("networth", __name__)


@networth_bp.route("/networth")
def networth_page():
    return render_template("networth.html", active="networth", categories=Asset.CATEGORIES)


@networth_bp.route("/api/networth")
def get_networth():
    assets = Asset.query.order_by(Asset.category, Asset.name).all()
    debts = Debt.query.order_by(Debt.name).all()

    total_assets = sum(a.value for a in assets)
    total_liabilities = sum(d.balance for d in debts)
    net_worth = total_assets - total_liabilities

    by_asset_category = {}
    for a in assets:
        by_asset_category[a.category] = by_asset_category.get(a.category, 0) + a.value

    return jsonify({
        "assets": [a.to_dict() for a in assets],
        "debts": [d.to_dict() for d in debts],
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "net_worth": round(net_worth, 2),
        "by_asset_category": {k: round(v, 2) for k, v in by_asset_category.items()},
    })


@networth_bp.route("/api/networth/assets", methods=["POST"])
def create_asset():
    data = request.get_json()
    asset = Asset(
        name=data["name"],
        category=data["category"],
        value=float(data["value"]),
    )
    db.session.add(asset)
    db.session.commit()
    return jsonify(asset.to_dict()), 201


@networth_bp.route("/api/networth/assets/<int:item_id>", methods=["PUT"])
def update_asset(item_id):
    asset = Asset.query.get_or_404(item_id)
    data = request.get_json()
    asset.name = data.get("name", asset.name)
    asset.category = data.get("category", asset.category)
    asset.value = float(data.get("value", asset.value))
    db.session.commit()
    return jsonify(asset.to_dict())


@networth_bp.route("/api/networth/assets/<int:item_id>", methods=["DELETE"])
def delete_asset(item_id):
    asset = Asset.query.get_or_404(item_id)
    db.session.delete(asset)
    db.session.commit()
    return jsonify({"ok": True})
