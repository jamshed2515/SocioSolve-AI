"""
Service layer for Module 3 – Team Milestone Management (Phase 7).

Business logic for:
- Creating milestones (leader only, validates linked tasks belong to team)
- Listing team milestones (filters: status, search, sorted by due date)
- Milestone details (with linked task summaries)
- Updating milestones (leader only)
- Updating milestone progress (0-100, syncs status, completed_at, and overdue calculation)
- Deleting milestones (leader only, preserves linked tasks)
"""
from datetime import datetime, timezone
import math
import re
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
import logging

from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.models.milestone_model import (
    MilestoneStatus,
    new_milestone_document,
)
from app.modules.team_collaboration.schemas.milestone_schema import (
    LinkedTaskInfo,
    MilestoneCreate,
    MilestoneListResponse,
    MilestonePermissions,
    MilestoneProgressUpdate,
    MilestoneResponse,
    MilestoneUpdate,
)

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_object_id(id_str: str, label: str = "ID") -> ObjectId:
    if not id_str or not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}: '{id_str}'",
        )
    return ObjectId(id_str)


def _is_team_member(team: Dict[str, Any], user_id: str) -> bool:
    if not team or not user_id:
        return False
    if str(team.get("leader_id", "")) == str(user_id):
        return True
    return any(str(m.get("user_id", "")) == str(user_id) for m in team.get("members", []))


async def _validate_linked_tasks(
    db: Any, task_ids_raw: Optional[List[str]], team_oid: ObjectId
) -> List[ObjectId]:
    """Validate that every linked task exists in team_tasks and belongs to this team."""
    if not task_ids_raw:
        return []

    cleaned_oids: List[ObjectId] = []
    seen = set()

    for tid in task_ids_raw:
        tid_str = str(tid).strip()
        if not tid_str:
            continue
        if not ObjectId.is_valid(tid_str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task ID in linked tasks: '{tid_str}'",
            )
        oid = ObjectId(tid_str)
        if tid_str not in seen:
            seen.add(tid_str)
            cleaned_oids.append(oid)

    if cleaned_oids:
        # Query existing tasks in this team
        count = await db[TeamCollaborationCollections.TEAM_TASKS.value].count_documents({
            "_id": {"$in": cleaned_oids},
            "team_id": team_oid,
        })
        if count != len(cleaned_oids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more linked tasks do not exist or belong to a different team.",
            )

    return cleaned_oids


def _check_is_overdue(milestone_doc: Dict[str, Any]) -> bool:
    due = milestone_doc.get("due_date")
    if not due or milestone_doc.get("status") == MilestoneStatus.COMPLETED.value:
        return False
    now = _utc_now()
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    return due < now


async def _enrich_milestone_response(
    db: Any, milestone_doc: Dict[str, Any], current_user_id: Optional[str] = None
) -> MilestoneResponse:
    team_oid = milestone_doc.get("team_id")
    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    team_name = team.get("name", "Unknown Team") if team else None

    # Fetch Creator
    creator_oid = milestone_doc.get("created_by")
    creator_name = "Team Leader"
    if creator_oid:
        creator_doc = await db.users.find_one({"_id": creator_oid})
        if creator_doc:
            creator_name = creator_doc.get("name", "Team Leader")

    # Fetch Linked Tasks
    task_oids = milestone_doc.get("linked_task_ids", [])
    linked_tasks: List[LinkedTaskInfo] = []
    task_id_strs: List[str] = []

    if task_oids:
        tasks_cursor = db[TeamCollaborationCollections.TEAM_TASKS.value].find(
            {"_id": {"$in": task_oids}}
        )
        async for t in tasks_cursor:
            task_id_strs.append(str(t["_id"]))
            linked_tasks.append(
                LinkedTaskInfo(
                    id=str(t["_id"]),
                    title=t.get("title", "Task"),
                    status=t.get("status", "todo"),
                    priority=t.get("priority", "medium"),
                    progress=t.get("progress", 0),
                )
            )

    is_overdue = _check_is_overdue(milestone_doc)

    # Status calculation: if status is not completed and due date passed -> overdue
    current_status = milestone_doc.get("status", MilestoneStatus.PENDING.value)
    if is_overdue and current_status != MilestoneStatus.COMPLETED.value:
        current_status = MilestoneStatus.OVERDUE.value

    # Permissions calculation
    is_leader = False
    is_creator = False
    if current_user_id:
        cur_id_str = str(current_user_id)
        if team and str(team.get("leader_id")) == cur_id_str:
            is_leader = True
        is_creator = str(creator_oid) == cur_id_str

    permissions = MilestonePermissions(
        can_edit=is_leader,
        can_update_progress=is_leader,
        can_delete=is_leader,
        is_leader=is_leader,
        is_creator=is_creator,
    )

    return MilestoneResponse(
        id=str(milestone_doc["_id"]),
        team_id=str(team_oid),
        team_name=team_name,
        title=milestone_doc.get("title", ""),
        description=milestone_doc.get("description", ""),
        created_by=str(creator_oid),
        creator_name=creator_name,
        due_date=milestone_doc.get("due_date"),
        status=current_status,
        progress=milestone_doc.get("progress", 0),
        linked_task_ids=task_id_strs,
        linked_tasks=linked_tasks,
        created_at=milestone_doc.get("created_at", _utc_now()),
        updated_at=milestone_doc.get("updated_at", _utc_now()),
        completed_at=milestone_doc.get("completed_at"),
        is_overdue=is_overdue,
        permissions=permissions,
    )


# ── CORE MILESTONE ACTIONS ──────────────────────────────────────────────────

async def create_milestone(
    db: Any, team_id_str: str, payload: MilestoneCreate, current_user: Dict[str, Any]
) -> MilestoneResponse:
    """
    Create a new milestone (Team leader only).
    Validates team existence, leader identity, and linked tasks.
    """
    team_oid = _parse_object_id(team_id_str, "team_id")
    user_id = str(current_user["id"])
    user_oid = _parse_object_id(user_id, "user_id")

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team '{team_id_str}' does not exist.",
        )

    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can create milestones.",
        )

    # Validate linked tasks belong to the same team
    cleaned_task_oids = await _validate_linked_tasks(db, payload.linked_task_ids, team_oid)

    doc = new_milestone_document(
        team_id=team_oid,
        title=payload.title,
        created_by=user_oid,
        due_date=payload.due_date,
        description=payload.description or "",
        status=MilestoneStatus.PENDING,
        progress=0,
        linked_task_ids=cleaned_task_oids,
    )

    result = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Milestone '%s' created in team %s by %s", doc["title"], team_id_str, user_id)

    return await _enrich_milestone_response(db, doc, user_id)


async def get_team_milestones(
    db: Any,
    team_id_str: str,
    current_user: Dict[str, Any],
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    sort_order: str = "asc",
) -> MilestoneListResponse:
    """
    List team milestones with status filtering, search, and pagination. Team members only.
    """
    team_oid = _parse_object_id(team_id_str, "team_id")
    user_id = str(current_user["id"])

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team '{team_id_str}' does not exist.",
        )

    if not _is_team_member(team, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team members can access this team's milestones.",
        )

    query: Dict[str, Any] = {"team_id": team_oid}

    if search and search.strip():
        s = search.strip()
        query["title"] = {"$regex": re.escape(s), "$options": "i"}

    if status_filter and status_filter != "all":
        if status_filter == "overdue":
            now = _utc_now()
            query["due_date"] = {"$lt": now}
            query["status"] = {"$ne": MilestoneStatus.COMPLETED.value}
        else:
            query["status"] = status_filter

    total = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].count_documents(query)

    direction = 1 if sort_order == "asc" else -1
    skip = max(0, (page - 1) * limit)
    cursor = (
        db[TeamCollaborationCollections.TEAM_MILESTONES.value]
        .find(query)
        .sort([("due_date", direction), ("created_at", -1)])
        .skip(skip)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        items.append(await _enrich_milestone_response(db, doc, user_id))

    pages = math.ceil(total / limit) if total > 0 else 1

    return MilestoneListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_milestone_details(
    db: Any, milestone_id_str: str, current_user: Dict[str, Any]
) -> MilestoneResponse:
    """
    Get single milestone details. Restricted to team members.
    """
    milestone_oid = _parse_object_id(milestone_id_str, "milestone_id")
    user_id = str(current_user["id"])

    milestone = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].find_one({"_id": milestone_oid})
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone '{milestone_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": milestone["team_id"]})
    if not team or not _is_team_member(team, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team members can access milestone details.",
        )

    return await _enrich_milestone_response(db, milestone, user_id)


async def update_milestone(
    db: Any, milestone_id_str: str, payload: MilestoneUpdate, current_user: Dict[str, Any]
) -> MilestoneResponse:
    """
    Update milestone details (Team leader only).
    """
    milestone_oid = _parse_object_id(milestone_id_str, "milestone_id")
    user_id = str(current_user["id"])

    milestone = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].find_one({"_id": milestone_oid})
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone '{milestone_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": milestone["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can update milestone details.",
        )

    update_fields: Dict[str, Any] = {"updated_at": _utc_now()}

    if payload.title is not None:
        update_fields["title"] = payload.title.strip()
    if payload.description is not None:
        update_fields["description"] = payload.description.strip()
    if payload.due_date is not None:
        update_fields["due_date"] = payload.due_date
    if payload.status is not None:
        update_fields["status"] = payload.status.value

    if payload.linked_task_ids is not None:
        cleaned_task_oids = await _validate_linked_tasks(db, payload.linked_task_ids, team["_id"])
        update_fields["linked_task_ids"] = cleaned_task_oids

    await db[TeamCollaborationCollections.TEAM_MILESTONES.value].update_one(
        {"_id": milestone_oid}, {"$set": update_fields}
    )

    updated_doc = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].find_one({"_id": milestone_oid})
    logger.info("Milestone %s updated by leader %s", milestone_id_str, user_id)
    return await _enrich_milestone_response(db, updated_doc, user_id)


async def update_milestone_progress(
    db: Any, milestone_id_str: str, payload: MilestoneProgressUpdate, current_user: Dict[str, Any]
) -> MilestoneResponse:
    """
    Update milestone progress 0–100 (Team leader only).
    Synchronizes status and completion date.
    """
    milestone_oid = _parse_object_id(milestone_id_str, "milestone_id")
    user_id = str(current_user["id"])

    milestone = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].find_one({"_id": milestone_oid})
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone '{milestone_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": milestone["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can update milestone progress.",
        )

    prog = payload.progress
    if prog < 0 or prog > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Progress must be between 0 and 100.",
        )

    now = _utc_now()
    update_fields: Dict[str, Any] = {
        "progress": prog,
        "updated_at": now,
    }

    if prog == 100:
        update_fields["status"] = MilestoneStatus.COMPLETED.value
        update_fields["completed_at"] = now
    elif prog == 0:
        update_fields["status"] = MilestoneStatus.PENDING.value
        update_fields["completed_at"] = None
    else:
        update_fields["completed_at"] = None
        update_fields["status"] = MilestoneStatus.IN_PROGRESS.value

    await db[TeamCollaborationCollections.TEAM_MILESTONES.value].update_one(
        {"_id": milestone_oid}, {"$set": update_fields}
    )

    updated_doc = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].find_one({"_id": milestone_oid})
    logger.info("Milestone %s progress updated to %d%% by leader %s", milestone_id_str, prog, user_id)
    return await _enrich_milestone_response(db, updated_doc, user_id)


async def delete_milestone(
    db: Any, milestone_id_str: str, current_user: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Delete milestone (Team leader only). Preserves linked tasks.
    """
    milestone_oid = _parse_object_id(milestone_id_str, "milestone_id")
    user_id = str(current_user["id"])

    milestone = await db[TeamCollaborationCollections.TEAM_MILESTONES.value].find_one({"_id": milestone_oid})
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone '{milestone_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": milestone["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can delete milestones.",
        )

    await db[TeamCollaborationCollections.TEAM_MILESTONES.value].delete_one({"_id": milestone_oid})
    logger.info("Milestone %s deleted by leader %s", milestone_id_str, user_id)
    return {"message": "Milestone deleted successfully.", "milestone_id": milestone_id_str}
