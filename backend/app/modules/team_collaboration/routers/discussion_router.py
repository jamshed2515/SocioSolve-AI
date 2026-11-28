"""
FastAPI Router for Module 3 – Team Discussions & Comments (Phase 5).

Mounted at /api/discussions and /api/comments.
Endpoints for single discussion details, update, delete, pin, lock,
comment creation, comment retrieval, comment update, and comment deletion.
"""
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query, status

from app.config.database import get_database
from app.middleware.auth_middleware import get_current_user
from app.modules.team_collaboration.schemas.discussion_schema import (
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    CommentUpdate,
    DiscussionResponse,
    DiscussionUpdate,
)
from app.modules.team_collaboration.services import discussion_service

router = APIRouter()
comments_router = APIRouter()


# ── DISCUSSIONS ─────────────────────────────────────────────────────────────

@router.get(
    "/{discussion_id}",
    response_model=DiscussionResponse,
    summary="Get discussion details and permissions",
    tags=["Module 3 – Discussions"],
)
async def get_discussion_details(
    discussion_id: str,
    current_user: dict = Depends(get_current_user),
) -> DiscussionResponse:
    """Retrieve details for a single discussion. Restricted to team members."""
    db = get_database()
    return await discussion_service.get_discussion_details(
        db=db, discussion_id_str=discussion_id, current_user=current_user
    )


@router.put(
    "/{discussion_id}",
    response_model=DiscussionResponse,
    summary="Update discussion content (Author or Leader only)",
    tags=["Module 3 – Discussions"],
)
async def update_discussion(
    discussion_id: str,
    payload: DiscussionUpdate,
    current_user: dict = Depends(get_current_user),
) -> DiscussionResponse:
    """Edit discussion title, content, or category. Restricted to author or team leader."""
    db = get_database()
    return await discussion_service.update_discussion(
        db=db,
        discussion_id_str=discussion_id,
        current_user=current_user,
        payload=payload,
    )


@router.delete(
    "/{discussion_id}",
    summary="Delete discussion and its comments (Author or Leader only)",
    tags=["Module 3 – Discussions"],
)
async def delete_discussion(
    discussion_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete discussion and cascade delete all its comments."""
    db = get_database()
    return await discussion_service.delete_discussion(
        db=db, discussion_id_str=discussion_id, current_user=current_user
    )


@router.put(
    "/{discussion_id}/pin",
    response_model=DiscussionResponse,
    summary="Pin or unpin discussion (Leader only)",
    tags=["Module 3 – Discussions"],
)
async def toggle_pin_discussion(
    discussion_id: str,
    is_pinned: Optional[bool] = Query(None, description="Optional explicit boolean pin state"),
    current_user: dict = Depends(get_current_user),
) -> DiscussionResponse:
    """Pin or unpin a discussion to keep priority topics on top. Leader only."""
    db = get_database()
    return await discussion_service.toggle_pin_discussion(
        db=db,
        discussion_id_str=discussion_id,
        current_user=current_user,
        is_pinned=is_pinned,
    )


@router.put(
    "/{discussion_id}/lock",
    response_model=DiscussionResponse,
    summary="Lock or unlock discussion (Leader only)",
    tags=["Module 3 – Discussions"],
)
async def toggle_lock_discussion(
    discussion_id: str,
    is_locked: Optional[bool] = Query(None, description="Optional explicit boolean lock state"),
    current_user: dict = Depends(get_current_user),
) -> DiscussionResponse:
    """Lock or unlock a discussion. Locked discussions reject new comments. Leader only."""
    db = get_database()
    return await discussion_service.toggle_lock_discussion(
        db=db,
        discussion_id_str=discussion_id,
        current_user=current_user,
        is_locked=is_locked,
    )


# ── COMMENTS UNDER DISCUSSION ───────────────────────────────────────────────

@router.post(
    "/{discussion_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add comment or reply to discussion",
    tags=["Module 3 – Discussions"],
)
async def add_comment(
    discussion_id: str,
    payload: CommentCreate,
    current_user: dict = Depends(get_current_user),
) -> CommentResponse:
    """Post a comment or reply to an active (unlocked) team discussion."""
    db = get_database()
    return await discussion_service.add_comment(
        db=db,
        discussion_id_str=discussion_id,
        current_user=current_user,
        payload=payload,
    )


@router.get(
    "/{discussion_id}/comments",
    response_model=CommentListResponse,
    summary="Get discussion comments & replies",
    tags=["Module 3 – Discussions"],
)
async def get_discussion_comments(
    discussion_id: str,
    current_user: dict = Depends(get_current_user),
) -> CommentListResponse:
    """Retrieve chronological comments and nested replies for a discussion."""
    db = get_database()
    return await discussion_service.get_discussion_comments(
        db=db, discussion_id_str=discussion_id, current_user=current_user
    )


# ── STANDALONE COMMENT EDIT/DELETE ─────────────────────────────────────────

@comments_router.put(
    "/{comment_id}",
    response_model=CommentResponse,
    summary="Edit own comment",
    tags=["Module 3 – Comments"],
)
@router.put(
    "/comments/{comment_id}",
    response_model=CommentResponse,
    summary="Edit own comment (via discussions)",
    tags=["Module 3 – Comments"],
)
async def update_comment(
    comment_id: str,
    payload: CommentUpdate,
    current_user: dict = Depends(get_current_user),
) -> CommentResponse:
    """Edit an existing comment. Restricted to the comment author."""
    db = get_database()
    return await discussion_service.update_comment(
        db=db,
        comment_id_str=comment_id,
        current_user=current_user,
        payload=payload,
    )


@comments_router.delete(
    "/{comment_id}",
    summary="Delete comment and replies",
    tags=["Module 3 – Comments"],
)
@router.delete(
    "/comments/{comment_id}",
    summary="Delete comment and replies (via discussions)",
    tags=["Module 3 – Comments"],
)
async def delete_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Delete a comment and any nested replies. Author or team leader only."""
    db = get_database()
    return await discussion_service.delete_comment(
        db=db,
        comment_id_str=comment_id,
        current_user=current_user,
    )
