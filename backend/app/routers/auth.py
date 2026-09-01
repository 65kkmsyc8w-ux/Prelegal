from fastapi import APIRouter, HTTPException, Response, status

from app.core import config
from app.core.deps import SessionDep, UserDep
from app.core.security import SESSION_COOKIE, create_session
from app.domain import users
from app.domain.models import User
from app.domain.schemas import SignInRequest, SignUpRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _carry_the_session(response: Response, user: User) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        create_session(user.id),
        max_age=config.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
    )


@router.post(
    "/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
def post_signup(
    payload: SignUpRequest, response: Response, session: SessionDep
) -> User:
    """Opens an account and signs the caller straight in, so registering is one
    step rather than two."""
    try:
        user = users.sign_up(
            session, payload.email, payload.display_name, payload.password
        )
    except users.EmailTaken as cause:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account already uses that email"
        ) from cause

    session.commit()
    _carry_the_session(response, user)
    return user


@router.post("/session", response_model=UserOut)
def post_session(
    payload: SignInRequest, response: Response, session: SessionDep
) -> User:
    user = users.sign_in(session, payload.email, payload.password)
    if user is None:
        # One answer for an address nobody registered and for a wrong password,
        # so the route cannot be used to find out which emails have accounts.
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "That email and password do not match"
        )
    _carry_the_session(response, user)
    return user


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def post_signout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="lax")


@router.get("/me", response_model=UserOut)
def get_me(user: UserDep) -> User:
    return user
