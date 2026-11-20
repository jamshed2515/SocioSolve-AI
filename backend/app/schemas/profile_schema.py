"""
Pydantic schemas for user profile endpoints.
API responses keep camelCase keys so the existing frontend contract is preserved;
MongoDB stores snake_case fields.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole, ROLE_DASHBOARD_MAP


class OrganizationSchema(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    type: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=300)
    website: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = Field(default=None, max_length=2000)


class UserProfileResponse(BaseModel):
    id: str
    firebaseUid: Optional[str] = None
    name: str
    email: str
    role: UserRole
    phone: Optional[str] = None
    profileImage: Optional[str] = None
    skills: List[str] = []
    interests: List[str] = []
    organization: Optional[OrganizationSchema] = None
    isVerified: bool
    approvalStatus: str = "approved"
    isActive: bool
    dashboard: str
    createdAt: datetime
    updatedAt: Optional[datetime] = None


def user_to_profile(user: dict) -> UserProfileResponse:
    g = lambda s, c, d=None: user.get(s, user.get(c, d))  # noqa: E731
    role = UserRole(user["role"])
    return UserProfileResponse(
        id=str(user["_id"]),
        firebaseUid=user.get("firebase_uid"),
        name=user.get("name") or "",
        email=user["email"],
        role=role,
        phone=user.get("phone"),
        profileImage=g("profile_image", "profileImage"),
        skills=user.get("skills") or [],
        interests=user.get("interests") or [],
        organization=user.get("organization") or None,
        isVerified=bool(g("is_verified", "isVerified", False)),
        approvalStatus=user.get("approval_status", "approved"),
        isActive=bool(g("is_active", "isActive", True)),
        dashboard=ROLE_DASHBOARD_MAP[role],
        createdAt=g("created_at", "createdAt"),
        updatedAt=g("updated_at", "updatedAt"),
    )


class UpdateProfileRequest(BaseModel):
    """Only profile data. Role / status / email are NOT editable here."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    skills: Optional[List[str]] = Field(default=None, max_length=50)
    interests: Optional[List[str]] = Field(default=None, max_length=50)
    organization: Optional[OrganizationSchema] = None

    @field_validator("skills", "interests")
    @classmethod
    def _clean_tags(cls, v):
        if v is None:
            return v
        return list(dict.fromkeys(t.strip()[:50] for t in v if t and t.strip()))


class UpdateProfileResponse(BaseModel):
    message: str
    user: UserProfileResponse


class ChangePasswordRequest(BaseModel):
    newPassword: str = Field(min_length=8, max_length=128)
    confirmPassword: str

    @field_validator("newPassword")
    @classmethod
    def _strength(cls, v):
        if not any(c.isupper() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain an uppercase letter and a number.")
        return v


class ChangePasswordResponse(BaseModel):
    message: str


class ProfileImageResponse(BaseModel):
    message: str
    profileImageUrl: str
