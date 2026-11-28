"""
Pydantic Schemas for Phase 8 Notifications.

Validates and serializes notifications, unread counts, and notification responses.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    """Public representation of a user notification."""

    id: str
    recipient_id: str
    sender_id: Optional[str] = None
    sender_name: Optional[str] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    type: str
    title: str
    message: str
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    is_read: bool = False
    created_at: datetime
    read_at: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


class NotificationListResponse(BaseModel):
    """Paginated list of notifications with unread statistics."""

    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    limit: int
    pages: int


class UnreadCountResponse(BaseModel):
    """Unread notifications count for header badge."""

    unread_count: int


class NotificationActionResponse(BaseModel):
    """Generic status response for read/delete operations."""

    success: bool
    message: str
    affected_count: Optional[int] = None
