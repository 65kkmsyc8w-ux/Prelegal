import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import get_session
from app.domain.models import Base
from app.main import app
from app.routers import chat as chat_router

PASSWORD = "opensesame"


@pytest.fixture
def session_factory():
    # In memory, so no test touches the real database file. StaticPool keeps
    # every connection on the one in-memory database rather than giving each
    # its own empty copy.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    engine.dispose()


@pytest.fixture
def client(session_factory):
    # TestClient without `with`, so the lifespan never runs and init_db never
    # opens the real database.
    def override_session():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def signed_in_as(client):
    """Opens an account and hands back a client carrying its session. A second
    call gives a second account with its own cookie jar, which is what the
    ownership tests need."""

    def open_account(email="ada@example.com", display_name="Ada"):
        caller = TestClient(app)
        response = caller.post(
            "/api/auth/signup",
            json={
                "email": email,
                "display_name": display_name,
                "password": PASSWORD,
            },
        )
        assert response.status_code == 201
        return caller

    return open_account


@pytest.fixture
def signed_in_client(signed_in_as):
    return signed_in_as()


@pytest.fixture
def ai_turn(monkeypatch):
    """Stubs the provider with a fixed structured turn, so no test in the
    default run reaches OpenRouter. The schema differs between the front desk,
    which only names a document, and drafting, which also reports fields."""

    def set_turn(reply="Noted.", document=None, **fields):
        def answer(_messages, schema):
            answered = {"reply": reply, "document": document}
            if "fields" in schema.model_fields:
                answered["fields"] = fields
            return schema.model_validate(answered)

        monkeypatch.setattr(chat_router.client, "complete_structured", answer)

    return set_turn
