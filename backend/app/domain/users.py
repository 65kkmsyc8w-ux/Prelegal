from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.models import User


def sign_in(session: Session, display_name: str) -> User:
    """Finds the account of this name or opens one. There is no password to
    check: PL-5 asks for a fake login that only carries a name into the
    platform. Writes inside a savepoint rather than committing, so the router
    still owns the transaction.
    """
    user = session.scalar(select(User).where(User.display_name == display_name))
    if user is not None:
        return user

    try:
        with session.begin_nested():
            user = User(display_name=display_name)
            session.add(user)
    except IntegrityError:
        # Two requests under one new name both find nothing and both insert.
        # The unique constraint settles which wins; the loser rolls back to the
        # savepoint and reads what the winner wrote. Eight concurrent sign-ins
        # under one new name answered 500 once without this.
        return session.scalar(select(User).where(User.display_name == display_name))

    return user
