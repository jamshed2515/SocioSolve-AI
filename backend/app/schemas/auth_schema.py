"""
Pydantic schemas for Firebase-based authentication endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional
from app.models.user import UserRole
from app.schemas.profile_schema import OrganizationSchema, UserProfileResponse


class SyncUserRequest(BaseModel):
    """
    Optional profile data supplied on FIRST sync only (new account).
    `requestedRole` is a *request*, never authorization: admin is rejected and
    university/industry start as `pending` until an administrator approves them.
    For existing users these fields are ignored (role cannot be changed here).
    """
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    requestedRole: Optional[UserRole] = None
    organization: Optional[OrganizationSchema] = None


class SyncUserResponse(BaseModel):
    created: bool
    user: UserProfileResponse


class MessageResponse(BaseModel):
    message: str


class ApprovalRequest(BaseModel):
    approve: bool
