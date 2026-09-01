from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.models import User


def sign_in(session: Session, display_name: str) -> User:
    """Finds the account of this name or opens one. There is no password to
    check: PL-5 asks for a fake login that only carries a name into the
    platform. Flushes rather than commits, so the router owns the transaction.
    """
    user = session.scalar(select(User).where(User.display_name == display_name))
    if user is None:
        user = User(display_name=display_name)
        session.add(user)
        session.flush()
    return user
