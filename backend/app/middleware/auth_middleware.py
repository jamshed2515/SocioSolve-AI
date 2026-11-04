"""
Auth middleware – FastAPI dependency injectors for authentication & RBAC.
These are the shared dependencies that ALL other modules should import.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId
from typing import List

from app.config.database import get_database
from app.utils.jwt_handler import decode_token
from app.models.user import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Decode the JWT, look up the user in MongoDB, and return the user document.
    Raises HTTP 401 if the token is invalid or the user is not found.

    ── INTEGRATION NOTE FOR OTHER MODULES ──────────────────────────────────
    Import and use this dependency in any protected route:

        from app.middleware.auth_middleware import get_current_user

        @router.get("/some-protected-route")
        async def handler(user = Depends(get_current_user)):
            ...
    """
    payload = decode_token(token)
    user_id: str = payload.get("sub")

    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    return user


def require_role(*roles: UserRole):
    """
    Dependency factory – restricts access to users with one of the given roles.

    Usage:
        @router.get("/admin-only")
        async def handler(user = Depends(require_role(UserRole.ADMIN))):
            ...

        @router.get("/student-or-university")
        async def handler(user = Depends(require_role(UserRole.STUDENT, UserRole.UNIVERSITY))):
            ...
    """
    async def _check_role(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in roles]}",
            )
        return current_user

    return _check_role


def require_active_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that additionally checks the isActive flag.
    (get_current_user already checks this, but this is explicit for clarity.)
    """
    if not current_user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact an administrator.",
        )
    return current_user
