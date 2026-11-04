"""
Pydantic schemas for user profile endpoints.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole
from app.schemas.auth_schema import OrganizationSchema


# ── Full user profile response ───────────────────────────────────────────────
class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    phone: Optional[str] = None
    profileImage: Optional[str] = None
    skills: List[str] = []
    interests: List[str] = []
    organization: Optional[OrganizationSchema] = None
    isVerified: bool
    isActive: bool
    createdAt: datetime


# ── Update profile request ───────────────────────────────────────────────────
class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    organization: Optional[OrganizationSchema] = None


class UpdateProfileResponse(BaseModel):
    message: str
    user: UserProfileResponse


# ── Change password ──────────────────────────────────────────────────────────
class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str
    confirmPassword: str


class ChangePasswordResponse(BaseModel):
    message: str


# ── Profile image upload response ────────────────────────────────────────────
class ProfileImageResponse(BaseModel):
    message: str
    profileImageUrl: str
