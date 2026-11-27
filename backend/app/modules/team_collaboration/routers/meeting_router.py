"""
FastAPI Router for Module 3 – Team Meeting Management (Phase 7).

Mounted at /api/meetings.
Endpoints:
- GET /api/meetings/my
- GET /api/meetings/{meeting_id}
- PUT /api/meetings/{meeting_id}
- PATCH /api/meetings/{meeting_id}/cancel
- DELETE /api/meetings/{meeting_id}
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status

from app.config.database import get_database
from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.meeting_schema import (
    MeetingListResponse,
    MeetingResponse,
    MeetingUpdate,
)
from app.modules.team_collaboration.services import meeting_service

router = APIRouter()


@router.get(
    "/my",
    response_model=MeetingListResponse,
    summary="Get meetings where user is an attendee or organizer",
    tags=["Module 3 – Meetings"],
)
async def get_my_meetings(
    status: Optional[str] = Query(None, description="Filter by status (scheduled, completed, cancelled)"),
    timeframe: Optional[str] = Query(None, description="Filter by timeframe ('upcoming' or 'past')"),
    sort_order: str = Query("asc", description="Sort order: 'asc' or 'desc'"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=50, description="Items per page"),
    current_user: dict = Depends(get_current_user),
) -> MeetingListResponse:
    """List meetings for which the current user is an attendee or organizer across teams."""
    db = get_database()
    return await meeting_service.get_my_meetings(
        db=db,
        current_user=current_user,
        page=page,
        limit=limit,
        status_filter=status,
        timeframe=timeframe,
        sort_order=sort_order,
    )


@router.get(
    "/{meeting_id}",
    response_model=MeetingResponse,
    summary="Get single meeting details and user permissions",
    tags=["Module 3 – Meetings"],
)
async def get_meeting_details(
    meeting_id: str,
    current_user: dict = Depends(get_current_user),
) -> MeetingResponse:
    """Retrieve full details for a scheduled meeting. Team members only."""
    db = get_database()
    return await meeting_service.get_meeting_details(
        db=db, meeting_id_str=meeting_id, current_user=current_user
    )


@router.put(
    "/{meeting_id}",
    response_model=MeetingResponse,
    summary="Update meeting details (Leader or organizer only)",
    tags=["Module 3 – Meetings"],
)
async def update_meeting(
    meeting_id: str,
    payload: MeetingUpdate,
    current_user: dict = Depends(get_current_user),
) -> MeetingResponse:
    """Update title, date, start/end time, location, or attendees. Team leader or organizer only."""
    db = get_database()
    return await meeting_service.update_meeting(
        db=db, meeting_id_str=meeting_id, payload=payload, current_user=current_user
    )


@router.patch(
    "/{meeting_id}/cancel",
    response_model=MeetingResponse,
    summary="Cancel a scheduled meeting (Leader or organizer)",
    tags=["Module 3 – Meetings"],
)
async def cancel_meeting(
    meeting_id: str,
    current_user: dict = Depends(get_current_user),
) -> MeetingResponse:
    """Set meeting status to cancelled. Preserves record for audit."""
    db = get_database()
    return await meeting_service.cancel_meeting(
        db=db, meeting_id_str=meeting_id, current_user=current_user
    )


@router.delete(
    "/{meeting_id}",
    summary="Delete meeting (Leader only)",
    tags=["Module 3 – Meetings"],
)
async def delete_meeting(
    meeting_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete meeting permanently. Preserves completed meetings."""
    db = get_database()
    return await meeting_service.delete_meeting(
        db=db, meeting_id_str=meeting_id, current_user=current_user
    )
