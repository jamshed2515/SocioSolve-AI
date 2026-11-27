"""
MongoDB Model and Schema definition for Notifications (Phase 8).

Defines the structure for the `notifications` collection, covering:
- In-app notification documents
- Notification type enums
- Indexes for recipient, status, type, and timeline queries
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from bson import ObjectId


class NotificationType(str, Enum):
    """Notification classification types across Module 3."""

    TEAM_INVITATION = "team_invitation"
    team_invitation = "team_invitation"

    JOIN_REQUEST_RECEIVED = "join_request_received"
    join_request_received = "join_request_received"

    JOIN_REQUEST_ACCEPTED = "join_request_accepted"
    join_request_accepted = "join_request_accepted"

    JOIN_REQUEST_REJECTED = "join_request_rejected"
    join_request_rejected = "join_request_rejected"

    MEMBER_ADDED = "member_added"
    member_added = "member_added"

    MEMBER_REMOVED = "member_removed"
    member_removed = "member_removed"

    MEMBER_ROLE_CHANGED = "member_role_changed"
    member_role_changed = "member_role_changed"

    TASK_ASSIGNED = "task_assigned"
    task_assigned = "task_assigned"

    TASK_UPDATED = "task_updated"
    task_updated = "task_updated"

    TASK_COMPLETED = "task_completed"
    task_completed = "task_completed"

    DISCUSSION_CREATED = "discussion_created"
    discussion_created = "discussion_created"

    DISCUSSION_COMMENT = "discussion_comment"
    discussion_comment = "discussion_comment"

    MEETING_SCHEDULED = "meeting_scheduled"
    meeting_scheduled = "meeting_scheduled"

    MEETING_UPDATED = "meeting_updated"
    meeting_updated = "meeting_updated"

    MEETING_CANCELLED = "meeting_cancelled"
    meeting_cancelled = "meeting_cancelled"

    MILESTONE_CREATED = "milestone_created"
    milestone_created = "milestone_created"

    MILESTONE_UPDATED = "milestone_updated"
    milestone_updated = "milestone_updated"

    MILESTONE_COMPLETED = "milestone_completed"
    milestone_completed = "milestone_completed"


def new_notification_document(
    recipient_id: ObjectId,
    title: str,
    message: str,
    notification_type: str,
    sender_id: Optional[ObjectId] = None,
    team_id: Optional[ObjectId] = None,
    reference_id: Optional[str] = None,
    reference_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new notification document ready for MongoDB insertion."""
    now = datetime.now(timezone.utc)
    return {
        "recipient_id": recipient_id,
        "sender_id": sender_id,
        "team_id": team_id,
        "type": str(notification_type),
        "title": title.strip(),
        "message": message.strip(),
        "reference_id": str(reference_id) if reference_id else None,
        "reference_type": str(reference_type) if reference_type else None,
        "is_read": False,
        "created_at": now,
        "read_at": None,
    }


async def create_notification_indexes(db) -> None:
    """Create indexes for the notifications collection."""
    # 1. Primary index: recipient + created_at desc (for newest notifications)
    await db.notifications.create_index([("recipient_id", 1), ("created_at", -1)])

    # 2. Filter index: recipient + is_read (for unread count & read/unread filtering)
    await db.notifications.create_index([("recipient_id", 1), ("is_read", 1)])

    # 3. Filter index: recipient + type (for type filtering)
    await db.notifications.create_index([("recipient_id", 1), ("type", 1)])

    # 4. Optional team-level index
    await db.notifications.create_index("team_id")

    # 5. Global timestamp index
    await db.notifications.create_index([("created_at", -1)])
