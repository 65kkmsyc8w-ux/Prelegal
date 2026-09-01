from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core import config

SESSION_COOKIE = "prelegal_session"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(config.SESSION_SECRET, salt="prelegal-session")


def create_session(user_id: int) -> str:
    return _serializer().dumps({"user_id": user_id})


def read_session(token: str | None) -> int | None:
    """Returns the signed-in user's id, or None for a cookie that is absent,
    expired, or was not signed by this process."""
    if not token:
        return None
    try:
        payload = _serializer().loads(token, max_age=config.SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    return payload.get("user_id")
