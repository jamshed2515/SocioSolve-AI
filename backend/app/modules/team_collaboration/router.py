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
from app.modules.team_collaboration.services import team_service
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
