"""Per-tenant auth primitives: PBKDF2 password hashing (stdlib) + JWT sessions.

No global identity — each instance has its own users table and signing secret.
Secret resolution: AUTH_SECRET env, else ADMIN_TOKEN (so a configured instance
signs consistently), else a dev fallback.
"""
import hashlib
import hmac
import os
import secrets
import time

from jose import jwt, JWTError

ALGO = "HS256"
TTL_SECONDS = 12 * 3600  # sessions last 12h

_ITERATIONS = 100_000


def _secret() -> str:
    return os.getenv("AUTH_SECRET") or os.getenv("ADMIN_TOKEN") or "dev-insecure-secret"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS).hex()
    return hmac.compare_digest(calc, digest)


def make_token(email: str, role: str) -> str:
    claims = {"sub": email, "role": role, "exp": int(time.time()) + TTL_SECONDS}
    return jwt.encode(claims, _secret(), algorithm=ALGO)


def decode_token(token: str):
    try:
        return jwt.decode(token, _secret(), algorithms=[ALGO])
    except JWTError:
        return None
