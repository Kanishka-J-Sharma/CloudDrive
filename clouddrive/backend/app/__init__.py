import logging
import os

from flask import Flask
from flask_bcrypt import Bcrypt
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db      = SQLAlchemy()
bcrypt  = Bcrypt()
migrate = Migrate()


def create_app() -> Flask:
    app = Flask(__name__)

    # Load config
    from .config import Config
    app.config.from_object(Config)

    # Extensions
    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)

    # Blueprints
    from .auth  import auth_bp
    from .files import files_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(files_bp)

    # Structured logging to stdout (picked up by Promtail → Loki)
    logging.basicConfig(
        level   = logging.INFO,
        format  = "%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    # Create tables if they don't exist (for dev convenience)
    with app.app_context():
        db.create_all()

    return app


# Entrypoint for `flask run`
app = create_app()
