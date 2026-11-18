"""
Pydantic schemas for Module 4: Solution Proposals & Evaluation.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from app.models.proposal import (
    ProposalStatus,
    ReviewStatus,
    ReviewRecommendation,
)


class TeamMemberSchema(BaseModel):
    userId: Optional[str] = None
    name: str
    email: Optional[str] = None
    roleInTeam: Optional[str] = "Member"


class SupportingDocumentSchema(BaseModel):
    name: str
    url: str
    docType: Optional[str] = "document"  # e.g. "implementation_plan", "architecture", "presentation", "uploaded_file"
    sizeBytes: Optional[int] = None


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
    teamName: Optional[str] = None
    teamMembers: List[TeamMemberSchema] = Field(default_factory=list)
    prototypeUrl: Optional[str] = None
    githubUrl: Optional[str] = None
    demoUrl: Optional[str] = None
    supportingDocuments: List[SupportingDocumentSchema] = Field(default_factory=list)
    additionalNotes: Optional[str] = None
    submitImmediately: bool = False

    @field_validator("prototypeUrl", "githubUrl", "demoUrl")
    @classmethod
    def validate_optional_url(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        val = v.strip()
        if not (val.startswith("http://") or val.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return val


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
    teamName: Optional[str] = None
    teamMembers: Optional[List[TeamMemberSchema]] = None
    prototypeUrl: Optional[str] = None
    githubUrl: Optional[str] = None
    demoUrl: Optional[str] = None
    supportingDocuments: Optional[List[SupportingDocumentSchema]] = None
    additionalNotes: Optional[str] = None

    @field_validator("prototypeUrl", "githubUrl", "demoUrl")
    @classmethod
    def validate_optional_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if not v.strip():
            return ""
        val = v.strip()
        if not (val.startswith("http://") or val.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return val


class CriterionScoreSchema(BaseModel):
    key: str
    label: str
    score: float = Field(..., ge=1, le=10)
    maxScore: float = Field(default=10, ge=1, le=10)
    comment: Optional[str] = ""


class ReviewUpsertRequest(BaseModel):
    criteriaScores: List[CriterionScoreSchema] = Field(..., min_length=1)
    overallFeedback: str = Field(..., min_length=5, max_length=5000)
    recommendation: ReviewRecommendation
    submitFinal: bool = False


class StatusTransitionRequest(BaseModel):
    toStatus: ProposalStatus
    comment: Optional[str] = Field(default=None, max_length=2000)


class WithdrawProposalRequest(BaseModel):
    reason: Optional[str] = Field(default="Withdrawn by author", max_length=1000)
