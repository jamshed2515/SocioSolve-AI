"""
Pydantic schemas for Module 4: Solution Proposals & Evaluation.
"""
import re
from typing import Optional, List
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

from app.models.proposal import (
    ProposalStatus,
    ReviewRecommendation,
    RUBRIC_MIN_SCORE,
    RUBRIC_MAX_SCORE,
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_http_url(v: Optional[str], *, allow_empty_str: bool = False) -> Optional[str]:
    if v is None:
        return None
    val = v.strip()
    if not val:
        return "" if allow_empty_str else None
    parsed = urlparse(val)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("URL must be a valid http:// or https:// address with a host.")
    return val


def _validate_document_url(v: str) -> str:
    val = (v or "").strip()
    if not val:
        raise ValueError("Document URL is required.")
    # Allow backend-authenticated document API routes or validated http(s) URLs
    if val.startswith("/api/proposals/documents/"):
        if ".." in val or "\\" in val:
            raise ValueError("Invalid document path.")
        return val
    parsed = urlparse(val)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Document URL must start with http://, https://, or be an uploaded document URL.")
    return val


class TeamMemberSchema(BaseModel):
    userId: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=120)
    email: Optional[str] = Field(default=None, max_length=254)
    roleInTeam: Optional[str] = Field(default="Member", max_length=80)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        val = v.strip()
        if not val:
            raise ValueError("Team member name cannot be blank.")
        return val

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        val = v.strip().lower()
        if not EMAIL_REGEX.match(val):
            raise ValueError("Team member email must be a valid email address.")
        return val


class SupportingDocumentSchema(BaseModel):
    docId: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=2048)
    docType: Optional[str] = Field(default="document", max_length=80)
    sizeBytes: Optional[int] = Field(default=None, ge=0)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        return _validate_document_url(v)


class ProposalCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    challengeId: str = Field(..., min_length=1)
    problemUnderstanding: str = Field(default="")
    proposedSolution: str = Field(default="")
    innovationUniqueness: str = Field(default="")
    technicalApproach: str = Field(default="")
    implementationPlan: str = Field(default="")
    requiredResources: str = Field(default="")
    expectedImpact: str = Field(default="")
    estimatedTimeline: str = Field(default="")
    teamId: Optional[str] = None
    teamName: Optional[str] = Field(default=None, max_length=160)
    teamMembers: List[TeamMemberSchema] = Field(default_factory=list, max_length=25)
    prototypeUrl: Optional[str] = None
    githubUrl: Optional[str] = None
    demoUrl: Optional[str] = None
    supportingDocuments: List[SupportingDocumentSchema] = Field(default_factory=list, max_length=20)
    additionalNotes: Optional[str] = Field(default=None, max_length=5000)
    submitImmediately: bool = False

    @field_validator("prototypeUrl", "githubUrl", "demoUrl")
    @classmethod
    def validate_optional_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_http_url(v, allow_empty_str=False)

    @field_validator("githubUrl")
    @classmethod
    def validate_github_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        parsed = urlparse(v)
        host = (parsed.hostname or "").lower()
        if not host or "." not in host:
            raise ValueError("GitHub / repository URL must have a valid domain name.")
        return v


class ProposalUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    challengeId: Optional[str] = None
    problemUnderstanding: Optional[str] = None
    proposedSolution: Optional[str] = None
    innovationUniqueness: Optional[str] = None
    technicalApproach: Optional[str] = None
    implementationPlan: Optional[str] = None
    requiredResources: Optional[str] = None
    expectedImpact: Optional[str] = None
    estimatedTimeline: Optional[str] = None
    teamId: Optional[str] = None
    teamName: Optional[str] = Field(default=None, max_length=160)
    teamMembers: Optional[List[TeamMemberSchema]] = Field(default=None, max_length=25)
    prototypeUrl: Optional[str] = None
    githubUrl: Optional[str] = None
    demoUrl: Optional[str] = None
    supportingDocuments: Optional[List[SupportingDocumentSchema]] = Field(default=None, max_length=20)
    additionalNotes: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("prototypeUrl", "githubUrl", "demoUrl")
    @classmethod
    def validate_optional_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_http_url(v, allow_empty_str=True)


class CriterionScoreSchema(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    label: Optional[str] = Field(default=None, max_length=160)
    score: float = Field(..., ge=RUBRIC_MIN_SCORE, le=RUBRIC_MAX_SCORE)
    # Accepted for request compatibility only; ALWAYS ignored and replaced by backend rubric maxScore (10).
    maxScore: Optional[float] = Field(default=None)
    comment: Optional[str] = Field(default="", max_length=1000)


class ReviewUpsertRequest(BaseModel):
    criteriaScores: List[CriterionScoreSchema] = Field(..., min_length=1, max_length=10)
    overallFeedback: str = Field(..., min_length=5, max_length=5000)
    recommendation: ReviewRecommendation
    submitFinal: bool = False


class StatusTransitionRequest(BaseModel):
    toStatus: ProposalStatus
    comment: Optional[str] = Field(default=None, max_length=2000)


class WithdrawProposalRequest(BaseModel):
    reason: Optional[str] = Field(default="Withdrawn by author", max_length=1000)


class ReopenProposalRequest(BaseModel):
    reason: Optional[str] = Field(default="Reopened as draft for revision", max_length=1000)
