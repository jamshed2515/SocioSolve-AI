"""
Module 3 – Join Requests API Router (Phase 3).

Endpoints for submitting, retrieving, reviewing, approving, rejecting, and cancelling join requests.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from app.config.database import get_database
from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.join_request_schema import (
    CreateJoinRequest,
    JoinRequestDecision,
    JoinRequestListResponse,
    JoinRequestResponse,
)
from app.modules.team_collaboration.services import join_request_service

router = APIRouter()


# ── 1. Submit Join Request ───────────────────────────────────────────────────
@router.post(
    "",
    response_model=JoinRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a request to join an innovation team",
    tags=["Module 3 – Join Requests"],
)
async def submit_join_request(
    payload: CreateJoinRequest,
    current_user: dict = Depends(get_current_user),
) -> JoinRequestResponse:
    """
    Submit a join request to an active recruiting team.
    Identity is strictly derived from JWT token.
    """
    db = get_database()
    return await join_request_service.submit_join_request(
        db=db, user_doc=current_user, payload=payload
    )


# ── 2. Get My Join Requests ──────────────────────────────────────────────────
@router.get(
    "/my",
    response_model=JoinRequestListResponse,
    summary="Get join requests submitted by the authenticated user",
    tags=["Module 3 – Join Requests"],
)
async def get_my_join_requests(
    status: Optional[str] = Query(None, description="Filter by status (pending, accepted, rejected, cancelled)"),
    current_user: dict = Depends(get_current_user),
) -> JoinRequestListResponse:
    """Retrieve all join requests submitted by the authenticated user."""
    db = get_database()
    user_id = str(current_user["_id"])
    return await join_request_service.get_my_join_requests(
        db=db, user_id=user_id, status_filter=status
    )


# ── 3. Accept or Reject Request ──────────────────────────────────────────────
@router.put(
    "/{request_id}/decision",
    response_model=JoinRequestResponse,
    summary="Accept or reject a pending join request (Leader only)",
    tags=["Module 3 – Join Requests"],
)
async def decide_join_request(
    request_id: str,
    payload: JoinRequestDecision,
    current_user: dict = Depends(get_current_user),
) -> JoinRequestResponse:
    """
    Team Leader approves or rejects a student's join request.
    Approval atomically adds the member to the team and checks capacity.
    """
    db = get_database()
    leader_user_id = str(current_user["_id"])
    return await join_request_service.decide_join_request(
        db=db,
        request_id=request_id,
        leader_user_id=leader_user_id,
        decision=payload.decision,
    )


# ── 4. Cancel Join Request ───────────────────────────────────────────────────
@router.put(
    "/{request_id}/cancel",
    response_model=JoinRequestResponse,
    summary="Cancel a pending join request (Requester only)",
    tags=["Module 3 – Join Requests"],
)
async def cancel_join_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
) -> JoinRequestResponse:
    """
    Cancel an unreviewed pending join request submitted by the authenticated user.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    return await join_request_service.cancel_join_request(
        db=db, request_id=request_id, user_id=user_id
    )


# ── 5. Helper route: Team join requests ──────────────────────────────────────
@router.get(
    "/team/{team_id}",
    response_model=JoinRequestListResponse,
    summary="Get join requests for a team (Leader only)",
    tags=["Module 3 – Join Requests"],
)
async def get_team_join_requests_alias(
    team_id: str,
    status: Optional[str] = Query(None, description="Filter by status (pending, accepted, rejected, cancelled)"),
    current_user: dict = Depends(get_current_user),
) -> JoinRequestListResponse:
    """Retrieve join requests for a specific team. Restricted to the team leader."""
    db = get_database()
    leader_user_id = str(current_user["_id"])
    return await join_request_service.get_team_join_requests(
        db=db, team_id=team_id, leader_user_id=leader_user_id, status_filter=status
    )
