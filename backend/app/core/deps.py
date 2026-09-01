from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_session
from app.core.security import SESSION_COOKIE, read_session
from app.domain.models import User

SessionDep = Annotated[Session, Depends(get_session)]


def current_user(
    session: SessionDep,
    token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    """The one place a request becomes a signed-in user. Routes take UserDep and
    never read the cookie themselves."""
    user_id = read_session(token)
    user = session.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


UserDep = Annotated[User, Depends(current_user)]
