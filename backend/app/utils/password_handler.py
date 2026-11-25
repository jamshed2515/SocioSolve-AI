"""
Password hashing and verification using bcrypt directly.
passlib 1.7.4 is incompatible with bcrypt>=4.0 on Python 3.13,
so we use the bcrypt library directly instead.
"""
import bcrypt


def hash_password(plain_password: str) -> str:
    """Return bcrypt hash of a plain-text password."""
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if plain_password matches the stored hash."""
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)
