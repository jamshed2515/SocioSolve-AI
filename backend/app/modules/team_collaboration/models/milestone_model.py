"""
MongoDB document model and database helpers for Module 3 – Team Milestone Management (Phase 7).

Collection: team_milestones
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from bson import ObjectId
import logging

from app.modules.team_collaboration.models.collections import TeamCollaborationCollections

logger = logging.getLogger(__name__)


class MilestoneStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"


def new_milestone_document(
    team_id: ObjectId,
    title: str,
    created_by: ObjectId,
    due_date: datetime,
    description: str = "",
    status: MilestoneStatus = MilestoneStatus.PENDING,
    progress: int = 0,
    linked_task_ids: Optional[List[ObjectId]] = None,
) -> Dict[str, Any]:
    """Build a fresh milestone document ready for insertion into MongoDB."""
    now = datetime.now(timezone.utc)
    tasks_clean = []
    if linked_task_ids:
        seen = set()
        for tid in linked_task_ids:
            if tid not in seen:
                seen.add(tid)
                tasks_clean.append(tid)

    is_completed = status == MilestoneStatus.COMPLETED or progress == 100
    if is_completed:
        progress = 100
        completed_at = now
        status_val = MilestoneStatus.COMPLETED.value
    else:
        completed_at = None
        status_val = status.value if isinstance(status, MilestoneStatus) else status

    return {
        "team_id": team_id,
        "title": title.strip(),
        "description": description.strip() if description else "",
        "created_by": created_by,
        "due_date": due_date,
        "status": status_val,
        "progress": progress,
        "linked_task_ids": tasks_clean,
        "created_at": now,
        "updated_at": now,
        "completed_at": completed_at,
    }


async def create_milestone_indexes(db: Any) -> None:
    """Create indexes for team_milestones collection."""
    col = db[TeamCollaborationCollections.TEAM_MILESTONES.value]
    try:
        await col.create_index("team_id")
        await col.create_index("created_by")
        await col.create_index("due_date")
        await col.create_index("status")
        await col.create_index("linked_task_ids")
        await col.create_index([("team_id", 1), ("due_date", 1)])
        await col.create_index([("team_id", 1), ("status", 1)])
        logger.info("team_milestones indexes ensured.")
    except Exception as exc:
        logger.warning("Could not create team_milestones indexes: %s", exc)
