"""
User document model for MongoDB.
Defines constants and helper functions for the users collection.
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


# Default dashboard routes per role (used by frontend redirect)
ROLE_DASHBOARD_MAP = {
    UserRole.CITIZEN: "/dashboard/citizen",
    UserRole.STUDENT: "/dashboard/student",
    UserRole.UNIVERSITY: "/dashboard/university",
    UserRole.INDUSTRY: "/dashboard/industry",
    UserRole.ADMIN: "/dashboard/admin",
}


def new_user_document(
    name: str,
    email: str,
    hashed_password: str,
    role: UserRole,
    phone: Optional[str] = None,
    organization: Optional[dict] = None,
) -> dict:
    """
    Build a fresh user document ready to be inserted into MongoDB.
    """
    now = datetime.now(timezone.utc)
    return {
        "name": name,
        "email": email.lower().strip(),
        "password": hashed_password,
        "role": role,
        "phone": phone,
        "profileImage": None,
        "skills": [],
        "interests": [],
        "organization": organization or {},
        "isVerified": False,
        "isActive": True,
        "resetToken": None,
        "resetTokenExpiry": None,
        "createdAt": now,
        "updatedAt": now,
    }
