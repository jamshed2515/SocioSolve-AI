"""
MongoDB document model and database helpers for Module 3 – Team Invitations (Phase 4).

Collection: team_invitations
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class InvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


def new_invitation_document(
    team_id: ObjectId,
    inviter_id: ObjectId,
    invitee_id: ObjectId,
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build a fresh team invitation document ready for insertion into MongoDB.
    Initial status is always 'pending'.
    """
    now = datetime.now(timezone.utc)
    return {
        "team_id": team_id,
        "inviter_id": inviter_id,
        "invitee_id": invitee_id,
        "message": message.strip() if message else None,
        "status": InvitationStatus.PENDING.value,
        "created_at": now,
        "updated_at": now,
    }


async def create_invitation_indexes(db: Any) -> None:
    """
    Create necessary indexes on the `team_invitations` collection:
    - team_id
    - inviter_id
    - invitee_id
    - status
    - created_at
    - partial unique index on (team_id, invitee_id) for status == 'pending'
      This allows a leader to re-invite after rejection or cancellation,
      while strictly forbidding multiple simultaneous pending invitations.
    """
    if db is None:
        return
    try:
        await db.team_invitations.create_index("team_id")
        await db.team_invitations.create_index("inviter_id")
        await db.team_invitations.create_index("invitee_id")
        await db.team_invitations.create_index("status")
        await db.team_invitations.create_index("created_at")

        try:
            await db.team_invitations.create_index(
                [("team_id", 1), ("invitee_id", 1)],
                unique=True,
                partialFilterExpression={"status": "pending"},
                name="unique_pending_team_invitation",
            )
        except Exception as p_err:
            logger.warning(
                "Could not create partial unique index on team_invitations (application check will still enforce): %s",
                p_err,
            )

        logger.info("✅ Module 3 'team_invitations' collection indexes verified.")
    except Exception as exc:
        logger.warning("Could not create team_invitations collection indexes: %s", exc)
