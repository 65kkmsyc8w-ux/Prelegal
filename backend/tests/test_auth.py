from sqlalchemy import select

from app.core.security import SESSION_COOKIE, create_session
from app.domain.models import User
from app.domain.users import sign_in


def test_signing_in_opens_an_account_and_sets_a_cookie(client):
    response = client.post("/api/auth/session", json={"display_name": "Ada"})

    assert response.status_code == 200
    assert response.json()["display_name"] == "Ada"
    assert SESSION_COOKIE in response.cookies


def test_the_session_cookie_is_not_readable_from_script(client):
    response = client.post("/api/auth/session", json={"display_name": "Ada"})

    assert "httponly" in response.headers["set-cookie"].lower()


def test_signing_in_again_returns_to_the_same_account(client):
    first = client.post("/api/auth/session", json={"display_name": "Ada"}).json()
    second = client.post("/api/auth/session", json={"display_name": "Ada"}).json()

    assert first["id"] == second["id"]


def test_a_different_name_opens_a_different_account(client):
    ada = client.post("/api/auth/session", json={"display_name": "Ada"}).json()
    grace = client.post("/api/auth/session", json={"display_name": "Grace"}).json()

    assert ada["id"] != grace["id"]


def test_a_name_typed_with_stray_spaces_is_the_same_account(client):
    typed = client.post("/api/auth/session", json={"display_name": "Ada"}).json()
    retyped = client.post("/api/auth/session", json={"display_name": "  Ada "}).json()

    assert typed["id"] == retyped["id"]
    assert retyped["display_name"] == "Ada"


def test_a_name_of_nothing_but_spaces_is_refused(client):
    response = client.post("/api/auth/session", json={"display_name": "   "})

    assert response.status_code == 422


def test_a_name_longer_than_the_column_is_refused(client):
    response = client.post("/api/auth/session", json={"display_name": "a" * 61})

    assert response.status_code == 422


def test_me_names_the_signed_in_user(signed_in_client):
    response = signed_in_client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["display_name"] == "Ada"


def test_me_refuses_a_caller_who_never_signed_in(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_refuses_a_tampered_cookie(client):
    client.cookies.set(SESSION_COOKIE, "not-a-signature")

    assert client.get("/api/auth/me").status_code == 401


def test_me_refuses_a_cookie_naming_an_account_that_is_gone(client):
    """The database is rebuilt on every container start, so a cookie kept by the
    browser outlives the row it names. It must read as signed out, not crash."""
    client.cookies.set(SESSION_COOKIE, create_session(999))

    assert client.get("/api/auth/me").status_code == 401


def test_signing_out_ends_the_session(signed_in_client):
    assert signed_in_client.post("/api/auth/signout").status_code == 204
    assert signed_in_client.get("/api/auth/me").status_code == 401


def test_the_loser_of_a_race_answers_with_the_winners_account(
    session_factory, monkeypatch
):
    """Two requests under one new name both look, both find nothing, and both
    insert. The unique constraint settles which wins, and the loser has to
    answer with the winner's row rather than raise. Eight concurrent sign-ins
    against the container produced one 500 before this. A shared in-memory
    database cannot race against itself, so the first lookup is staged to miss.
    """
    session = session_factory()
    session.add(User(display_name="Ada"))
    session.commit()
    winner_id = session.scalar(select(User).where(User.display_name == "Ada")).id

    real_scalar = session.scalar
    lookups = {"count": 0}

    def missing_on_the_first_look(*args, **kwargs):
        lookups["count"] += 1
        return None if lookups["count"] == 1 else real_scalar(*args, **kwargs)

    monkeypatch.setattr(session, "scalar", missing_on_the_first_look)

    assert sign_in(session, "Ada").id == winner_id
