"""
Module 3 – Team Formation & Collaboration API Router.

Endpoints for Team Creation, Exploration, Management, and Foundation Status.
Routes follow Section 10 of Phase 2 specification.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config.database import get_database
from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.common import ModuleStatusResponse
from app.modules.team_collaboration.schemas.team_schema import (
    ChallengeSummary,
    TeamCreate,
    TeamListResponse,
    TeamResponse,
    TeamUpdate,
)
from app.modules.team_collaboration.schemas.join_request_schema import JoinRequestListResponse
from app.modules.team_collaboration.schemas.invitation_schema import (
    ChangeRoleRequest,
    CreateInvitationRequest,
    InvitationResponse,
    TeamMemberDetailResponse,
    UserSearchItem,
)
from app.modules.team_collaboration.services import (
    invitation_service,
    join_request_service,
    team_service,
)
from app.modules.team_collaboration.services.database_service import (
    check_database_readiness,
)

router = APIRouter()

PLANNED_CAPABILITIES = [
    "Team Creation & Management (Phase 2 - Operational)",
    "Team Discovery & Join Requests (Phase 3)",
    "Member Invitations & Role Assignment (Phase 3)",
    "Real-Time Team Discussions via WebSockets / Socket.IO (Phase 4)",
    "Collaborative Task Tracking (Phase 5)",
    "Meetings & Milestones Management (Phase 6)",
]


# ── Foundation Status Check ──────────────────────────────────────────────────
@router.get(
    "/status",
    response_model=ModuleStatusResponse,
    summary="Module 3 foundation status & shared DB readiness check",
    tags=["Module 3 – Teams"],
)
async def get_module_status() -> ModuleStatusResponse:
    """Check readiness of Module 3 and connection to MongoDB Atlas."""
    db_status = await check_database_readiness()
    return ModuleStatusResponse(
        status="operational" if db_status.connected else "degraded",
        database=db_status,
        planned_capabilities=PLANNED_CAPABILITIES,
        timestamp=datetime.now(timezone.utc),
    )


# ── Published Challenges Helper ──────────────────────────────────────────────
@router.get(
    "/challenges",
    response_model=List[ChallengeSummary],
    summary="Get published societal challenges for team alignment",
    tags=["Module 3 – Teams"],
)
async def get_published_challenges(
    current_user: dict = Depends(get_current_user),
) -> List[ChallengeSummary]:
    """Retrieve published challenges from MongoDB for dynamic team formation."""
    db = get_database()
    challenges = await team_service.ensure_published_challenges(db)
    return [ChallengeSummary(**c) for c in challenges]


# ── My Teams ─────────────────────────────────────────────────────────────────
@router.get(
    "/my",
    response_model=TeamListResponse,
    summary="Get teams where the authenticated user is Leader or Member",
    tags=["Module 3 – Teams"],
)
async def get_my_teams(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=50, description="Items per page"),
    current_user: dict = Depends(get_current_user),
) -> TeamListResponse:
    """Retrieve teams associated with the authenticated user."""
    db = get_database()
    user_id = str(current_user["_id"])
    return await team_service.get_my_teams(db, user_id=user_id, page=page, limit=limit)


# ── Create Team ──────────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new societal innovation team",
    tags=["Module 3 – Teams"],
)
async def create_team(
    payload: TeamCreate,
    current_user: dict = Depends(get_current_user),
) -> TeamResponse:
    """
    Create a new team associated with a societal challenge.
    Creator is automatically enrolled as Team Leader with 1 member count.
    """
    db = get_database()
    return await team_service.create_team(db, user_doc=current_user, payload=payload)


# ── Get All Teams (Explore) ──────────────────────────────────────────────────
@router.get(
    "",
    response_model=TeamListResponse,
    summary="Get all teams with optional search and filters",
    tags=["Module 3 – Teams"],
)
async def get_all_teams(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=50, description="Items per page"),
    search: Optional[str] = Query(None, description="Search team name or description"),
    challenge_id: Optional[str] = Query(None, description="Filter by challenge ID"),
    status: Optional[str] = Query(None, description="Filter by status (recruiting, full, active, completed)"),
    current_user: dict = Depends(get_current_user),
) -> TeamListResponse:
    """List and explore societal innovation teams across Jharkhand."""
    db = get_database()
    user_id = str(current_user["_id"]) if current_user else None
    return await team_service.get_all_teams(
        db=db,
        page=page,
        limit=limit,
        search=search,
        challenge_id=challenge_id,
        status_filter=status,
        current_user_id=user_id,
    )


# ── Get Team by ID ───────────────────────────────────────────────────────────
@router.get(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Get team details by ID",
    tags=["Module 3 – Teams"],
)
async def get_team_by_id(
    team_id: str,
    current_user: dict = Depends(get_current_user),
) -> TeamResponse:
    """Retrieve details, leader, and roster for a single team."""
    db = get_database()
    user_id = str(current_user["_id"]) if current_user else None
    return await team_service.get_team_by_id(db, team_id=team_id, current_user_id=user_id)


# ── Update Team ──────────────────────────────────────────────────────────────
@router.put(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Update team name, description, or capacity (Leader only)",
    tags=["Module 3 – Teams"],
)
async def update_team(
    team_id: str,
    payload: TeamUpdate,
    current_user: dict = Depends(get_current_user),
) -> TeamResponse:
    """Update team details. Restricted to the team leader."""
    db = get_database()
    user_id = str(current_user["_id"])
    return await team_service.update_team(
        db=db, team_id=team_id, user_id=user_id, payload=payload
    )


# ── Delete Team ──────────────────────────────────────────────────────────────
@router.delete(
    "/{team_id}",
    summary="Delete team (Leader only)",
    tags=["Module 3 – Teams"],
)
async def delete_team(
    team_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a team. Restricted to the team leader."""
    db = get_database()
    user_id = str(current_user["_id"])
    return await team_service.delete_team(db, team_id=team_id, user_id=user_id)


# ── Get Requests for a Team (Phase 3) ────────────────────────────────────────
@router.get(
    "/{team_id}/join-requests",
    response_model=JoinRequestListResponse,
    summary="Get join requests for a team (Leader only)",
    tags=["Module 3 – Teams"],
)
async def get_team_join_requests(
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


# ── Team Invitations (Phase 4) ───────────────────────────────────────────────
@router.post(
    "/{team_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a user to join the team (Leader only)",
    tags=["Module 3 – Teams"],
)
async def invite_member(
    team_id: str,
    payload: CreateInvitationRequest,
    current_user: dict = Depends(get_current_user),
) -> InvitationResponse:
    """Send an invitation to join the team. Restricted to the team leader."""
    db = get_database()
    return await invitation_service.send_team_invitation(
        db=db,
        team_id_str=team_id,
        inviter_user=current_user,
        payload=payload,
    )


# ── Team Member Management (Phase 4) ─────────────────────────────────────────
@router.get(
    "/{team_id}/members",
    response_model=List[TeamMemberDetailResponse],
    summary="Get sanitized member profiles for a team",
    tags=["Module 3 – Teams"],
)
async def get_team_members(
    team_id: str,
    current_user: dict = Depends(get_current_user),
) -> List[TeamMemberDetailResponse]:
    """Retrieve sanitized profile details of all members in a team."""
    db = get_database()
    return await invitation_service.get_team_members(db=db, team_id_str=team_id)


@router.delete(
    "/{team_id}/members/{user_id}",
    summary="Remove a member from the team (Leader only)",
    tags=["Module 3 – Teams"],
)
async def remove_member(
    team_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Remove a member from the team. Restricted to the team leader."""
    db = get_database()
    return await invitation_service.remove_team_member(
        db=db,
        team_id_str=team_id,
        target_user_id_str=user_id,
        current_user=current_user,
    )


@router.post(
    "/{team_id}/leave",
    summary="Leave a team (Members only)",
    tags=["Module 3 – Teams"],
)
async def leave_team(
    team_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Voluntarily leave a team. Team leader must transfer leadership first."""
    db = get_database()
    return await invitation_service.leave_team(
        db=db,
        team_id_str=team_id,
        current_user=current_user,
    )


@router.put(
    "/{team_id}/members/{user_id}/role",
    summary="Change a member's role (Leader only)",
    tags=["Module 3 – Teams"],
)
async def change_member_role(
    team_id: str,
    user_id: str,
    payload: ChangeRoleRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Change the role of a team member. Restricted to the team leader."""
    db = get_database()
    return await invitation_service.change_member_role(
        db=db,
        team_id_str=team_id,
        target_user_id_str=user_id,
        new_role=payload.role,
        current_user=current_user,
    )


@router.get(
    "/{team_id}/candidate-users",
    response_model=List[UserSearchItem],
    summary="Search users eligible for team invitation",
    tags=["Module 3 – Teams"],
)
async def search_team_candidates(
    team_id: str,
    q: str = Query(..., min_length=1, description="Search by name or email"),
    current_user: dict = Depends(get_current_user),
) -> List[UserSearchItem]:
    """Search users to invite to a team, filtering out current members and the leader."""
    db = get_database()
    all_users = await invitation_service.search_platform_users(
        db=db,
        query=q,
        current_user_id=str(current_user["_id"]),
    )
    # Filter out existing members
    team = await db.teams.find_one({"_id": invitation_service._to_oid(team_id, "Team ID")})
    if not team:
        return all_users
    member_ids = {str(m.get("user_id")) for m in team.get("members", [])}
    member_ids.add(str(team.get("leader_id")))
    return [u for u in all_users if u.id not in member_ids]

