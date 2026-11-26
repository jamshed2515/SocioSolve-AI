"""
Pydantic schemas for Module 2: Societal Challenge Management.

Conforms to Pydantic v2 conventions and provides safe serialization for MongoDB
documents, preventing exposure of internal credentials while preserving contract compatibility.
"""
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from app.models.challenge import (
    ChallengeCategory,
    ChallengeStatus,
    ChallengeDifficulty,
    is_published_status,
)


class ChallengeAttachmentSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=1000)
    fileType: Optional[str] = Field(default="document", max_length=50)
    sizeBytes: Optional[int] = Field(default=None, ge=0)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        val = v.strip()
        if not (
            val.startswith("http://")
            or val.startswith("https://")
            or val.startswith("/uploads/")
        ):
            raise ValueError("URL must start with http://, https://, or /uploads/")
        return val

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        val = v.strip()
        if not val:
            raise ValueError("Attachment name cannot be empty.")
        return val


class ChallengeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=5, max_length=200, description="Clear, concise problem title")
    description: str = Field(..., min_length=20, max_length=10000, description="Detailed problem statement and context")
    category: ChallengeCategory = Field(..., description="Societal domain category")
    location: str = Field(..., min_length=2, max_length=200, description="Target geographical area, city, or district")
    difficulty: ChallengeDifficulty = Field(default=ChallengeDifficulty.MEDIUM, description="Estimated difficulty level")
    status: Optional[ChallengeStatus] = Field(default=ChallengeStatus.PUBLISHED, description="Initial submission status: draft, submitted, or published")
    expectedImpact: Optional[str] = Field(default=None, max_length=2000, description="Expected outcome and community impact")
    deadline: Optional[str] = Field(default=None, max_length=50, description="Target resolution deadline (ISO format or date)")
    tags: List[str] = Field(default_factory=list, description="Keywords and tags")
    attachments: List[ChallengeAttachmentSchema] = Field(default_factory=list, description="Supporting documents and photos")

    @field_validator("title", "description", "location")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        val = v.strip()
        if not val:
            raise ValueError("Field cannot be empty or only whitespace.")
        return val

    @field_validator("status")
    @classmethod
    def validate_initial_status(cls, v: Optional[ChallengeStatus]) -> Optional[ChallengeStatus]:
        if v and v not in {ChallengeStatus.DRAFT, ChallengeStatus.SUBMITTED, ChallengeStatus.PUBLISHED}:
            raise ValueError("Initial status can only be 'draft', 'submitted', or 'published'.")
        return v

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, tags: List[str]) -> List[str]:
        cleaned = []
        for t in tags:
            stripped = t.strip().lower()
            if stripped and stripped not in cleaned:
                cleaned.append(stripped[:50])
        return cleaned[:20]


class ChallengeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=5, max_length=200)
    description: Optional[str] = Field(None, min_length=20, max_length=10000)
    category: Optional[ChallengeCategory] = None
    location: Optional[str] = Field(None, min_length=2, max_length=200)
    difficulty: Optional[ChallengeDifficulty] = None
    expectedImpact: Optional[str] = Field(None, max_length=2000)
    deadline: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None
    attachments: Optional[List[ChallengeAttachmentSchema]] = None

    @field_validator("title", "description", "location")
    @classmethod
    def validate_optional_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            val = v.strip()
            if not val:
                raise ValueError("Field cannot be empty or only whitespace.")
            return val
        return v

    @field_validator("tags")
    @classmethod
    def clean_optional_tags(cls, tags: Optional[List[str]]) -> Optional[List[str]]:
        if tags is None:
            return None
        cleaned = []
        for t in tags:
            stripped = t.strip().lower()
            if stripped and stripped not in cleaned:
                cleaned.append(stripped[:50])
        return cleaned[:20]


class ChallengeStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ChallengeStatus = Field(..., description="Target status")
    reason: Optional[str] = Field(default=None, max_length=1000, description="Optional transition reasoning or feedback")


class ChallengeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    challengeCode: Optional[str] = None
    title: str
    description: str
    category: str
    location: str
    difficulty: str
    status: str
    isPublished: bool
    authorId: Optional[str] = None
    authorName: Optional[str] = None
    authorEmail: Optional[str] = None
    authorRole: Optional[str] = None
    createdBy: Optional[str] = None
    expectedImpact: Optional[str] = None
    deadline: Optional[str] = None
    tags: List[str] = []
    attachments: List[ChallengeAttachmentSchema] = []
    proposalsCount: int = 0
    viewsCount: int = 0
    createdAt: datetime
    updatedAt: Optional[datetime] = None


class ChallengeListResponse(BaseModel):
    challenges: List[ChallengeResponse]
    total: int
    page: int
    limit: int
    pages: int


def challenge_to_response(challenge: dict) -> ChallengeResponse:
    """
    Safely serialize a MongoDB challenge document (including seed challenges)
    to the Pydantic ChallengeResponse.
    """
    cid = str(challenge.get("_id") or challenge.get("id") or "")
    status_str = str(challenge.get("status", ChallengeStatus.PUBLISHED.value)).lower()

    # Determine isPublished with fallback matching Module 4
    is_pub = bool(
        challenge.get(
            "isPublished",
            is_published_status(status_str) or status_str in {"published", "open", "active"},
        )
    )

    # Attachments
    raw_attachments = challenge.get("attachments") or []
    validated_attachments = []
    for att in raw_attachments:
        if isinstance(att, dict) and att.get("name") and att.get("url"):
            validated_attachments.append(
                ChallengeAttachmentSchema(
                    name=att["name"],
                    url=att["url"],
                    fileType=att.get("fileType", att.get("docType", "document")),
                    sizeBytes=att.get("sizeBytes"),
                )
            )

    # Timestamps
    created_at = challenge.get("createdAt") or challenge.get("created_at") or datetime.utcnow()
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except Exception:
            created_at = datetime.utcnow()

    updated_at = challenge.get("updatedAt") or challenge.get("updated_at")
    if isinstance(updated_at, str):
        try:
            updated_at = datetime.fromisoformat(updated_at)
        except Exception:
            updated_at = None

    return ChallengeResponse(
        id=cid,
        challengeCode=challenge.get("challengeCode"),
        title=challenge.get("title", ""),
        description=challenge.get("description", ""),
        category=challenge.get("category", ChallengeCategory.OTHER.value),
        location=challenge.get("location", ""),
        difficulty=challenge.get("difficulty", ChallengeDifficulty.MEDIUM.value),
        status=status_str,
        isPublished=is_pub,
        authorId=challenge.get("authorId"),
        authorName=challenge.get("authorName"),
        authorEmail=challenge.get("authorEmail"),
        authorRole=challenge.get("authorRole"),
        createdBy=challenge.get("createdBy") or challenge.get("authorName"),
        expectedImpact=challenge.get("expectedImpact"),
        deadline=challenge.get("deadline"),
        tags=challenge.get("tags") or [],
        attachments=validated_attachments,
        proposalsCount=int(challenge.get("proposalsCount", 0)),
        viewsCount=int(challenge.get("viewsCount", 0)),
        createdAt=created_at,
        updatedAt=updated_at,
    )
