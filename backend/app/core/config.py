import os
import secrets

# Falls back to a value that dies with the process. The database is recreated on
# every container start, so a cookie that outlived a restart would name a user
# row that no longer exists. Signing sessions with a fresh secret retires those
# cookies at exactly the moment their users stop existing.
SESSION_SECRET = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
SESSION_MAX_AGE = 60 * 60 * 24 * 7

MAX_DISPLAY_NAME = 60
