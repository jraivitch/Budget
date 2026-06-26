from flask import Blueprint, render_template, jsonify, request
from app import db
from app.models import Expense

calendar_bp = Blueprint("calendar", __name__)


@calendar_bp.route("/calendar")
def calendar_page():
    return render_template("calendar.html", active="calendar")


@calendar_bp.route("/api/calendar/bills")
def list_bills():
    """Return only expenses the user has opted in to track on the calendar."""
    expenses = (
        Expense.query
        .filter_by(track_on_calendar=True)
        .order_by(Expense.due_day, Expense.name)
        .all()
    )
    return jsonify({"bills": [e.to_dict() for e in expenses]})


@calendar_bp.route("/api/calendar/all-expenses")
def list_all_expenses():
    """Return all expenses with their track_on_calendar flag for the manage panel."""
    expenses = Expense.query.order_by(Expense.category, Expense.name).all()
    return jsonify({"expenses": [e.to_dict() for e in expenses]})


@calendar_bp.route("/api/calendar/bills/<int:item_id>", methods=["PUT"])
def update_bill(item_id):
    item = Expense.query.get_or_404(item_id)
    data = request.get_json()

    if "due_day" in data:
        due_day = int(data["due_day"])
        if not 1 <= due_day <= 31:
            return jsonify({"error": "due_day must be 1–31"}), 400
        item.due_day = due_day

    if "track_on_calendar" in data:
        item.track_on_calendar = bool(data["track_on_calendar"])

    db.session.commit()
    return jsonify(item.to_dict())
