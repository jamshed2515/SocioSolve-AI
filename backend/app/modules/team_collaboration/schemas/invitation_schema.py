"""
Pydantic schemas for Module 3 – Team Invitations & Member Management (Phase 4).
"""
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel, Field, field_validator


class CreateInvitationRequest(BaseModel):
    invitee_id: str = Field(..., description="ID of the user being invited")
    message: Optional[str] = Field(None, max_length=500, description="Optional invite message or note")

    @field_validator("invitee_id")
    @classmethod
    def validate_invitee_id(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if not cleaned:
            raise ValueError("Invitee user ID is mandatory.")
        if not ObjectId.is_valid(cleaned):
            raise ValueError("Invalid user ID format (must be a 24-character hexadecimal ObjectId).")
        return cleaned

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) > 500:
            raise ValueError("Invitation message cannot exceed 500 characters.")
        return cleaned or None


class InvitationDecision(BaseModel):
    decision: str = Field(..., description="Response to invitation: 'accepted' or 'rejected'")

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        cleaned = v.strip().lower() if isinstance(v, str) else ""
        if cleaned not in ("accepted", "rejected"):
            raise ValueError("Decision must be either 'accepted' or 'rejected'.")
        return cleaned


class ChangeRoleRequest(BaseModel):
    role: str = Field(..., description="New role for the team member")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if not cleaned:
            raise ValueError("Member role is required.")
        return cleaned


class InvitationResponse(BaseModel):
    id: str
    team_id: str
    team_name: Optional[str] = "Team"
    team_status: Optional[str] = "recruiting"
    challenge_title: Optional[str] = None
    member_count: Optional[int] = 0
    max_members: Optional[int] = 6
    inviter_id: str
    inviter_name: Optional[str] = "Team Leader"
    inviter_email: Optional[str] = None
    invitee_id: str
    invitee_name: Optional[str] = "User"
    invitee_email: Optional[str] = None
    invitee_profile_image: Optional[str] = None
    invitee_skills: Optional[List[str]] = []
    message: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class InvitationListResponse(BaseModel):
    items: List[InvitationResponse]
    total: int


class TeamMemberDetailResponse(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    role: str = "Member"
    joined_at: datetime
    skills: List[str] = []
    profile_image: Optional[str] = None
    organization_or_university: Optional[str] = None


class UserSearchItem(BaseModel):
    id: str
    name: str
    email: str
    role: str
    skills: List[str] = []
    profile_image: Optional[str] = None
    organization_or_university: Optional[str] = None
