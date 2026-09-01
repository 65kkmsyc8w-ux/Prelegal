import hashlib
import secrets

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core import config

SESSION_COOKIE = "prelegal_session"

# scrypt comes with Python, against the OpenSSL the slim image already links, so
# real password storage costs no dependency and no compiled wheel. The cost
# parameters are Django's ScryptPasswordHasher defaults rather than invented
# ones. The salt is per password and travels with the hash, which is why the
# stored value is two hex halves rather than one.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_KEY_BYTES = 32
_SALT_BYTES = 16


def _derive(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_KEY_BYTES,
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    return f"{salt.hex()}${_derive(password, salt).hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt_hex, _, derived_hex = stored.partition("$")
    candidate = _derive(password, bytes.fromhex(salt_hex))
    # Constant time, so how far a wrong password got cannot be timed.
    return secrets.compare_digest(candidate, bytes.fromhex(derived_hex))


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
