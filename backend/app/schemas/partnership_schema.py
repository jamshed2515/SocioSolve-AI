"""
Pydantic schemas for Module 6: Industry Partnerships.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.models.partnership import OpportunityType, OpportunityStatus, ApplicationStatus


# ── Opportunity Schemas ────────────────────────────────────────────────────────

class CreateOpportunityRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=150, description="Title of the partnership opportunity")
    description: str = Field(..., min_length=20, max_length=3000, description="Detailed description of the opportunity")
    type: OpportunityType = Field(default=OpportunityType.MENTORSHIP, description="Opportunity type")
    targetCategories: List[str] = Field(..., min_length=1, description="Target challenge categories, e.g. Healthcare, Environment")
    resourcesOffered: List[str] = Field(..., min_length=1, description="Resources offered by the industry partner")
    maxTeams: int = Field(default=3, ge=1, le=50, description="Maximum number of teams that can be accepted")


class OpportunityStatusUpdateRequest(BaseModel):
    status: OpportunityStatus = Field(..., description="Active or Closed")


class OpportunityResponse(BaseModel):
    id: str
    industryUserId: str
    industryName: str
    organizationName: str
    organizationWebsite: Optional[str] = None
    title: str
    description: str
    type: OpportunityType
    targetCategories: List[str]
    resourcesOffered: List[str]
    maxTeams: int
    acceptedTeamsCount: int
    status: OpportunityStatus
    createdAt: datetime
    updatedAt: datetime


class OpportunityListResponse(BaseModel):
    opportunities: List[OpportunityResponse]
    total: int


# ── Application Schemas ────────────────────────────────────────────────────────

class ApplyOpportunityRequest(BaseModel):
    teamName: str = Field(..., min_length=2, max_length=100, description="Name of the student team")
    message: str = Field(..., min_length=20, max_length=2000, description="Pitch or explanation of why your team is applying")
    teamId: Optional[str] = Field(default=None, description="Optional teamId for forward compatibility with Module 3")


class UpdateApplicationStatusRequest(BaseModel):
    status: ApplicationStatus = Field(..., description="Accepted or Rejected")
    feedback: Optional[str] = Field(default=None, max_length=500, description="Optional feedback or reason")


class ApplicationResponse(BaseModel):
    id: str
    partnershipId: str
    partnershipTitle: str
    applicantUserId: str
    applicantName: str
    applicantEmail: str
    teamName: str
    teamId: Optional[str] = None
    message: str
    status: ApplicationStatus
    feedback: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime


class ApplicationListResponse(BaseModel):
    applications: List[ApplicationResponse]
    total: int
