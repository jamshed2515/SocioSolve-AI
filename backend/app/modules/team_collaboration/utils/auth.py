"""
Authentication & RBAC integration bridge for Module 3.

Directly reuses Module 1's JWT verification and role-checking dependencies from
`app.middleware.auth_middleware` without duplicating login or token logic.
"""
from fastapi import Depends

from app.middleware.auth_middleware import (
    get_current_user,
    require_active_user,
    require_role,
)
from app.models.user import UserRole
from app.modules.team_collaboration.schemas.common import AuthenticatedUserContext


def extract_user_context(user_doc: dict) -> AuthenticatedUserContext:
    """Convert a MongoDB user document from `get_current_user` into a typed context."""
    return AuthenticatedUserContext(
        user_id=str(user_doc["_id"]),
        name=user_doc.get("name", ""),
        email=user_doc.get("email", ""),
        role=UserRole(user_doc["role"]),
        is_active=user_doc.get("isActive", True),
        is_verified=user_doc.get("isVerified", False),
        skills=user_doc.get("skills", []) or [],
        profile_image=user_doc.get("profileImage"),
    )


async def get_team_user_context(
    current_user: dict = Depends(require_active_user),
) -> AuthenticatedUserContext:
    """
    FastAPI dependency for future Module 3 protected routes (Phase 2+).
    Reuses Module 1 JWT authentication and returns a typed `AuthenticatedUserContext`.
    """
    return extract_user_context(current_user)

