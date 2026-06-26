from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    from app.routes.dashboard import dashboard_bp
    from app.routes.income import income_bp
    from app.routes.expenses import expenses_bp
    from app.routes.savings import savings_bp
    from app.routes.debt import debt_bp
    from app.routes.allocation import allocation_bp
    from app.routes.scenarios import scenarios_bp
    from app.routes.spending import spending_bp
    from app.routes.calendar import calendar_bp

    app.register_blueprint(dashboard_bp)
    app.register_blueprint(income_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(savings_bp)
    app.register_blueprint(debt_bp)
    app.register_blueprint(allocation_bp)
    app.register_blueprint(scenarios_bp)
    app.register_blueprint(spending_bp)
    app.register_blueprint(calendar_bp)

    with app.app_context():
        db.create_all()

    return app
