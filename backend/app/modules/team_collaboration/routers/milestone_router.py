"""
FastAPI Router for Module 3 – Team Milestone Management (Phase 7).

Mounted at /api/milestones.
Endpoints:
- GET /api/milestones/{milestone_id}
- PUT /api/milestones/{milestone_id}
- PATCH /api/milestones/{milestone_id}/progress
- DELETE /api/milestones/{milestone_id}
"""
from typing import Any, Dict
from fastapi import APIRouter, Depends, status

from app.config.database import get_database
from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.milestone_schema import (
    MilestoneProgressUpdate,
    MilestoneResponse,
    MilestoneUpdate,
)
from app.modules.team_collaboration.services import milestone_service

router = APIRouter()


@router.get(
    "/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Get milestone details and linked tasks",
    tags=["Module 3 – Milestones"],
)
async def get_milestone_details(
    milestone_id: str,
    current_user: dict = Depends(get_current_user),
) -> MilestoneResponse:
    """Retrieve full details for a milestone including linked task cards."""
    db = get_database()
    return await milestone_service.get_milestone_details(
        db=db, milestone_id_str=milestone_id, current_user=current_user
    )


@router.put(
    "/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Update milestone details (Leader only)",
    tags=["Module 3 – Milestones"],
)
async def update_milestone(
    milestone_id: str,
    payload: MilestoneUpdate,
    current_user: dict = Depends(get_current_user),
) -> MilestoneResponse:
    """Update title, description, due date, or linked tasks. Team leader only."""
    db = get_database()
    return await milestone_service.update_milestone(
        db=db, milestone_id_str=milestone_id, payload=payload, current_user=current_user
    )


@router.patch(
    "/{milestone_id}/progress",
    response_model=MilestoneResponse,
    summary="Update milestone progress 0-100 (Leader only)",
    tags=["Module 3 – Milestones"],
)
async def update_milestone_progress(
    milestone_id: str,
    payload: MilestoneProgressUpdate,
    current_user: dict = Depends(get_current_user),
) -> MilestoneResponse:
    """Update progress percentage. Synchronizes completion status and dates."""
    db = get_database()
    return await milestone_service.update_milestone_progress(
        db=db, milestone_id_str=milestone_id, payload=payload, current_user=current_user
    )


@router.delete(
    "/{milestone_id}",
    summary="Delete milestone (Leader only)",
    tags=["Module 3 – Milestones"],
)
async def delete_milestone(
    milestone_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a milestone. Preserves linked tasks."""
    db = get_database()
    return await milestone_service.delete_milestone(
        db=db, milestone_id_str=milestone_id, current_user=current_user
    )
