import secrets

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.domain.models import User

# A hash of nothing anybody knows, to check an unregistered address against.
# scrypt is deliberately slow, so short circuiting on a missing account would
# answer in a fraction of the time a wrong password takes, and the one answer
# the route is careful to give would be undone by how long it took to give it.
_NO_SUCH_ACCOUNT = hash_password(secrets.token_hex())


class EmailTaken(Exception):
    """Raised when an account already exists under the address given."""


def sign_up(session: Session, email: str, display_name: str, password: str) -> User:
    """Opens an account. Writes inside a savepoint rather than committing, so
    the router still owns the transaction.

    Two requests racing under one new address both look, both find nothing and
    both insert. The unique constraint settles which wins, and the loser is told
    the address is taken rather than handed the winner's account: the two may
    have arrived with different passwords, so signing the loser in would sign
    them in to someone else's.
    """
    try:
        with session.begin_nested():
            user = User(
                email=email,
                display_name=display_name,
                password_hash=hash_password(password),
            )
            session.add(user)
    except IntegrityError as cause:
        raise EmailTaken from cause

    return user


def sign_in(session: Session, email: str, password: str) -> User | None:
    """The account these credentials name, or None. An address nobody has
    registered and a wrong password are the same answer here, and take the same
    time to reach, so the caller cannot tell them apart either way."""
    user = session.scalar(select(User).where(User.email == email))
    stored = _NO_SUCH_ACCOUNT if user is None else user.password_hash
    matched = verify_password(password, stored)
    return user if matched else None
