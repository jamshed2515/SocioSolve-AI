"""
Auth middleware - FastAPI dependencies for Firebase authentication & RBAC.
These are the shared dependencies other modules should import.

    from app.middleware.auth_middleware import get_current_user, require_role
    from app.models.user import UserRole

    @router.get("/student-only")
    async def handler(user=Depends(require_role(UserRole.STUDENT))): ...

Roles always come from MongoDB (set by trusted backend logic), never from the client.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import Optional

from app.config.database import get_database
from app.models.user import UserRole, ApprovalStatus, is_active, approval_status
from app.utils import firebase_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_firebase_claims(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """Verify the Firebase ID token from `Authorization: Bearer <token>`."""
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return firebase_token.verify_firebase_token(creds.credentials)


async def get_current_user(claims: dict = Depends(get_firebase_claims)) -> dict:
    """Return the MongoDB user linked to the verified Firebase UID."""
    db = get_database()
    user = await db.users.find_one({"firebase_uid": claims["uid"]})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Call /api/auth/sync-user first.",
        )
    if not is_active(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated. Contact an administrator.")
    user["_claims"] = claims
    if "_id" in user and "id" not in user:
        user["id"] = str(user["_id"])
    return user


async def require_active_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Explicit active-account guard (get_current_user already enforces it)."""
    if not is_active(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated. Contact an administrator.")
    return current_user


async def require_approved_user(current_user: dict = Depends(require_active_user)) -> dict:
    """Blocks university/industry accounts that are still pending or rejected."""
    if approval_status(current_user) != ApprovalStatus.APPROVED.value:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Account approval is {approval_status(current_user)}. An administrator must approve it.",
        )
    return current_user


def require_role(*roles: UserRole, require_approval: bool = True):
    """Dependency factory restricting access to the given roles."""
    allowed = {r.value if isinstance(r, UserRole) else str(r) for r in roles}
    base = require_approved_user if require_approval else require_active_user

    async def _check_role(current_user: dict = Depends(base)) -> dict:
        if current_user.get("role") not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Access denied. Required role(s): {sorted(allowed)}",
            )
        return current_user

    return _check_role
