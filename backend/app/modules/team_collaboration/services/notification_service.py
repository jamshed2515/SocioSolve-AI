"""
Notification Service (Phase 8).

Handles:
- Persistent storage of notifications in MongoDB
- Real-time delivery to user private rooms via Socket.IO
- Unread count tracking and synchronization
- Read status updates and cleanup operations
- Deduplication of events
"""
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from app.config.database import get_database
from app.modules.team_collaboration.models.notification_model import (
    NotificationType,
    new_notification_document,
)
from app.modules.team_collaboration.schemas.notification_schema import (
    NotificationActionResponse,
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.modules.team_collaboration.socket import emit_to_user

logger = logging.getLogger(__name__)


def _format_notification(doc: Dict[str, Any], sender_name: Optional[str] = None, team_name: Optional[str] = None) -> NotificationResponse:
    """Format MongoDB notification document into NotificationResponse schema."""
    return NotificationResponse(
        id=str(doc["_id"]),
        recipient_id=str(doc["recipient_id"]),
        sender_id=str(doc["sender_id"]) if doc.get("sender_id") else None,
        sender_name=sender_name or doc.get("sender_name"),
        team_id=str(doc["team_id"]) if doc.get("team_id") else None,
        team_name=team_name or doc.get("team_name"),
        type=str(doc.get("type", "general")),
        title=doc.get("title", ""),
        message=doc.get("message", ""),
        reference_id=str(doc["reference_id"]) if doc.get("reference_id") else None,
        reference_type=doc.get("reference_type"),
        is_read=bool(doc.get("is_read", False)),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
        read_at=doc.get("read_at"),
    )


async def create_notification(
    recipient_id: ObjectId | str,
    title: str,
    message: str,
    notification_type: str,
    sender_id: Optional[ObjectId | str] = None,
    team_id: Optional[ObjectId | str] = None,
    reference_id: Optional[str] = None,
    reference_type: Optional[str] = None,
    sender_name: Optional[str] = None,
    team_name: Optional[str] = None,
    prevent_duplicate_window_sec: Optional[int] = 5,
    db: Optional[Any] = None,
) -> Optional[NotificationResponse]:
    """
    Persist a notification into MongoDB and emit real-time event to recipient.
    Guarantees:
    - Never throws uncaught exception to caller (so business operations never fail).
    - Prevents self-notifications (sender != recipient).
    - Deduplicates identical events within time window.
    """
    try:
        recip_oid = ObjectId(recipient_id) if isinstance(recipient_id, str) else recipient_id
        send_oid = ObjectId(sender_id) if isinstance(sender_id, str) else sender_id
        t_oid = ObjectId(team_id) if isinstance(team_id, str) and ObjectId.is_valid(team_id) else (team_id if isinstance(team_id, ObjectId) else None)

        # Do not notify user about their own actions
        if send_oid and recip_oid == send_oid:
            return None

        if db is None:
            db = get_database()
        if db is None or not hasattr(db, "notifications"):
            logger.debug("Notifications collection not available; skipping notification creation.")
            return None

        # Deduplication check
        if prevent_duplicate_window_sec and prevent_duplicate_window_sec > 0:
            window_start = datetime.now(timezone.utc) - timedelta(seconds=prevent_duplicate_window_sec)
            duplicate_filter: Dict[str, Any] = {
                "recipient_id": recip_oid,
                "type": str(notification_type),
                "created_at": {"$gte": window_start},
            }
            if reference_id:
                duplicate_filter["reference_id"] = str(reference_id)
            if t_oid:
                duplicate_filter["team_id"] = t_oid

            existing = await db.notifications.find_one(duplicate_filter)
            if existing:
                logger.info("Duplicate notification suppressed for recipient %s (type: %s)", recip_oid, notification_type)
                return _format_notification(existing, sender_name, team_name)

        # Build and insert notification
        doc = new_notification_document(
            recipient_id=recip_oid,
            title=title,
            message=message,
            notification_type=notification_type,
            sender_id=send_oid,
            team_id=t_oid,
            reference_id=reference_id,
            reference_type=reference_type,
        )
        if sender_name:
            doc["sender_name"] = sender_name
        if team_name:
            doc["team_name"] = team_name

        result = await db.notifications.insert_one(doc)
        doc["_id"] = result.inserted_id

        # Format response
        formatted = _format_notification(doc, sender_name, team_name)

        # Real-time delivery
        unread_count = await db.notifications.count_documents({"recipient_id": recip_oid, "is_read": False})
        await emit_to_user(str(recip_oid), "notification:new", formatted.model_dump(mode="json"))
        await emit_to_user(str(recip_oid), "notification:count_updated", {"unread_count": unread_count})

        return formatted
    except Exception as err:
        logger.error("Failed to create notification: %s", err, exc_info=True)
        return None


async def get_my_notifications(
    user_id: ObjectId | str,
    is_read: Optional[bool] = None,
    notification_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> NotificationListResponse:
    """Retrieve paginated notifications for the authenticated recipient."""
    db = get_database()
    user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id

    query: Dict[str, Any] = {"recipient_id": user_oid}
    if is_read is not None:
        query["is_read"] = is_read
    if notification_type:
        query["type"] = notification_type

    page = max(1, page)
    limit = max(1, min(100, limit))
    skip = (page - 1) * limit

    total = await db.notifications.count_documents(query)
    unread_count = await db.notifications.count_documents({"recipient_id": user_oid, "is_read": False})

    cursor = db.notifications.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = []
    async for doc in cursor:
        items.append(_format_notification(doc))

    pages = max(1, (total + limit - 1) // limit)
    return NotificationListResponse(
        items=items,
        total=total,
        unread_count=unread_count,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_unread_count(user_id: ObjectId | str) -> int:
    """Count unread notifications for a user."""
    db = get_database()
    user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
    return await db.notifications.count_documents({"recipient_id": user_oid, "is_read": False})


async def mark_notification_as_read(
    notification_id: str,
    user_id: ObjectId | str,
) -> NotificationResponse:
    """
    Mark a specific notification as read.
    Enforces that only the recipient can mark it as read.
    """
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid notification ID.")

    db = get_database()
    user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
    notif_oid = ObjectId(notification_id)

    notification = await db.notifications.find_one({"_id": notif_oid})
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")

    if notification["recipient_id"] != user_oid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied. You do not own this notification.")

    if not notification.get("is_read"):
        now = datetime.now(timezone.utc)
        await db.notifications.update_one(
            {"_id": notif_oid},
            {"$set": {"is_read": True, "read_at": now}},
        )
        notification["is_read"] = True
        notification["read_at"] = now

        # Real-time sync
        unread_count = await db.notifications.count_documents({"recipient_id": user_oid, "is_read": False})
        await emit_to_user(str(user_oid), "notification:read", {"notification_id": notification_id})
        await emit_to_user(str(user_oid), "notification:count_updated", {"unread_count": unread_count})

    return _format_notification(notification)


async def mark_all_as_read(user_id: ObjectId | str) -> NotificationActionResponse:
    """
    Mark all notifications belonging to the user as read.
    Only affects notifications where recipient_id == user_id.
    """
    db = get_database()
    user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id

    now = datetime.now(timezone.utc)
    res = await db.notifications.update_many(
        {"recipient_id": user_oid, "is_read": False},
        {"$set": {"is_read": True, "read_at": now}},
    )

    await emit_to_user(str(user_oid), "notification:count_updated", {"unread_count": 0})

    return NotificationActionResponse(
        success=True,
        message="All notifications marked as read.",
        affected_count=res.modified_count,
    )


async def delete_notification(
    notification_id: str,
    user_id: ObjectId | str,
) -> NotificationActionResponse:
    """
    Delete a notification belonging to the authenticated user.
    Enforces strict ownership check.
    """
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid notification ID.")

    db = get_database()
    user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id
    notif_oid = ObjectId(notification_id)

    notification = await db.notifications.find_one({"_id": notif_oid})
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found.")

    if notification["recipient_id"] != user_oid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied. You do not own this notification.")

    await db.notifications.delete_one({"_id": notif_oid})

    # Update unread count if deleted notification was unread
    if not notification.get("is_read"):
        unread_count = await db.notifications.count_documents({"recipient_id": user_oid, "is_read": False})
        await emit_to_user(str(user_oid), "notification:count_updated", {"unread_count": unread_count})

    return NotificationActionResponse(
        success=True,
        message="Notification deleted successfully.",
        affected_count=1,
    )


async def clear_read_notifications(user_id: ObjectId | str) -> NotificationActionResponse:
    """
    Delete all read notifications belonging to the authenticated user.
    Never deletes other users' notifications.
    """
    db = get_database()
    user_oid = ObjectId(user_id) if isinstance(user_id, str) else user_id

    res = await db.notifications.delete_many({"recipient_id": user_oid, "is_read": True})

    return NotificationActionResponse(
        success=True,
        message=f"Cleared {res.deleted_count} read notifications.",
        affected_count=res.deleted_count,
    )
