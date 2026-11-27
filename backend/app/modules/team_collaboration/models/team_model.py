"""
MongoDB document model and database helpers for Module 3 – Teams.

Collection: teams
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class TeamStatus(str, Enum):
    RECRUITING = "recruiting"
    FULL = "full"
    ACTIVE = "active"
    COMPLETED = "completed"


class MemberRole(str, Enum):
    LEADER = "Team Leader"
    MEMBER = "Member"
    CO_LEADER = "Co-Leader"
    DEVELOPER = "Developer"
    RESEARCHER = "Researcher"
    DESIGNER = "Designer"
    DOMAIN_EXPERT = "Domain Expert"


ASSIGNABLE_MEMBER_ROLES = [
    MemberRole.MEMBER.value,
    MemberRole.CO_LEADER.value,
    MemberRole.DEVELOPER.value,
    MemberRole.RESEARCHER.value,
    MemberRole.DESIGNER.value,
    MemberRole.DOMAIN_EXPERT.value,
]


def new_member_document(user_id: ObjectId, role: MemberRole = MemberRole.MEMBER) -> Dict[str, Any]:
    """Build a team member sub-document."""
    return {
        "user_id": user_id,
        "role": role.value if isinstance(role, MemberRole) else role,
        "joined_at": datetime.now(timezone.utc),
    }


def new_team_document(
    name: str,
    description: str,
    challenge_id: ObjectId,
    leader_id: ObjectId,
    max_members: int = 6,
    status: TeamStatus = TeamStatus.RECRUITING,
) -> Dict[str, Any]:
    """
    Build a fresh team document ready for insertion into MongoDB.
    Creator is automatically enrolled as Team Leader in members list.
    """
    now = datetime.now(timezone.utc)
    return {
        "name": name.strip(),
        "description": description.strip(),
        "challenge_id": challenge_id,
        "leader_id": leader_id,
        "members": [
            new_member_document(user_id=leader_id, role=MemberRole.LEADER)
        ],
        "max_members": max_members,
        "status": status.value if isinstance(status, TeamStatus) else status,
        "created_at": now,
        "updated_at": now,
    }


async def create_team_indexes(db: Any) -> None:
    """
    Create necessary indexes on the `teams` collection for efficient lookups:
    - challenge_id
    - leader_id
    - members.user_id
    - status
    - name search index
    """
    if db is None:
        return
    try:
        await db.teams.create_index("challenge_id")
        await db.teams.create_index("leader_id")
        await db.teams.create_index("members.user_id")
        await db.teams.create_index("status")
        await db.teams.create_index([("name", "text"), ("description", "text")])
        logger.info("✅ Module 3 'teams' collection indexes verified.")
    except Exception as exc:
        logger.warning("Could not create teams collection indexes: %s", exc)

