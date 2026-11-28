"""
REST API Router for Notifications (Phase 8).

Mounted at `/api/notifications`.
Provides:
- GET /api/notifications (paginated with filters)
- GET /api/notifications/unread-count
- PATCH /api/notifications/read-all
- PATCH /api/notifications/{notification_id}/read
- DELETE /api/notifications/read (clear all read)
- DELETE /api/notifications/{notification_id}
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.notification_schema import (
    NotificationActionResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.modules.team_collaboration.services import notification_service

router = APIRouter()


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user notifications",
)
async def get_my_notifications(
    is_read: Optional[bool] = Query(None, description="Filter by read/unread state"),
    type: Optional[str] = Query(None, description="Filter by notification type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve notifications belonging to the authenticated user."""
    return await notification_service.get_my_notifications(
        user_id=current_user["_id"],
        is_read=is_read,
        notification_type=type,
        page=page,
        limit=limit,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get unread notification count",
)
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
):
    """Return the unread notification count for badge display."""
    count = await notification_service.get_unread_count(user_id=current_user["_id"])
    return UnreadCountResponse(unread_count=count)


@router.patch(
    "/read-all",
    response_model=NotificationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read",
)
async def mark_all_as_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all unread notifications belonging to authenticated user as read."""
    return await notification_service.mark_all_as_read(user_id=current_user["_id"])


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark single notification as read",
)
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a specific notification as read. Only recipient can perform this."""
    return await notification_service.mark_notification_as_read(
        notification_id=notification_id,
        user_id=current_user["_id"],
    )


@router.delete(
    "/read",
    response_model=NotificationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Clear all read notifications",
)
async def clear_read_notifications(
    current_user: dict = Depends(get_current_user),
):
    """Clear all read notifications belonging to the authenticated user."""
    return await notification_service.clear_read_notifications(user_id=current_user["_id"])


@router.delete(
    "/{notification_id}",
    response_model=NotificationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a single notification",
)
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a specific notification. Only recipient can perform this."""
    return await notification_service.delete_notification(
        notification_id=notification_id,
        user_id=current_user["_id"],
    )
