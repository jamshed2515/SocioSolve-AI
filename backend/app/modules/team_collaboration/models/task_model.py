"""
MongoDB document model and database helpers for Module 3 – Team Task Management (Phase 6).

Collection: team_tasks
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from bson import ObjectId
import logging

from app.modules.team_collaboration.models.collections import TeamCollaborationCollections

logger = logging.getLogger(__name__)


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    todo = "todo"
    in_progress = "in_progress"
    review = "review"
    completed = "completed"


def new_task_document(
    team_id: ObjectId,
    title: str,
    created_by: ObjectId,
    description: str = "",
    assigned_to: Optional[List[ObjectId]] = None,
    priority: TaskPriority = TaskPriority.MEDIUM,
    status: TaskStatus = TaskStatus.TODO,
    start_date: Optional[datetime] = None,
    due_date: Optional[datetime] = None,
    progress: int = 0,
) -> Dict[str, Any]:
    """Build a fresh task document ready for insertion into MongoDB team_tasks."""
    now = datetime.now(timezone.utc)
    assigned_clean = []
    if assigned_to:
        # Deduplicate while preserving order
        seen = set()
        for uid in assigned_to:
            if uid not in seen:
                seen.add(uid)
                assigned_clean.append(uid)

    is_completed = status == TaskStatus.COMPLETED or progress == 100
    if is_completed:
        progress = 100
        completed_at = now
    else:
        completed_at = None

    return {
        "team_id": team_id,
        "title": title.strip(),
        "description": description.strip() if description else "",
        "created_by": created_by,
        "assigned_to": assigned_clean,
        "priority": priority.value if isinstance(priority, TaskPriority) else priority,
        "status": status.value if isinstance(status, TaskStatus) else status,
        "start_date": start_date,
        "due_date": due_date,
        "progress": progress,
        "created_at": now,
        "updated_at": now,
        "completed_at": completed_at,
    }


async def create_task_indexes(db: Any) -> None:
    """
    Create necessary indexes on team_tasks collection:
    - team_id
    - created_by
    - assigned_to
    - status
    - priority
    - due_date
    - created_at
    - compound index on team_id + status
    - compound index on team_id + due_date
    """
    col = db[TeamCollaborationCollections.TEAM_TASKS.value]
    try:
        await col.create_index("team_id")
        await col.create_index("created_by")
        await col.create_index("assigned_to")
        await col.create_index("status")
        await col.create_index("priority")
        await col.create_index("due_date")
        await col.create_index("created_at")
        await col.create_index([("team_id", 1), ("status", 1)])
        await col.create_index([("team_id", 1), ("due_date", 1)])
        await col.create_index([("assigned_to", 1), ("status", 1)])
        logger.info("team_tasks indexes ensured.")
    except Exception as exc:
        logger.warning("Could not create team_tasks indexes: %s", exc)
