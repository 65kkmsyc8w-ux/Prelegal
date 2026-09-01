import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import get_session
from app.domain.models import Base
from app.main import app


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
def signed_in_client(client):
    response = client.post("/api/auth/session", json={"display_name": "Ada"})
    assert response.status_code == 200
    return client
