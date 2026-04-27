import pytest
from app import create_app, db as _db
from app.models import User

@pytest.fixture(scope="session")
def app():
    app = create_app()
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key-for-testing-only",
        "JWT_EXPIRY": __import__("datetime").timedelta(hours=1),
        "RATELIMIT_ENABLED": False,
        "MAIL_SUPPRESS_SEND": True,
    })
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_client(client, app):
    with app.app_context():
        from app.models import User
        from app import bcrypt
        user = User(
            email="testuser@example.com",
            password_hash=bcrypt.generate_password_hash("TestPass123!").decode(),
            is_verified=True
        )
        _db.session.add(user)
        _db.session.commit()

    resp = client.post("/api/auth/login", json={
        "email": "testuser@example.com",
        "password": "TestPass123!"
    })
    return client
