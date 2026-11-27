"""
Service layer for Module 3 – Team Discussions & Comments (Phase 5).

Handles discussion creation, filtering, detail retrieval, updating, deletion,
pinning, locking, comment additions, threading/replies, and comment moderation.
"""
from datetime import datetime, timezone
import logging
import math
import re
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from fastapi import HTTPException, status

from app.modules.team_collaboration.models.discussion_model import (
    DiscussionCategory,
    new_comment_document,
    new_discussion_document,
)
from app.modules.team_collaboration.schemas.discussion_schema import (
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    CommentUpdate,
    DiscussionCreate,
    DiscussionListResponse,
    DiscussionResponse,
    DiscussionUpdate,
)

logger = logging.getLogger(__name__)


def _to_oid(id_str: str, entity_name: str = "ID") -> ObjectId:
    if not id_str or not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {entity_name} format.",
        )
    return ObjectId(id_str)


def _check_team_membership(team: Dict[str, Any], user_id_str: str) -> Tuple[bool, bool, str]:
    """
    Returns (is_member, is_leader, role_in_team).
    A user is considered a member if their user_id is in team.members or they are the team leader.
    """
    leader_id_str = str(team.get("leader_id", ""))
    is_leader = leader_id_str == user_id_str

    role_in_team = "Team Leader" if is_leader else "Member"
    is_member = is_leader

    for m in team.get("members", []):
        if str(m.get("user_id", "")) == user_id_str:
            is_member = True
            if not is_leader:
                role_in_team = m.get("role", "Member")
            break

    return is_member, is_leader, role_in_team


async def _enrich_discussion(
    db: Any,
    doc: Dict[str, Any],
    team: Dict[str, Any],
    current_user_id: Optional[str] = None,
) -> DiscussionResponse:
    """Enrich a discussion document with author details, comment counts, and permissions."""
    disc_id_str = str(doc["_id"])
    team_id_str = str(doc.get("team_id", ""))
    author_oid = doc.get("author_id")
    author_id_str = str(author_oid) if author_oid else ""

    # Fetch Author details
    author_name = "Team Member"
    author_email = None
    author_profile_image = None
    if author_oid:
        u = await db.users.find_one({"_id": author_oid})
        if u:
            author_name = u.get("name") or "Team Member"
            author_email = u.get("email")
            author_profile_image = u.get("profile_image") or u.get("profileImage")

    # Author's role in the team
    _, _, author_role = _check_team_membership(team, author_id_str)

    # Comment count
    comment_count = 0
    if hasattr(db, "discussion_comments"):
        if hasattr(db.discussion_comments, "count_documents"):
            comment_count = await db.discussion_comments.count_documents({"discussion_id": doc["_id"]})
        else:
            # Mock collection fallback
            c_cursor = db.discussion_comments.find({"discussion_id": doc["_id"]})
            c_list = [c async for c in c_cursor]
            comment_count = len(c_list)

    # Permissions for current user
    is_author = bool(current_user_id and current_user_id == author_id_str)
    is_leader = bool(current_user_id and str(team.get("leader_id", "")) == current_user_id)
    can_edit = is_author or is_leader
    can_delete = is_author or is_leader
    can_pin = is_leader
    can_lock = is_leader

    return DiscussionResponse(
        id=disc_id_str,
        team_id=team_id_str,
        team_name=team.get("name"),
        author_id=author_id_str,
        author_name=author_name,
        author_email=author_email,
        author_role=author_role,
        author_profile_image=author_profile_image,
        title=doc.get("title", ""),
        content=doc.get("content", ""),
        category=doc.get("category", DiscussionCategory.GENERAL.value),
        is_pinned=bool(doc.get("is_pinned", False)),
        is_locked=bool(doc.get("is_locked", False)),
        comment_count=comment_count,
        is_author=is_author,
        is_leader=is_leader,
        can_edit=can_edit,
        can_delete=can_delete,
        can_pin=can_pin,
        can_lock=can_lock,
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
        updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
    )


# ── DISCUSSIONS ─────────────────────────────────────────────────────────────

async def create_discussion(
    db: Any,
    team_id_str: str,
    author_user: Dict[str, Any],
    payload: DiscussionCreate,
) -> DiscussionResponse:
    """Create a new discussion within a team. User must be a team member."""
    team_oid = _to_oid(team_id_str, "Team ID")
    author_oid = author_user["_id"]
    author_id_str = str(author_oid)

    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    is_member, _, _ = _check_team_membership(team, author_id_str)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only team members can create discussions in this team.",
        )

    doc = new_discussion_document(
        team_id=team_oid,
        author_id=author_oid,
        title=payload.title,
        content=payload.content,
        category=payload.category,
        is_pinned=False,
        is_locked=False,
    )

    result = await db.team_discussions.insert_one(doc)
    doc["_id"] = result.inserted_id

    logger.info(
        "User %s created discussion '%s' (%s) in team %s",
        author_id_str,
        payload.title,
        result.inserted_id,
        team_oid,
    )
    return await _enrich_discussion(db, doc, team, current_user_id=author_id_str)


async def get_team_discussions(
    db: Any,
    team_id_str: str,
    current_user: Dict[str, Any],
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_order: str = "latest",
    page: int = 1,
    limit: int = 20,
) -> DiscussionListResponse:
    """Retrieve discussions for a team with search, category filtering, and pagination."""
    team_oid = _to_oid(team_id_str, "Team ID")
    user_id_str = str(current_user["_id"])

    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    is_member, _, _ = _check_team_membership(team, user_id_str)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only team members can view discussions for this team.",
        )

    query: Dict[str, Any] = {"team_id": team_oid}

    if category and category.strip().lower() != "all":
        query["category"] = category.strip()

    if search and search.strip():
        escaped = re.escape(search.strip())
        query["$or"] = [
            {"title": {"$regex": escaped, "$options": "i"}},
            {"content": {"$regex": escaped, "$options": "i"}},
        ]

    # Fetch total count
    all_matching_cursor = db.team_discussions.find(query)
    all_matching = [d async for d in all_matching_cursor]
    total = len(all_matching)

    # Sort in memory or via cursor: pinned discussions first, then created_at
    reverse_created = sort_order != "oldest"
    all_matching.sort(
        key=lambda d: (
            1 if d.get("is_pinned") else 0,
            d.get("created_at", datetime.min),
        ),
        reverse=True if reverse_created else False,
    )

    # Re-ensure pinned are at the very top regardless of created_at
    pinned = [d for d in all_matching if d.get("is_pinned")]
    unpinned = [d for d in all_matching if not d.get("is_pinned")]
    pinned.sort(key=lambda d: d.get("created_at", datetime.min), reverse=reverse_created)
    unpinned.sort(key=lambda d: d.get("created_at", datetime.min), reverse=reverse_created)
    sorted_docs = pinned + unpinned

    # Pagination slice
    skip = max(0, (page - 1) * limit)
    paginated_docs = sorted_docs[skip : skip + limit]

    items: List[DiscussionResponse] = []
    for d in paginated_docs:
        items.append(await _enrich_discussion(db, d, team, current_user_id=user_id_str))

    pages = max(1, math.ceil(total / limit)) if limit > 0 else 1
    return DiscussionListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_discussion_details(
    db: Any,
    discussion_id_str: str,
    current_user: Dict[str, Any],
) -> DiscussionResponse:
    """Get single discussion details with permissions. Verifies team membership."""
    disc_oid = _to_oid(discussion_id_str, "Discussion ID")
    user_id_str = str(current_user["_id"])

    disc = await db.team_discussions.find_one({"_id": disc_oid})
    if not disc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found.",
        )

    team = await db.teams.find_one({"_id": disc["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team associated with this discussion was not found.",
        )

    is_member, _, _ = _check_team_membership(team, user_id_str)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only team members can view this discussion.",
        )

    return await _enrich_discussion(db, disc, team, current_user_id=user_id_str)


async def update_discussion(
    db: Any,
    discussion_id_str: str,
    current_user: Dict[str, Any],
    payload: DiscussionUpdate,
) -> DiscussionResponse:
    """Edit an existing discussion. Restricted to author or team leader."""
    disc_oid = _to_oid(discussion_id_str, "Discussion ID")
    user_id_str = str(current_user["_id"])
    now = datetime.now(timezone.utc)

    disc = await db.team_discussions.find_one({"_id": disc_oid})
    if not disc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found.",
        )

    team = await db.teams.find_one({"_id": disc["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team not found.",
        )

    is_author = str(disc.get("author_id")) == user_id_str
    is_leader = str(team.get("leader_id")) == user_id_str
    if not (is_author or is_leader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the discussion author or team leader can edit this discussion.",
        )

    update_fields: Dict[str, Any] = {"updated_at": now}
    if payload.title is not None:
        update_fields["title"] = payload.title.strip()
    if payload.content is not None:
        update_fields["content"] = payload.content.strip()
    if payload.category is not None:
        update_fields["category"] = payload.category

    await db.team_discussions.update_one({"_id": disc_oid}, {"$set": update_fields})
    disc.update(update_fields)

    logger.info("User %s updated discussion %s", user_id_str, disc_oid)
    return await _enrich_discussion(db, disc, team, current_user_id=user_id_str)


async def delete_discussion(
    db: Any,
    discussion_id_str: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """Delete discussion and cascade delete associated comments. Author or leader only."""
    disc_oid = _to_oid(discussion_id_str, "Discussion ID")
    user_id_str = str(current_user["_id"])

    disc = await db.team_discussions.find_one({"_id": disc_oid})
    if not disc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found.",
        )

    team = await db.teams.find_one({"_id": disc["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team not found.",
        )

    is_author = str(disc.get("author_id")) == user_id_str
    is_leader = str(team.get("leader_id")) == user_id_str
    if not (is_author or is_leader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the discussion author or team leader can delete this discussion.",
        )

    # Delete discussion
    if hasattr(db.team_discussions, "delete_one"):
        await db.team_discussions.delete_one({"_id": disc_oid})
    else:
        db.team_discussions.docs = [d for d in db.team_discussions.docs if d.get("_id") != disc_oid]

    # Cascade delete all comments under this discussion
    if hasattr(db, "discussion_comments"):
        if hasattr(db.discussion_comments, "delete_many"):
            await db.discussion_comments.delete_many({"discussion_id": disc_oid})
        else:
            db.discussion_comments.docs = [
                c for c in db.discussion_comments.docs if c.get("discussion_id") != disc_oid
            ]

    logger.info("User %s deleted discussion %s and its comments", user_id_str, disc_oid)
    return {
        "success": True,
        "message": "Discussion and associated comments deleted successfully.",
        "discussion_id": discussion_id_str,
    }


async def toggle_pin_discussion(
    db: Any,
    discussion_id_str: str,
    current_user: Dict[str, Any],
    is_pinned: Optional[bool] = None,
) -> DiscussionResponse:
    """Pin or unpin a discussion. Restricted to team leader."""
    disc_oid = _to_oid(discussion_id_str, "Discussion ID")
    user_id_str = str(current_user["_id"])
    now = datetime.now(timezone.utc)

    disc = await db.team_discussions.find_one({"_id": disc_oid})
    if not disc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found.",
        )

    team = await db.teams.find_one({"_id": disc["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id_str
    if not is_leader:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can pin or unpin discussions.",
        )

    new_pin_status = (not disc.get("is_pinned", False)) if is_pinned is None else is_pinned
    await db.team_discussions.update_one(
        {"_id": disc_oid},
        {"$set": {"is_pinned": new_pin_status, "updated_at": now}},
    )
    disc["is_pinned"] = new_pin_status
    disc["updated_at"] = now

    logger.info("Leader %s set is_pinned=%s on discussion %s", user_id_str, new_pin_status, disc_oid)
    return await _enrich_discussion(db, disc, team, current_user_id=user_id_str)


async def toggle_lock_discussion(
    db: Any,
    discussion_id_str: str,
    current_user: Dict[str, Any],
    is_locked: Optional[bool] = None,
) -> DiscussionResponse:
    """Lock or unlock a discussion. Restricted to team leader."""
    disc_oid = _to_oid(discussion_id_str, "Discussion ID")
    user_id_str = str(current_user["_id"])
    now = datetime.now(timezone.utc)

    disc = await db.team_discussions.find_one({"_id": disc_oid})
    if not disc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found.",
        )

    team = await db.teams.find_one({"_id": disc["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id_str
    if not is_leader:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can lock or unlock discussions.",
        )

    new_lock_status = (not disc.get("is_locked", False)) if is_locked is None else is_locked
    await db.team_discussions.update_one(
        {"_id": disc_oid},
        {"$set": {"is_locked": new_lock_status, "updated_at": now}},
    )
    disc["is_locked"] = new_lock_status
    disc["updated_at"] = now

    logger.info("Leader %s set is_locked=%s on discussion %s", user_id_str, new_lock_status, disc_oid)
    return await _enrich_discussion(db, disc, team, current_user_id=user_id_str)


# ── COMMENTS ───────────────────────────────────────────────────────────────

async def add_comment(
    db: Any,
    discussion_id_str: str,
    current_user: Dict[str, Any],
    payload: CommentCreate,
) -> CommentResponse:
    """Add a comment or reply to a discussion. Discussion must not be locked."""
    disc_oid = _to_oid(discussion_id_str, "Discussion ID")
    user_oid = current_user["_id"]
    user_id_str = str(user_oid)

    # 1. Fetch discussion
    disc = await db.team_discussions.find_one({"_id": disc_oid})
    if not disc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found.",
        )

    # 2. Fetch team and check membership
    team = await db.teams.find_one({"_id": disc["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team not found.",
        )

    is_member, is_leader, user_role = _check_team_membership(team, user_id_str)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only team members can comment on this discussion.",
        )

    # 3. Check if locked
    if disc.get("is_locked", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This discussion is locked. No new comments or replies can be posted.",
        )

    # 4. If parent_comment_id provided, verify parent exists in the SAME discussion
    parent_oid = None
    if payload.parent_comment_id:
        parent_oid = _to_oid(payload.parent_comment_id, "Parent Comment ID")
        parent_comment = await db.discussion_comments.find_one({"_id": parent_oid})
        if not parent_comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent comment not found.",
            )
        if str(parent_comment.get("discussion_id")) != str(disc_oid):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent comment does not belong to this discussion.",
            )

    doc = new_comment_document(
        discussion_id=disc_oid,
        team_id=disc["team_id"],
        author_id=user_oid,
        content=payload.content,
        parent_comment_id=parent_oid,
    )

    result = await db.discussion_comments.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Touch discussion updated_at
    await db.team_discussions.update_one(
        {"_id": disc_oid},
        {"$set": {"updated_at": datetime.now(timezone.utc)}},
    )

    author_name = current_user.get("name") or "Team Member"
    author_email = current_user.get("email")
    author_profile_image = current_user.get("profile_image") or current_user.get("profileImage")

    return CommentResponse(
        id=str(result.inserted_id),
        discussion_id=str(disc_oid),
        team_id=str(disc["team_id"]),
        author_id=user_id_str,
        author_name=author_name,
        author_email=author_email,
        author_role=user_role,
        author_profile_image=author_profile_image,
        content=doc["content"],
        parent_comment_id=str(parent_oid) if parent_oid else None,
        replies_count=0,
        replies=[],
        is_author=True,
        can_edit=True,
        can_delete=True,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


async def get_discussion_comments(
    db: Any,
    discussion_id_str: str,
    current_user: Dict[str, Any],
) -> CommentListResponse:
    """
    Retrieve all comments for a discussion organized chronologically.
    Top-level comments include their direct replies in a structured hierarchy.
    """
    disc_oid = _to_oid(discussion_id_str, "Discussion ID")
    user_id_str = str(current_user["_id"])

    disc = await db.team_discussions.find_one({"_id": disc_oid})
    if not disc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discussion not found.",
        )

    team = await db.teams.find_one({"_id": disc["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team not found.",
        )

    is_member, is_leader, _ = _check_team_membership(team, user_id_str)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only team members can view discussion comments.",
        )

    cursor = db.discussion_comments.find({"discussion_id": disc_oid}).sort("created_at", 1)
    raw_comments = [c async for c in cursor]

    # Pre-fetch author user documents
    author_ids = [c.get("author_id") for c in raw_comments if c.get("author_id")]
    user_map = {}
    if author_ids:
        u_cursor = db.users.find({"_id": {"$in": author_ids}})
        async for u in u_cursor:
            user_map[str(u["_id"])] = u

    # Build schema items
    built_items: Dict[str, CommentResponse] = {}
    for c in raw_comments:
        cid_str = str(c["_id"])
        c_author_oid = c.get("author_id")
        c_author_id_str = str(c_author_oid) if c_author_oid else ""

        u_info = user_map.get(c_author_id_str, {})
        _, _, c_author_role = _check_team_membership(team, c_author_id_str)

        is_c_author = c_author_id_str == user_id_str
        can_c_edit = is_c_author
        can_c_delete = is_c_author or is_leader

        parent_id_str = str(c.get("parent_comment_id")) if c.get("parent_comment_id") else None

        built_items[cid_str] = CommentResponse(
            id=cid_str,
            discussion_id=str(c.get("discussion_id")),
            team_id=str(c.get("team_id")),
            author_id=c_author_id_str,
            author_name=u_info.get("name") or "Team Member",
            author_email=u_info.get("email"),
            author_role=c_author_role,
            author_profile_image=u_info.get("profile_image") or u_info.get("profileImage"),
            content=c.get("content", ""),
            parent_comment_id=parent_id_str,
            replies_count=0,
            replies=[],
            is_author=is_c_author,
            can_edit=can_c_edit,
            can_delete=can_c_delete,
            created_at=c.get("created_at", datetime.now(timezone.utc)),
            updated_at=c.get("updated_at", datetime.now(timezone.utc)),
        )

    # Nest replies into their top-level parent
    top_level_comments: List[CommentResponse] = []
    for cid_str, comment in built_items.items():
        parent_id = comment.parent_comment_id
        if parent_id and parent_id in built_items:
            built_items[parent_id].replies.append(comment)
            built_items[parent_id].replies_count += 1
        else:
            top_level_comments.append(comment)

    # Sort top-level comments chronologically (oldest first for dialogue flow)
    top_level_comments.sort(key=lambda x: x.created_at)
    return CommentListResponse(items=top_level_comments, total=len(raw_comments))


async def update_comment(
    db: Any,
    comment_id_str: str,
    current_user: Dict[str, Any],
    payload: CommentUpdate,
) -> CommentResponse:
    """Edit own comment. Only the comment author can edit."""
    comment_oid = _to_oid(comment_id_str, "Comment ID")
    user_id_str = str(current_user["_id"])
    now = datetime.now(timezone.utc)

    comment = await db.discussion_comments.find_one({"_id": comment_oid})
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    # Author check
    if str(comment.get("author_id")) != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can edit this comment.",
        )

    # Discussion locked check
    disc = await db.team_discussions.find_one({"_id": comment["discussion_id"]})
    if disc and disc.get("is_locked", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit comments in a locked discussion.",
        )

    await db.discussion_comments.update_one(
        {"_id": comment_oid},
        {"$set": {"content": payload.content.strip(), "updated_at": now}},
    )
    comment["content"] = payload.content.strip()
    comment["updated_at"] = now

    team = await db.teams.find_one({"_id": comment["team_id"]})
    _, _, author_role = _check_team_membership(team or {}, user_id_str)

    parent_id_str = str(comment.get("parent_comment_id")) if comment.get("parent_comment_id") else None

    logger.info("User %s updated comment %s", user_id_str, comment_oid)
    return CommentResponse(
        id=str(comment_oid),
        discussion_id=str(comment["discussion_id"]),
        team_id=str(comment["team_id"]),
        author_id=user_id_str,
        author_name=current_user.get("name") or "Team Member",
        author_email=current_user.get("email"),
        author_role=author_role,
        author_profile_image=current_user.get("profile_image") or current_user.get("profileImage"),
        content=comment["content"],
        parent_comment_id=parent_id_str,
        is_author=True,
        can_edit=True,
        can_delete=True,
        created_at=comment.get("created_at", now),
        updated_at=now,
    )


async def delete_comment(
    db: Any,
    comment_id_str: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """Delete a comment and any nested replies. Comment author or team leader only."""
    comment_oid = _to_oid(comment_id_str, "Comment ID")
    user_id_str = str(current_user["_id"])

    comment = await db.discussion_comments.find_one({"_id": comment_oid})
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    team = await db.teams.find_one({"_id": comment["team_id"]})
    is_author = str(comment.get("author_id")) == user_id_str
    is_leader = team and str(team.get("leader_id")) == user_id_str

    if not (is_author or is_leader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the comment author or team leader can delete this comment.",
        )

    # Delete the comment
    if hasattr(db.discussion_comments, "delete_one"):
        await db.discussion_comments.delete_one({"_id": comment_oid})
    else:
        db.discussion_comments.docs = [
            c for c in db.discussion_comments.docs if c.get("_id") != comment_oid
        ]

    # Delete replies to this comment
    if hasattr(db.discussion_comments, "delete_many"):
        await db.discussion_comments.delete_many({"parent_comment_id": comment_oid})
    else:
        db.discussion_comments.docs = [
            c for c in db.discussion_comments.docs if c.get("parent_comment_id") != comment_oid
        ]

    logger.info("User %s deleted comment %s and its replies", user_id_str, comment_oid)
    return {
        "success": True,
        "message": "Comment deleted successfully.",
        "comment_id": comment_id_str,
    }
