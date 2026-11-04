"""
Pydantic schemas for authentication endpoints.
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from app.models.user import UserRole


# ── Organization details (for University / Industry roles) ─────────────────
class OrganizationSchema(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None       # e.g. "university", "company"
    address: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None


# ── Register ────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    confirmPassword: str
    role: UserRole
    phone: Optional[str] = None
    organization: Optional[OrganizationSchema] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v

    @field_validator("confirmPassword")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v

    @field_validator("role")
    @classmethod
    def disallow_admin_self_register(cls, v: UserRole) -> UserRole:
        if v == UserRole.ADMIN:
            raise ValueError("Admin accounts cannot be self-registered.")
        return v


class RegisterResponse(BaseModel):
    message: str
    userId: str
    role: UserRole
    dashboardUrl: str


# ── Login ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    role: UserRole
    dashboardUrl: str
    user: "UserBasicInfo"


class UserBasicInfo(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    profileImage: Optional[str] = None
    isVerified: bool


LoginResponse.model_rebuild()


# ── Token ────────────────────────────────────────────────────────────────────
class TokenRefreshRequest(BaseModel):
    refreshToken: str


class TokenRefreshResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"


# ── Password Reset ────────────────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str
    confirmPassword: str

    @field_validator("newPassword")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v

    @field_validator("confirmPassword")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "newPassword" in info.data and v != info.data["newPassword"]:
            raise ValueError("Passwords do not match.")
        return v


class ResetPasswordResponse(BaseModel):
    message: str
