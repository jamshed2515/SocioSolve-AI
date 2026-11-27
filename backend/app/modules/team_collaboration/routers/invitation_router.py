"""
FastAPI Router for Module 3 – Team Invitations (Phase 4).

Mounted at /api/invitations.
Endpoints for received invitations, sent invitations, respond (accept/reject), and cancel.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from app.config.database import get_database
from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.invitation_schema import (
    InvitationDecision,
    InvitationListResponse,
    InvitationResponse,
)
from app.modules.team_collaboration.services import invitation_service

router = APIRouter()


@router.get(
    "/received",
    response_model=InvitationListResponse,
    summary="Get invitations received by authenticated user",
    tags=["Module 3 – Invitations"],
)
async def get_received_invitations(
    status: Optional[str] = Query(None, description="Filter by status (pending, accepted, rejected, cancelled)"),
    current_user: dict = Depends(get_current_user),
) -> InvitationListResponse:
    """Retrieve all team invitations addressed to the current logged-in user."""
    db = get_database()
    user_id = str(current_user["_id"])
    return await invitation_service.get_my_received_invitations(
        db, user_id_str=user_id, status_filter=status
    )


@router.get(
    "/sent",
    response_model=InvitationListResponse,
    summary="Get invitations sent by authenticated user (team leader)",
    tags=["Module 3 – Invitations"],
)
async def get_sent_invitations(
    team_id: Optional[str] = Query(None, description="Optional team ID filter"),
    status: Optional[str] = Query(None, description="Filter by status (pending, accepted, rejected, cancelled)"),
    current_user: dict = Depends(get_current_user),
) -> InvitationListResponse:
    """Retrieve all team invitations sent by the current logged-in user."""
    db = get_database()
    user_id = str(current_user["_id"])
    return await invitation_service.get_my_sent_invitations(
        db, user_id_str=user_id, status_filter=status, team_id_filter=team_id
    )


@router.put(
    "/{invitation_id}/respond",
    response_model=InvitationResponse,
    summary="Accept or reject a team invitation",
    tags=["Module 3 – Invitations"],
)
async def respond_to_invitation(
    invitation_id: str,
    payload: InvitationDecision,
    current_user: dict = Depends(get_current_user),
) -> InvitationResponse:
    """Invitee accepts or rejects an invitation. Accept enrolls them into the team."""
    db = get_database()
    return await invitation_service.respond_to_team_invitation(
        db,
        invitation_id_str=invitation_id,
        current_user=current_user,
        decision=payload.decision,
    )


@router.put(
    "/{invitation_id}/cancel",
    response_model=InvitationResponse,
    summary="Cancel a pending team invitation",
    tags=["Module 3 – Invitations"],
)
async def cancel_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
) -> InvitationResponse:
    """Team leader cancels a pending invitation they previously sent."""
    db = get_database()
    return await invitation_service.cancel_team_invitation(
        db,
        invitation_id_str=invitation_id,
        current_user=current_user,
    )
