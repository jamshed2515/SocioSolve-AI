"""
MongoDB document model and database helpers for Module 3 – Team Meeting Management (Phase 7).

Collection: team_meetings
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from bson import ObjectId
import logging

from app.modules.team_collaboration.models.collections import TeamCollaborationCollections

logger = logging.getLogger(__name__)


class MeetingType(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    online = "online"
    offline = "offline"


class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"


def new_meeting_document(
    team_id: ObjectId,
    title: str,
    scheduled_by: ObjectId,
    meeting_date: datetime,
    start_time: str,
    end_time: str,
    description: str = "",
    attendees: Optional[List[ObjectId]] = None,
    timezone_str: str = "Asia/Kolkata",
    meeting_type: MeetingType = MeetingType.ONLINE,
    meeting_link: Optional[str] = None,
    location: Optional[str] = None,
    agenda: Optional[str] = None,
    status: MeetingStatus = MeetingStatus.SCHEDULED,
) -> Dict[str, Any]:
    """Build a fresh meeting document ready for insertion into MongoDB."""
    now = datetime.now(timezone.utc)
    attendees_clean = []
    if attendees:
        seen = set()
        for uid in attendees:
            if uid not in seen:
                seen.add(uid)
                attendees_clean.append(uid)

    type_val = meeting_type.value if isinstance(meeting_type, MeetingType) else meeting_type
    status_val = status.value if isinstance(status, MeetingStatus) else status

    return {
        "team_id": team_id,
        "title": title.strip(),
        "description": description.strip() if description else "",
        "scheduled_by": scheduled_by,
        "attendees": attendees_clean,
        "meeting_date": meeting_date,
        "start_time": start_time.strip(),
        "end_time": end_time.strip(),
        "timezone": timezone_str.strip() if timezone_str else "Asia/Kolkata",
        "meeting_type": type_val,
        "meeting_link": meeting_link.strip() if meeting_link else None,
        "location": location.strip() if location else None,
        "agenda": agenda.strip() if agenda else None,
        "status": status_val,
        "created_at": now,
        "updated_at": now,
    }


async def create_meeting_indexes(db: Any) -> None:
    """Create indexes for team_meetings collection."""
    col = db[TeamCollaborationCollections.TEAM_MEETINGS.value]
    try:
        await col.create_index("team_id")
        await col.create_index("scheduled_by")
        await col.create_index("attendees")
        await col.create_index("meeting_date")
        await col.create_index("status")
        await col.create_index([("team_id", 1), ("meeting_date", 1)])
        await col.create_index([("team_id", 1), ("status", 1)])
        logger.info("team_meetings indexes ensured.")
    except Exception as exc:
        logger.warning("Could not create team_meetings indexes: %s", exc)
