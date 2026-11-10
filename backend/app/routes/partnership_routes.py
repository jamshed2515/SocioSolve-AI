"""
Partnership routes – /api/partnerships/*
Module 6: Industry Partnerships.
"""
from fastapi import APIRouter, Depends, Query, status
from typing import Optional

from app.models.user import UserRole
from app.middleware.auth_middleware import get_current_user, require_role
from app.schemas.partnership_schema import (
    CreateOpportunityRequest,
    OpportunityStatusUpdateRequest,
    OpportunityResponse,
    OpportunityListResponse,
    ApplyOpportunityRequest,
    ApplicationResponse,
    ApplicationListResponse,
    UpdateApplicationStatusRequest,
)
from app.services import partnership_service

router = APIRouter()


# ── Opportunities Management (Industry) ────────────────────────────────────────

@router.post(
    "",
    response_model=OpportunityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new partnership opportunity",
)
async def create_opportunity(
    payload: CreateOpportunityRequest,
    current_user: dict = Depends(require_role(UserRole.INDUSTRY)),
):
    """Industry partner creates a new partnership opportunity (Mentorship, Funding, Dataset, Internship)."""
    return await partnership_service.create_opportunity(user=current_user, payload=payload)


@router.get(
    "/my/opportunities",
    response_model=OpportunityListResponse,
    summary="Get my posted opportunities",
)
async def get_my_opportunities(
    current_user: dict = Depends(require_role(UserRole.INDUSTRY)),
):
    """Industry partner views all opportunities they have created."""
    return await partnership_service.get_my_opportunities(industry_user_id=str(current_user["_id"]))


@router.get(
    "/my/incoming-applications",
    response_model=ApplicationListResponse,
    summary="Get all incoming applications across my opportunities",
)
async def get_my_incoming_applications(
    current_user: dict = Depends(require_role(UserRole.INDUSTRY)),
):
    """Industry partner views all submitted applications across all their opportunities."""
    return await partnership_service.get_all_incoming_applications(industry_user_id=str(current_user["_id"]))


# ── Student Application Operations ─────────────────────────────────────────────

@router.get(
    "/my/applications",
    response_model=ApplicationListResponse,
    summary="Get my submitted applications (Student)",
)
async def get_my_applications(
    current_user: dict = Depends(require_role(UserRole.STUDENT)),
):
    """Student views all applications their team has submitted and their live statuses."""
    return await partnership_service.get_my_applications(student_user_id=str(current_user["_id"]))


# ── General Opportunity Browsing ───────────────────────────────────────────────

@router.get(
    "",
    response_model=OpportunityListResponse,
    summary="Browse partnership opportunities",
)
async def list_opportunities(
    type: Optional[str] = Query(None, description="Filter by type (Mentorship, Funding, Dataset, Internship)"),
    category: Optional[str] = Query(None, description="Filter by challenge category"),
    status: Optional[str] = Query(None, description="Filter by status (Active, Closed)"),
    search: Optional[str] = Query(None, description="Search keyword in title, description, or organization"),
    current_user: dict = Depends(get_current_user),
):
    """Browse partnership opportunities with optional filtering. Open to all authenticated users."""
    return await partnership_service.get_opportunities(
        opportunity_type=type,
        category=category,
        status_filter=status,
        search=search,
    )


@router.get(
    "/{opportunity_id}",
    response_model=OpportunityResponse,
    summary="Get opportunity details by ID",
)
async def get_opportunity(
    opportunity_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve full details of a specific partnership opportunity."""
    return await partnership_service.get_opportunity_by_id(opportunity_id=opportunity_id)


@router.patch(
    "/{opportunity_id}/status",
    response_model=OpportunityResponse,
    summary="Toggle opportunity status (Active / Closed)",
)
async def update_opportunity_status(
    opportunity_id: str,
    payload: OpportunityStatusUpdateRequest,
    current_user: dict = Depends(require_role(UserRole.INDUSTRY)),
):
    """Industry partner toggles their opportunity between Active and Closed."""
    return await partnership_service.update_opportunity_status(
        opportunity_id=opportunity_id,
        industry_user_id=str(current_user["_id"]),
        new_status=payload.status,
    )


# ── Applications for Specific Opportunity ──────────────────────────────────────

@router.post(
    "/{opportunity_id}/apply",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply to a partnership opportunity (Student)",
)
async def apply_to_opportunity(
    opportunity_id: str,
    payload: ApplyOpportunityRequest,
    current_user: dict = Depends(require_role(UserRole.STUDENT)),
):
    """Student team applies to an Active partnership opportunity with a pitch message."""
    return await partnership_service.apply_to_opportunity(
        opportunity_id=opportunity_id,
        student_user=current_user,
        payload=payload,
    )


@router.get(
    "/{opportunity_id}/applications",
    response_model=ApplicationListResponse,
    summary="View applications for a specific opportunity (Industry)",
)
async def get_opportunity_applications(
    opportunity_id: str,
    current_user: dict = Depends(require_role(UserRole.INDUSTRY)),
):
    """Industry partner views applications submitted for their specific opportunity."""
    return await partnership_service.get_opportunity_applications(
        opportunity_id=opportunity_id,
        industry_user_id=str(current_user["_id"]),
    )


@router.patch(
    "/applications/{application_id}/status",
    response_model=ApplicationResponse,
    summary="Accept or Reject an application (Industry)",
)
async def update_application_status(
    application_id: str,
    payload: UpdateApplicationStatusRequest,
    current_user: dict = Depends(require_role(UserRole.INDUSTRY)),
):
    """
    Industry partner updates an application's status to Accepted or Rejected.
    Enforces atomic capacity limits and prevents concurrent double-acceptance.
    """
    return await partnership_service.update_application_status(
        application_id=application_id,
        industry_user_id=str(current_user["_id"]),
        payload=payload,
    )

