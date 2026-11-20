"""
User document model for MongoDB (Firebase-backed identities).

Passwords are NEVER stored here - Firebase Authentication owns credentials.
`firebase_uid` uniquely links a MongoDB profile to a Firebase account.
"""
from enum import Enum
from typing import Optional
from datetime import datetime, timezone


class UserRole(str, Enum):
    CITIZEN = "citizen"
    STUDENT = "student"
    UNIVERSITY = "university"
    INDUSTRY = "industry"
    ADMIN = "admin"


class ApprovalStatus(str, Enum):
    APPROVED = "approved"
    PENDING = "pending"
    REJECTED = "rejected"


# Roles a user may request for themselves at sign-up.
SELF_SERVICE_ROLES = {UserRole.CITIZEN, UserRole.STUDENT}
# Roles that may be requested but need admin approval before full access.
APPROVAL_REQUIRED_ROLES = {UserRole.UNIVERSITY, UserRole.INDUSTRY}
# Never self-assignable. Only via scripts/set_admin.py (trusted backend process).
REQUESTABLE_ROLES = SELF_SERVICE_ROLES | APPROVAL_REQUIRED_ROLES

ROLE_DASHBOARD_MAP = {
    UserRole.CITIZEN: "/dashboard/citizen",
    UserRole.STUDENT: "/dashboard/student",
    UserRole.UNIVERSITY: "/dashboard/university",
    UserRole.INDUSTRY: "/dashboard/industry",
    UserRole.ADMIN: "/dashboard/admin",
}


def initial_approval_status(role: UserRole) -> ApprovalStatus:
    return ApprovalStatus.PENDING if role in APPROVAL_REQUIRED_ROLES else ApprovalStatus.APPROVED


def new_user_document(
    firebase_uid: str,
    email: str,
    name: str,
    role: UserRole,
    email_verified: bool = False,
    phone: Optional[str] = None,
    organization: Optional[dict] = None,
    profile_image: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "firebase_uid": firebase_uid,
        "name": name,
        "email": email.lower().strip(),
        "role": role.value,
        "phone": phone,
        "profile_image": profile_image,
        "skills": [],
        "interests": [],
        "organization": organization or {},
        "is_verified": bool(email_verified),
        "approval_status": initial_approval_status(role).value,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def _get(user: dict, snake: str, camel: str, default=None):
    """Read a field, tolerating legacy camelCase documents."""
    if snake in user:
        return user[snake]
    return user.get(camel, default)


def is_active(user: dict) -> bool:
    return bool(_get(user, "is_active", "isActive", True))


def approval_status(user: dict) -> str:
    return user.get("approval_status", ApprovalStatus.APPROVED.value)
