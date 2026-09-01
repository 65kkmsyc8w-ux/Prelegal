import os
import secrets

# Falls back to a value that dies with the process. The database is recreated on
# every container start, so a cookie that outlived a restart would name a user
# row that no longer exists. Signing sessions with a fresh secret retires those
# cookies at exactly the moment their users stop existing.
SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
SESSION_MAX_AGE = 60 * 60 * 24 * 7

MAX_DISPLAY_NAME = 60
# The longest address RFC 5321 allows.
MAX_EMAIL = 254
MIN_PASSWORD = 8
# Long enough for any passphrase, short enough that scrypt cannot be made to
# chew through a megabyte of input on an unauthenticated route.
MAX_PASSWORD = 128

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get(
    "OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free"
)

MAX_CHAT_MESSAGE = 2000
# What is forwarded to the model, however long the browser's transcript grows.
MAX_CHAT_HISTORY = 40
