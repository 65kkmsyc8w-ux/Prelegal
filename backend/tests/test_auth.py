from sqlalchemy import select

from app.core.security import (
    SESSION_COOKIE,
    create_session,
    hash_password,
    verify_password,
)
from app.domain import users
from app.domain.models import User
from app.domain.users import EmailTaken, sign_up
from tests.conftest import PASSWORD


def signup(client, **overrides):
    return client.post(
        "/api/auth/signup",
        json={
            "email": "ada@example.com",
            "display_name": "Ada",
            "password": PASSWORD,
            **overrides,
        },
    )


def signin(client, **overrides):
    return client.post(
        "/api/auth/session",
        json={"email": "ada@example.com", "password": PASSWORD, **overrides},
    )


def test_a_password_survives_a_round_trip_through_the_hash():
    stored = hash_password(PASSWORD)

    assert verify_password(PASSWORD, stored)


def test_the_hash_does_not_carry_the_password():
    assert PASSWORD not in hash_password(PASSWORD)


def test_a_wrong_password_does_not_verify():
    assert not verify_password("something else", hash_password(PASSWORD))


def test_one_password_hashed_twice_gives_two_hashes():
    """Each hash carries its own salt, so identical passwords are not
    recognisable as identical in the table."""
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


def test_signing_up_opens_an_account_and_sets_a_cookie(client):
    response = signup(client)

    assert response.status_code == 201
    assert response.json()["display_name"] == "Ada"
    assert response.json()["email"] == "ada@example.com"
    assert SESSION_COOKIE in response.cookies


def test_the_password_never_comes_back(client):
    assert "password" not in str(signup(client).json())


def test_the_session_cookie_is_not_readable_from_script(client):
    assert "httponly" in signup(client).headers["set-cookie"].lower()


def test_the_stored_password_is_not_the_one_that_was_typed(client, session_factory):
    signup(client)

    with session_factory() as session:
        stored = session.scalar(select(User)).password_hash

    assert PASSWORD not in stored
    assert verify_password(PASSWORD, stored)


def test_signing_in_returns_to_the_same_account(client):
    opened = signup(client).json()

    returned = signin(client)

    assert returned.status_code == 200
    assert returned.json()["id"] == opened["id"]


def test_a_different_email_is_a_different_account(client):
    ada = signup(client).json()
    grace = signup(client, email="grace@example.com", display_name="Grace").json()

    assert ada["id"] != grace["id"]


def test_two_accounts_may_go_by_the_same_name(client):
    """Display name stopped deciding identity when passwords arrived. Two people
    called Ada are two accounts."""
    first = signup(client)
    second = signup(client, email="ada2@example.com")

    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


def test_an_email_typed_with_stray_spaces_and_capitals_is_the_same_account(client):
    opened = signup(client).json()

    returned = signin(client, email="  Ada@Example.COM ")

    assert returned.json()["id"] == opened["id"]


def test_signing_up_under_an_email_already_used_is_refused(client):
    signup(client)

    response = signup(client, display_name="Someone else")

    assert response.status_code == 409
    assert SESSION_COOKIE not in response.cookies


def test_a_wrong_password_is_refused(client):
    signup(client)

    response = signin(client, password="not the password")

    assert response.status_code == 401
    assert SESSION_COOKIE not in response.cookies


def test_an_email_nobody_registered_is_refused(client):
    response = signin(client, email="nobody@example.com")

    assert response.status_code == 401


def test_a_wrong_password_and_an_unknown_email_answer_alike(client):
    """Neither answer may reveal whether an address has an account here."""
    signup(client)

    wrong = signin(client, password="not the password")
    unknown = signin(client, email="nobody@example.com")

    assert wrong.status_code == unknown.status_code
    assert wrong.json()["detail"] == unknown.json()["detail"]


def test_an_unknown_email_is_checked_against_a_hash_like_any_other(
    client, monkeypatch
):
    """Saying the same thing is not enough if it is said sooner. scrypt is
    deliberately slow, so returning before it ran would time an unregistered
    address apart from a wrong password. The cost is paid either way."""
    checked = []
    real = users.verify_password

    def counted(password, stored):
        checked.append(stored)
        return real(password, stored)

    monkeypatch.setattr(users, "verify_password", counted)

    signin(client, email="nobody@example.com")

    assert len(checked) == 1


def test_a_password_shorter_than_the_minimum_is_refused(client):
    assert signup(client, password="short").status_code == 422


def test_a_password_is_taken_exactly_as_typed(client):
    """Trimming it on the way in but not on the way back would lock out anyone
    whose password ends in a space."""
    signup(client, password=" spaced out ")

    assert signin(client, password=" spaced out ").status_code == 200
    assert signin(client, password="spaced out").status_code == 401


def test_something_that_is_not_an_address_is_refused(client):
    assert signup(client, email="Ada Lovelace").status_code == 422
    assert signup(client, email="ada@example").status_code == 422
    assert signup(client, email="@example.com").status_code == 422


def test_a_name_of_nothing_but_spaces_is_refused(client):
    assert signup(client, display_name="   ").status_code == 422


def test_a_name_longer_than_the_column_is_refused(client):
    assert signup(client, display_name="a" * 61).status_code == 422


def test_a_name_typed_with_stray_spaces_is_stored_trimmed(client):
    assert signup(client, display_name="  Ada ").json()["display_name"] == "Ada"


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


def test_the_loser_of_a_race_is_told_the_email_is_taken(session_factory, monkeypatch):
    """Two requests under one new address both insert and the unique constraint
    settles which wins. The loser must be refused rather than handed the
    winner's account: the two may have arrived with different passwords, so
    signing the loser in would sign them in to somebody else's.

    A shared in-memory database cannot race against itself, so the row is staged
    to be there already.
    """
    session = session_factory()
    session.add(
        User(
            email="ada@example.com",
            display_name="Ada",
            password_hash=hash_password(PASSWORD),
        )
    )
    session.commit()

    try:
        sign_up(session, "ada@example.com", "Someone else", PASSWORD)
    except EmailTaken:
        return
    raise AssertionError("the loser of the race was not refused")
