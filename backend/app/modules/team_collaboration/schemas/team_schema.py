"""
Pydantic schemas for Module 3 – Team Creation and Management (Phase 2).
"""
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel, Field, field_validator


class TeamMemberSchema(BaseModel):
    user_id: str
    name: Optional[str] = "Team Member"
    email: Optional[str] = None
    role: str = "Member"
    joined_at: datetime


class TeamCreate(BaseModel):
    name: str = Field(..., description="Unique and descriptive team name")
    description: str = Field(..., description="Overview of team mission and goals")
    challenge_id: str = Field(..., description="ID of the societal challenge being addressed")
    max_members: int = Field(default=6, ge=2, le=20, description="Max team members (2 to 20)")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if len(cleaned) < 2:
            raise ValueError("Team name must be at least 2 characters.")
        if len(cleaned) > 100:
            raise ValueError("Team name cannot exceed 100 characters.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if len(cleaned) < 5:
            raise ValueError("Team description must be at least 5 characters.")
        if len(cleaned) > 1000:
            raise ValueError("Team description cannot exceed 1000 characters.")
        return cleaned

    @field_validator("challenge_id")
    @classmethod
    def validate_challenge_id(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if not cleaned:
            raise ValueError("Associated challenge ID is mandatory.")
        if not ObjectId.is_valid(cleaned):
            raise ValueError("Invalid challenge ID format (must be a valid 24-character hexadecimal ObjectId).")
        return cleaned


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_members: Optional[int] = Field(None, ge=2, le=20, description="Max team members (2 to 20)")

    @field_validator("name")
    @classmethod
    def validate_optional_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Team name must be at least 2 characters.")
        if len(cleaned) > 100:
            raise ValueError("Team name cannot exceed 100 characters.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_optional_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Team description must be at least 5 characters.")
        if len(cleaned) > 1000:
            raise ValueError("Team description cannot exceed 1000 characters.")
        return cleaned


class TeamResponse(BaseModel):
    id: str
    name: str
    description: str
    challenge_id: str
    challenge_title: Optional[str] = "Societal Challenge"
    challenge_category: Optional[str] = "General"
    leader_id: str
    leader_name: Optional[str] = "Team Leader"
    members: List[TeamMemberSchema] = []
    member_count: int
    max_members: int
    status: str
    is_leader: Optional[bool] = False
    is_member: Optional[bool] = False
    user_request_status: Optional[str] = None
    user_request_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TeamListResponse(BaseModel):
    teams: List[TeamResponse]
    total: int
    page: int
    limit: int
    pages: int


class ChallengeSummary(BaseModel):
    id: str
    title: str
    category: Optional[str] = "General"
    description: Optional[str] = ""
    location: Optional[str] = "Jharkhand"
    status: Optional[str] = "published"

