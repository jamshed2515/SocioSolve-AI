"""
Service layer for Module 3 – Team Task Management (Phase 6).

Full business logic for:
- Creating tasks (leader only, team members validation, date validation)
- Listing team tasks (pagination, filtering, sorting, member access check)
- Listing my assigned tasks (across teams, filters, sorting)
- Getting single task details (with creator, assignees, team info, user permissions)
- Updating task details (leader or creator, validate dates and assignees)
- Updating task status (assigned members or leader, syncs progress and completed_at)
- Updating task progress (assigned members or leader, syncs status and completed_at)
- Reassigning tasks (leader only, verifies team members, deduplicates)
- Deleting tasks (leader or creator)
"""
from datetime import datetime, timezone
import math
import re
from typing import Any, Dict, List, Optional, Set
from bson import ObjectId
from fastapi import HTTPException, status
import logging

from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.models.task_model import (
    TaskPriority,
    TaskStatus,
    new_task_document,
)
from app.modules.team_collaboration.schemas.task_schema import (
    AssignedMemberInfo,
    TaskAssignUpdate,
    TaskCreate,
    TaskListResponse,
    TaskPermissions,
    TaskProgressUpdate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
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
    """Check if user_id is the leader or in the accepted members list."""
    if not team or not user_id:
        return False
    if str(team.get("leader_id", "")) == str(user_id):
        return True
    return any(str(m.get("user_id", "")) == str(user_id) for m in team.get("members", []))


def _get_team_member_ids(team: Dict[str, Any]) -> Set[str]:
    """Return all valid user IDs (as strings) that belong to the team."""
    ids = set()
    if team.get("leader_id"):
        ids.add(str(team["leader_id"]))
    for m in team.get("members", []):
        if m.get("user_id"):
            ids.add(str(m["user_id"]))
    return ids


def _validate_and_clean_assignees(
    assigned_to_raw: Optional[List[str]], team: Dict[str, Any]
) -> List[ObjectId]:
    """Validate that every assigned user ID is a valid ObjectId and belongs to the team."""
    if not assigned_to_raw:
        return []

    valid_member_ids = _get_team_member_ids(team)
    cleaned_oids: List[ObjectId] = []
    seen = set()

    for uid in assigned_to_raw:
        uid_str = str(uid).strip()
        if not uid_str:
            continue
        if not ObjectId.is_valid(uid_str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid user ID in assignees: '{uid_str}'",
            )
        if uid_str not in valid_member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {uid_str} is not a member of team '{team.get('name', 'this team')}'. External users cannot be assigned.",
            )
        if uid_str not in seen:
            seen.add(uid_str)
            cleaned_oids.append(ObjectId(uid_str))

    return cleaned_oids


def _check_is_overdue(task_doc: Dict[str, Any]) -> bool:
    due = task_doc.get("due_date")
    if not due or task_doc.get("status") == TaskStatus.COMPLETED.value:
        return False
    now = _utc_now()
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    return due < now


async def _enrich_task_response(
    db: Any, task_doc: Dict[str, Any], current_user_id: Optional[str] = None
) -> TaskResponse:
    """Enrich task document with creator details, assignee details, team name, and user permissions."""
    team_oid = task_doc.get("team_id")
    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    team_name = team.get("name", "Unknown Team") if team else None

    # Fetch Creator
    creator_oid = task_doc.get("created_by")
    creator_name = "Team Member"
    creator_email = None
    if creator_oid:
        creator_doc = await db.users.find_one({"_id": creator_oid})
        if creator_doc:
            creator_name = creator_doc.get("name", "Team Member")
            creator_email = creator_doc.get("email")

    # Fetch Assignees
    assigned_oids = task_doc.get("assigned_to", [])
    assigned_members: List[AssignedMemberInfo] = []
    assigned_id_strs: List[str] = []

    if assigned_oids:
        users_cursor = db.users.find({"_id": {"$in": assigned_oids}})
        user_map = {}
        async for u in users_cursor:
            user_map[str(u["_id"])] = u

        # Team member role map
        role_map = {}
        if team:
            if str(team.get("leader_id")) == str(creator_oid):
                role_map[str(team.get("leader_id"))] = "Leader"
            for m in team.get("members", []):
                role_map[str(m.get("user_id"))] = m.get("role", "Member")

        for oid in assigned_oids:
            oid_str = str(oid)
            assigned_id_strs.append(oid_str)
            user_data = user_map.get(oid_str)
            assigned_members.append(
                AssignedMemberInfo(
                    id=oid_str,
                    name=user_data.get("name", "Member") if user_data else "Member",
                    email=user_data.get("email") if user_data else None,
                    avatar=user_data.get("avatar") if user_data else None,
                    role=role_map.get(oid_str, "Member"),
                )
            )

    # Permissions calculation
    is_leader = False
    is_assigned = False
    can_edit = False
    can_delete = False
    can_update_status = False
    can_update_progress = False
    can_reassign = False

    if current_user_id:
        cur_id_str = str(current_user_id)
        if team and str(team.get("leader_id")) == cur_id_str:
            is_leader = True
        is_assigned = cur_id_str in assigned_id_strs

        is_creator = str(creator_oid) == cur_id_str
        can_edit = is_leader or is_creator
        can_delete = is_leader or is_creator
        can_update_status = is_leader or is_assigned
        can_update_progress = is_leader or is_assigned
        can_reassign = is_leader

    permissions = TaskPermissions(
        can_edit=can_edit,
        can_delete=can_delete,
        can_update_status=can_update_status,
        can_update_progress=can_update_progress,
        can_reassign=can_reassign,
        is_leader=is_leader,
        is_assigned=is_assigned,
    )

    return TaskResponse(
        id=str(task_doc["_id"]),
        team_id=str(team_oid),
        team_name=team_name,
        title=task_doc.get("title", ""),
        description=task_doc.get("description", ""),
        created_by=str(creator_oid),
        creator_name=creator_name,
        creator_email=creator_email,
        assigned_to=assigned_id_strs,
        assigned_members=assigned_members,
        priority=task_doc.get("priority", TaskPriority.MEDIUM.value),
        status=task_doc.get("status", TaskStatus.TODO.value),
        start_date=task_doc.get("start_date"),
        due_date=task_doc.get("due_date"),
        progress=task_doc.get("progress", 0),
        created_at=task_doc.get("created_at", _utc_now()),
        updated_at=task_doc.get("updated_at", _utc_now()),
        completed_at=task_doc.get("completed_at"),
        is_overdue=_check_is_overdue(task_doc),
        permissions=permissions,
    )


# ── CORE SERVICE ACTIONS ───────────────────────────────────────────────────

async def create_task(
    db: Any, team_id_str: str, payload: TaskCreate, current_user: Dict[str, Any]
) -> TaskResponse:
    """
    Create a new team task (Leader only).
    Validates team existence, leader identity, assignees team membership, and dates.
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

    # Leader only creation rule
    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can create tasks.",
        )

    # Validate dates
    if payload.start_date and payload.due_date and payload.due_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="due_date cannot be earlier than start_date",
        )

    # Validate assignees belong to team
    assigned_oids = _validate_and_clean_assignees(payload.assigned_to, team)

    # Create document
    doc = new_task_document(
        team_id=team_oid,
        title=payload.title,
        description=payload.description or "",
        created_by=user_oid,
        assigned_to=assigned_oids,
        priority=payload.priority,
        status=TaskStatus.TODO,
        start_date=payload.start_date,
        due_date=payload.due_date,
        progress=0,
    )

    result = await db[TeamCollaborationCollections.TEAM_TASKS.value].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Task '%s' created in team %s by leader %s", doc["title"], team_id_str, user_id)

    return await _enrich_task_response(db, doc, user_id)


async def get_team_tasks(
    db: Any,
    team_id_str: str,
    current_user: Dict[str, Any],
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    assigned_to: Optional[str] = None,
    sort_by: str = "due_date",
    sort_order: str = "asc",
) -> TaskListResponse:
    """
    List tasks in a team. Restricted to team members.
    Supports search, status/priority/assigned filtering, and sorting.
    """
    team_oid = _parse_object_id(team_id_str, "team_id")
    user_id = str(current_user["id"])

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team '{team_id_str}' does not exist.",
        )

    # Team member access check
    if not _is_team_member(team, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team members can access this team's tasks.",
        )

    query: Dict[str, Any] = {"team_id": team_oid}

    if search and search.strip():
        s = search.strip()
        query["title"] = {"$regex": re.escape(s), "$options": "i"}

    if status_filter and status_filter != "all":
        query["status"] = status_filter

    if priority_filter and priority_filter != "all":
        query["priority"] = priority_filter

    if assigned_to and assigned_to != "all":
        assignee_oid = _parse_object_id(assigned_to, "assigned_to")
        query["assigned_to"] = assignee_oid

    total = await db[TeamCollaborationCollections.TEAM_TASKS.value].count_documents(query)

    # Sort criteria
    direction = 1 if sort_order == "asc" else -1
    if sort_by == "created_at":
        sort_spec = [("created_at", direction)]
    else:
        # Default due_date sort
        sort_spec = [("due_date", direction), ("created_at", -1)]

    skip = max(0, (page - 1) * limit)
    cursor = (
        db[TeamCollaborationCollections.TEAM_TASKS.value]
        .find(query)
        .sort(sort_spec)
        .skip(skip)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        items.append(await _enrich_task_response(db, doc, user_id))

    pages = math.ceil(total / limit) if total > 0 else 1

    return TaskListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_my_assigned_tasks(
    db: Any,
    current_user: Dict[str, Any],
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    sort_by: str = "due_date",
    sort_order: str = "asc",
) -> TaskListResponse:
    """
    Get all tasks assigned to the current user across all teams.
    Supports status & priority filters, pagination, and due date sorting.
    """
    user_id = str(current_user["id"])
    user_oid = _parse_object_id(user_id, "user_id")

    query: Dict[str, Any] = {"assigned_to": user_oid}

    if status_filter and status_filter != "all":
        query["status"] = status_filter

    if priority_filter and priority_filter != "all":
        query["priority"] = priority_filter

    total = await db[TeamCollaborationCollections.TEAM_TASKS.value].count_documents(query)

    direction = 1 if sort_order == "asc" else -1
    if sort_by == "created_at":
        sort_spec = [("created_at", direction)]
    else:
        sort_spec = [("due_date", direction), ("created_at", -1)]

    skip = max(0, (page - 1) * limit)
    cursor = (
        db[TeamCollaborationCollections.TEAM_TASKS.value]
        .find(query)
        .sort(sort_spec)
        .skip(skip)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        items.append(await _enrich_task_response(db, doc, user_id))

    pages = math.ceil(total / limit) if total > 0 else 1

    return TaskListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_task_details(
    db: Any, task_id_str: str, current_user: Dict[str, Any]
) -> TaskResponse:
    """
    Get single task details. Restricted to team members.
    """
    task_oid = _parse_object_id(task_id_str, "task_id")
    user_id = str(current_user["id"])

    task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": task["team_id"]})
    if not team or not _is_team_member(team, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team members can access task details.",
        )

    return await _enrich_task_response(db, task, user_id)


async def update_task(
    db: Any, task_id_str: str, payload: TaskUpdate, current_user: Dict[str, Any]
) -> TaskResponse:
    """
    Update general task fields (Leader or creator only).
    Validates newly assigned members and date range.
    """
    task_oid = _parse_object_id(task_id_str, "task_id")
    user_id = str(current_user["id"])

    task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": task["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id
    is_creator = str(task.get("created_by")) == user_id

    if not (is_leader or is_creator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader or task creator can update task details.",
        )

    update_fields: Dict[str, Any] = {"updated_at": _utc_now()}

    # Validate dates in relation to existing or new values
    effective_start = payload.start_date if payload.start_date is not None else task.get("start_date")
    effective_due = payload.due_date if payload.due_date is not None else task.get("due_date")

    if effective_start and effective_due and effective_due < effective_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="due_date cannot be earlier than start_date",
        )

    if payload.title is not None:
        update_fields["title"] = payload.title.strip()
    if payload.description is not None:
        update_fields["description"] = payload.description.strip()
    if payload.priority is not None:
        update_fields["priority"] = payload.priority.value
    if payload.start_date is not None:
        update_fields["start_date"] = payload.start_date
    if payload.due_date is not None:
        update_fields["due_date"] = payload.due_date

    # Assignment updates: only team leader can reassign members
    if payload.assigned_to is not None:
        if not is_leader:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the team leader can change task assignments.",
            )
        assigned_oids = _validate_and_clean_assignees(payload.assigned_to, team)
        update_fields["assigned_to"] = assigned_oids

    await db[TeamCollaborationCollections.TEAM_TASKS.value].update_one(
        {"_id": task_oid}, {"$set": update_fields}
    )

    updated_task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    logger.info("Task %s updated by user %s", task_id_str, user_id)
    return await _enrich_task_response(db, updated_task, user_id)


async def update_task_status(
    db: Any, task_id_str: str, payload: TaskStatusUpdate, current_user: Dict[str, Any]
) -> TaskResponse:
    """
    Update task status (Assigned members or team leader).
    Synchronizes progress and completed_at consistently.
    """
    task_oid = _parse_object_id(task_id_str, "task_id")
    user_id = str(current_user["id"])

    task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": task["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id
    assigned_ids = [str(u) for u in task.get("assigned_to", [])]
    is_assigned = user_id in assigned_ids

    if not (is_leader or is_assigned):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only assigned members or the team leader can update task status.",
        )

    new_status = payload.status.value
    old_status = task.get("status", TaskStatus.TODO.value)
    now = _utc_now()

    update_fields: Dict[str, Any] = {
        "status": new_status,
        "updated_at": now,
    }

    if new_status == TaskStatus.COMPLETED.value:
        update_fields["progress"] = 100
        update_fields["completed_at"] = now
    else:
        # Reopening or moving between incomplete states
        update_fields["completed_at"] = None
        if old_status == TaskStatus.COMPLETED.value:
            # Reopened
            if new_status == TaskStatus.TODO.value:
                update_fields["progress"] = 0
            else:
                update_fields["progress"] = 50
        else:
            if new_status == TaskStatus.TODO.value:
                update_fields["progress"] = 0
            elif new_status == TaskStatus.IN_PROGRESS.value:
                if task.get("progress", 0) == 0:
                    update_fields["progress"] = 25
                elif task.get("progress", 0) == 100:
                    update_fields["progress"] = 50
            elif new_status == TaskStatus.REVIEW.value:
                if task.get("progress", 0) == 0 or task.get("progress", 0) == 100:
                    update_fields["progress"] = 75

    await db[TeamCollaborationCollections.TEAM_TASKS.value].update_one(
        {"_id": task_oid}, {"$set": update_fields}
    )

    updated_task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    logger.info("Task %s status transitioned to '%s' by user %s", task_id_str, new_status, user_id)
    return await _enrich_task_response(db, updated_task, user_id)


async def update_task_progress(
    db: Any, task_id_str: str, payload: TaskProgressUpdate, current_user: Dict[str, Any]
) -> TaskResponse:
    """
    Update task progress percentage 0–100 (Assigned members or team leader).
    Synchronizes status and completed_at consistently.
    """
    task_oid = _parse_object_id(task_id_str, "task_id")
    user_id = str(current_user["id"])

    task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": task["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id
    assigned_ids = [str(u) for u in task.get("assigned_to", [])]
    is_assigned = user_id in assigned_ids

    if not (is_leader or is_assigned):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only assigned members or the team leader can update task progress.",
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
        update_fields["status"] = TaskStatus.COMPLETED.value
        update_fields["completed_at"] = now
    elif prog == 0:
        update_fields["status"] = TaskStatus.TODO.value
        update_fields["completed_at"] = None
    else:
        update_fields["completed_at"] = None
        current_status = task.get("status", TaskStatus.TODO.value)
        if current_status in (TaskStatus.COMPLETED.value, TaskStatus.TODO.value):
            update_fields["status"] = TaskStatus.IN_PROGRESS.value
        # If already in review or in_progress, keep it

    await db[TeamCollaborationCollections.TEAM_TASKS.value].update_one(
        {"_id": task_oid}, {"$set": update_fields}
    )

    updated_task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    logger.info("Task %s progress updated to %d%% by user %s", task_id_str, prog, user_id)
    return await _enrich_task_response(db, updated_task, user_id)


async def reassign_task(
    db: Any, task_id_str: str, payload: TaskAssignUpdate, current_user: Dict[str, Any]
) -> TaskResponse:
    """
    Reassign task to team members (Team Leader only).
    Validates members belong to the team and deduplicates user IDs.
    """
    task_oid = _parse_object_id(task_id_str, "task_id")
    user_id = str(current_user["id"])

    task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": task["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can change task assignments.",
        )

    assigned_oids = _validate_and_clean_assignees(payload.assigned_to, team)

    await db[TeamCollaborationCollections.TEAM_TASKS.value].update_one(
        {"_id": task_oid},
        {"$set": {"assigned_to": assigned_oids, "updated_at": _utc_now()}},
    )

    updated_task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    logger.info("Task %s reassigned to %d members by leader %s", task_id_str, len(assigned_oids), user_id)
    return await _enrich_task_response(db, updated_task, user_id)


async def delete_task(
    db: Any, task_id_str: str, current_user: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Delete a task (Team Leader or creator only).
    """
    task_oid = _parse_object_id(task_id_str, "task_id")
    user_id = str(current_user["id"])

    task = await db[TeamCollaborationCollections.TEAM_TASKS.value].find_one({"_id": task_oid})
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{task_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": task["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id
    is_creator = str(task.get("created_by")) == user_id

    if not (is_leader or is_creator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader or task creator can delete this task.",
        )

    await db[TeamCollaborationCollections.TEAM_TASKS.value].delete_one({"_id": task_oid})
    logger.info("Task %s deleted by user %s", task_id_str, user_id)

    return {"message": "Task deleted successfully.", "task_id": task_id_str}
