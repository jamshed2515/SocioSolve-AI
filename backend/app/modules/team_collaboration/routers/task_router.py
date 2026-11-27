"""
FastAPI Router for Module 3 – Team Task Management (Phase 6).

Mounted at /api/tasks (and includes helpers for team tasks).
Endpoints:
- GET /api/tasks/my
- GET /api/tasks/{task_id}
- PUT /api/tasks/{task_id}
- PATCH /api/tasks/{task_id}/status
- PATCH /api/tasks/{task_id}/progress
- PATCH /api/tasks/{task_id}/assign
- DELETE /api/tasks/{task_id}
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status

from app.config.database import get_database
from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.task_schema import (
    TaskAssignUpdate,
    TaskCreate,
    TaskListResponse,
    TaskProgressUpdate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.modules.team_collaboration.services import task_service

router = APIRouter()


@router.get(
    "/my",
    response_model=TaskListResponse,
    summary="Get my assigned tasks across teams",
    tags=["Module 3 – Tasks"],
)
async def get_my_tasks(
    status: Optional[str] = Query(None, description="Filter by status (todo, in_progress, review, completed)"),
    priority: Optional[str] = Query(None, description="Filter by priority (low, medium, high, urgent)"),
    sort_by: str = Query("due_date", description="Sort by 'due_date' or 'created_at'"),
    sort_order: str = Query("asc", description="Sort order: 'asc' or 'desc'"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=50, description="Items per page"),
    current_user: dict = Depends(get_current_user),
) -> TaskListResponse:
    """Retrieve all tasks assigned to the authenticated user."""
    db = get_database()
    return await task_service.get_my_assigned_tasks(
        db=db,
        current_user=current_user,
        page=page,
        limit=limit,
        status_filter=status,
        priority_filter=priority,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Get single task details and user permissions",
    tags=["Module 3 – Tasks"],
)
async def get_task_details(
    task_id: str,
    current_user: dict = Depends(get_current_user),
) -> TaskResponse:
    """Retrieve full task details. Team members only."""
    db = get_database()
    return await task_service.get_task_details(
        db=db, task_id_str=task_id, current_user=current_user
    )


@router.put(
    "/{task_id}",
    response_model=TaskResponse,
    summary="Update task details (Leader or creator only)",
    tags=["Module 3 – Tasks"],
)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    current_user: dict = Depends(get_current_user),
) -> TaskResponse:
    """Update title, description, priority, dates, or members. Team leader or task creator."""
    db = get_database()
    return await task_service.update_task(
        db=db, task_id_str=task_id, payload=payload, current_user=current_user
    )


@router.patch(
    "/{task_id}/status",
    response_model=TaskResponse,
    summary="Update task status (Assigned members or leader)",
    tags=["Module 3 – Tasks"],
)
async def update_task_status(
    task_id: str,
    payload: TaskStatusUpdate,
    current_user: dict = Depends(get_current_user),
) -> TaskResponse:
    """Transition task status. Synchronizes progress and completion date."""
    db = get_database()
    return await task_service.update_task_status(
        db=db, task_id_str=task_id, payload=payload, current_user=current_user
    )


@router.patch(
    "/{task_id}/progress",
    response_model=TaskResponse,
    summary="Update task progress 0-100 (Assigned members or leader)",
    tags=["Module 3 – Tasks"],
)
async def update_task_progress(
    task_id: str,
    payload: TaskProgressUpdate,
    current_user: dict = Depends(get_current_user),
) -> TaskResponse:
    """Update progress percentage. Synchronizes status and completion date."""
    db = get_database()
    return await task_service.update_task_progress(
        db=db, task_id_str=task_id, payload=payload, current_user=current_user
    )


@router.patch(
    "/{task_id}/assign",
    response_model=TaskResponse,
    summary="Reassign task members (Team leader only)",
    tags=["Module 3 – Tasks"],
)
async def reassign_task(
    task_id: str,
    payload: TaskAssignUpdate,
    current_user: dict = Depends(get_current_user),
) -> TaskResponse:
    """Change the members assigned to a task. Team leader only."""
    db = get_database()
    return await task_service.reassign_task(
        db=db, task_id_str=task_id, payload=payload, current_user=current_user
    )


@router.delete(
    "/{task_id}",
    summary="Delete task (Leader or creator only)",
    tags=["Module 3 – Tasks"],
)
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a task permanently. Team leader or creator only."""
    db = get_database()
    return await task_service.delete_task(
        db=db, task_id_str=task_id, current_user=current_user
    )
