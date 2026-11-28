"""
MongoDB document model and database helpers for Module 3 – Join Requests (Phase 3).

Collection: join_requests
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class JoinRequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


def new_join_request_document(
    team_id: ObjectId,
    user_id: ObjectId,
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build a fresh join request document ready for insertion into MongoDB.
    Initial status is always 'pending'.
    """
    now = datetime.now(timezone.utc)
    return {
        "team_id": team_id,
        "user_id": user_id,
        "message": message.strip() if message else None,
        "status": JoinRequestStatus.PENDING.value,
        "created_at": now,
        "updated_at": now,
    }


async def create_join_request_indexes(db: Any) -> None:
    """
    Create necessary indexes on the `join_requests` collection:
    - team_id
    - user_id
    - status
    - partial unique index on (team_id, user_id) for status == 'pending'
      This allows a user to apply again after rejection or cancellation,
      while strictly forbidding multiple simultaneous pending requests.
    """
    if db is None:
        return
    try:
        await db.join_requests.create_index("team_id")
        await db.join_requests.create_index("user_id")
        await db.join_requests.create_index("status")
        await db.join_requests.create_index("created_at")

        # Partial unique index for simultaneous pending requests
        try:
            await db.join_requests.create_index(
                [("team_id", 1), ("user_id", 1)],
                unique=True,
                partialFilterExpression={"status": "pending"},
                name="unique_pending_join_request",
            )
        except Exception as p_err:
            logger.warning(
                "Could not create partial unique index on join_requests (application check will still enforce): %s",
                p_err,
            )

        logger.info("✅ Module 3 'join_requests' collection indexes verified.")
    except Exception as exc:
        logger.warning("Could not create join_requests collection indexes: %s", exc)
