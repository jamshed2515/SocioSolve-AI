"""
Pydantic schemas for Module 3 – Join Requests (Phase 3).
"""
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel, Field, field_validator


class CreateJoinRequest(BaseModel):
    team_id: str = Field(..., description="Target team 24-character hexadecimal ObjectId")
    message: Optional[str] = Field(None, max_length=500, description="Optional note to team leader")

    @field_validator("team_id")
    @classmethod
    def validate_team_id(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if not cleaned:
            raise ValueError("team_id is mandatory.")
        if not ObjectId.is_valid(cleaned):
            raise ValueError("Invalid team_id format (must be a valid 24-character hexadecimal ObjectId).")
        return cleaned

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) > 500:
            raise ValueError("Message cannot exceed 500 characters.")
        return cleaned if cleaned else None


class JoinRequestDecision(BaseModel):
    decision: str = Field(..., description="'accepted' or 'rejected'")

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        cleaned = v.strip().lower() if isinstance(v, str) else ""
        if cleaned not in ("accepted", "rejected"):
            raise ValueError("Decision must be either 'accepted' or 'rejected'.")
        return cleaned


class JoinRequestResponse(BaseModel):
    id: str
    team_id: str
    team_name: Optional[str] = None
    team_status: Optional[str] = None
    challenge_title: Optional[str] = None
    leader_id: Optional[str] = None
    leader_name: Optional[str] = None
    member_count: Optional[int] = None
    max_members: Optional[int] = None
    user_id: str
    applicant_name: Optional[str] = None
    applicant_email: Optional[str] = None
    applicant_profile_image: Optional[str] = None
    applicant_skills: Optional[List[str]] = None
    applicant_role: Optional[str] = None
    message: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class JoinRequestListResponse(BaseModel):
    requests: List[JoinRequestResponse]
    total: int
