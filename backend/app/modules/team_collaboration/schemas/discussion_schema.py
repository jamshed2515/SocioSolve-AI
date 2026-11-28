"""
Pydantic schemas for Module 3 – Team Discussions & Comments (Phase 5).
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from bson import ObjectId

from app.modules.team_collaboration.models.discussion_model import DiscussionCategory


VALID_CATEGORIES = [c.value for c in DiscussionCategory]


class DiscussionCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200, description="Discussion title")
    content: str = Field(..., min_length=5, max_length=10000, description="Discussion body or question")
    category: str = Field(default=DiscussionCategory.GENERAL.value, description="Discussion category")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if len(cleaned) < 2:
            raise ValueError("Discussion title must be at least 2 characters.")
        if len(cleaned) > 200:
            raise ValueError("Discussion title cannot exceed 200 characters.")
        return cleaned

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if len(cleaned) < 5:
            raise ValueError("Discussion content must be at least 5 characters.")
        if len(cleaned) > 10000:
            raise ValueError("Discussion content cannot exceed 10000 characters.")
        return cleaned

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else DiscussionCategory.GENERAL.value
        # Case insensitive match against valid categories
        matched = next((c for c in VALID_CATEGORIES if c.lower() == cleaned.lower()), None)
        if not matched:
            raise ValueError(f"Invalid category '{v}'. Allowed categories: {', '.join(VALID_CATEGORIES)}")
        return matched


class DiscussionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    content: Optional[str] = Field(None, min_length=5, max_length=10000)
    category: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_optional_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Discussion title must be at least 2 characters.")
        if len(cleaned) > 200:
            raise ValueError("Discussion title cannot exceed 200 characters.")
        return cleaned

    @field_validator("content")
    @classmethod
    def validate_optional_content(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Discussion content must be at least 5 characters.")
        if len(cleaned) > 10000:
            raise ValueError("Discussion content cannot exceed 10000 characters.")
        return cleaned

    @field_validator("category")
    @classmethod
    def validate_optional_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        matched = next((c for c in VALID_CATEGORIES if c.lower() == cleaned.lower()), None)
        if not matched:
            raise ValueError(f"Invalid category '{v}'. Allowed categories: {', '.join(VALID_CATEGORIES)}")
        return matched


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description="Comment body")
    parent_comment_id: Optional[str] = Field(None, description="Optional parent comment ID for replies")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if not cleaned:
            raise ValueError("Comment content cannot be empty.")
        if len(cleaned) > 5000:
            raise ValueError("Comment content cannot exceed 5000 characters.")
        return cleaned

    @field_validator("parent_comment_id")
    @classmethod
    def validate_parent_comment_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        cleaned = v.strip()
        if not ObjectId.is_valid(cleaned):
            raise ValueError("Invalid parent comment ID format.")
        return cleaned


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        cleaned = v.strip() if isinstance(v, str) else ""
        if not cleaned:
            raise ValueError("Comment content cannot be empty.")
        if len(cleaned) > 5000:
            raise ValueError("Comment content cannot exceed 5000 characters.")
        return cleaned


class CommentResponse(BaseModel):
    id: str
    discussion_id: str
    team_id: str
    author_id: str
    author_name: str = "Team Member"
    author_email: Optional[str] = None
    author_role: str = "Member"
    author_profile_image: Optional[str] = None
    content: str
    parent_comment_id: Optional[str] = None
    replies_count: int = 0
    replies: List["CommentResponse"] = []
    is_author: bool = False
    can_edit: bool = False
    can_delete: bool = False
    created_at: datetime
    updated_at: datetime


class DiscussionResponse(BaseModel):
    id: str
    team_id: str
    team_name: Optional[str] = None
    author_id: str
    author_name: str = "Team Member"
    author_email: Optional[str] = None
    author_role: str = "Member"
    author_profile_image: Optional[str] = None
    title: str
    content: str
    category: str
    is_pinned: bool = False
    is_locked: bool = False
    comment_count: int = 0
    is_author: bool = False
    is_leader: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_pin: bool = False
    can_lock: bool = False
    created_at: datetime
    updated_at: datetime


class DiscussionListResponse(BaseModel):
    items: List[DiscussionResponse]
    total: int
    page: int
    limit: int
    pages: int


class CommentListResponse(BaseModel):
    items: List[CommentResponse]
    total: int
