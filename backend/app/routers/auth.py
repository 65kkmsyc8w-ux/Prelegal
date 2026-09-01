from fastapi import APIRouter, Response, status

from app.core import config
from app.core.deps import SessionDep, UserDep
from app.core.security import SESSION_COOKIE, create_session
from app.domain.models import User
from app.domain.schemas import SessionRequest, UserOut
from app.domain.users import sign_in

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/session", response_model=UserOut)
def post_session(
    payload: SessionRequest, response: Response, session: SessionDep
) -> User:
    user = sign_in(session, payload.display_name)
    session.commit()
    response.set_cookie(
        SESSION_COOKIE,
        create_session(user.id),
        max_age=config.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return user


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def post_signout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="lax")


@router.get("/me", response_model=UserOut)
def get_me(user: UserDep) -> User:
    return user
