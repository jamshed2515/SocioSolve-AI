"""
MongoDB document model and database helpers for Module 3 – Team Discussions & Comments (Phase 5).

Collections: team_discussions, discussion_comments
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class DiscussionCategory(str, Enum):
    GENERAL = "General"
    IDEAS = "Ideas"
    TECHNICAL = "Technical"
    RESOURCES = "Resources"
    ANNOUNCEMENTS = "Announcements"
    QUESTIONS = "Questions"


def new_discussion_document(
    team_id: ObjectId,
    author_id: ObjectId,
    title: str,
    content: str,
    category: DiscussionCategory = DiscussionCategory.GENERAL,
    is_pinned: bool = False,
    is_locked: bool = False,
) -> Dict[str, Any]:
    """Build a fresh discussion document ready for insertion into MongoDB."""
    now = datetime.now(timezone.utc)
    return {
        "team_id": team_id,
        "author_id": author_id,
        "title": title.strip(),
        "content": content.strip(),
        "category": category.value if isinstance(category, DiscussionCategory) else category,
        "is_pinned": is_pinned,
        "is_locked": is_locked,
        "created_at": now,
        "updated_at": now,
    }


def new_comment_document(
    discussion_id: ObjectId,
    team_id: ObjectId,
    author_id: ObjectId,
    content: str,
    parent_comment_id: Optional[ObjectId] = None,
) -> Dict[str, Any]:
    """Build a fresh discussion comment document."""
    now = datetime.now(timezone.utc)
    return {
        "discussion_id": discussion_id,
        "team_id": team_id,
        "author_id": author_id,
        "content": content.strip(),
        "parent_comment_id": parent_comment_id,
        "created_at": now,
        "updated_at": now,
    }


async def create_discussion_indexes(db: Any) -> None:
    """
    Create necessary indexes on team_discussions and discussion_comments:
    - team_discussions: team_id, author_id, created_at, category, text search
    - discussion_comments: discussion_id, team_id, author_id, parent_comment_id, created_at
    """
    if db is None:
        return
    try:
        # team_discussions indexes
        await db.team_discussions.create_index("team_id")
        await db.team_discussions.create_index("author_id")
        await db.team_discussions.create_index("category")
        await db.team_discussions.create_index("is_pinned")
        await db.team_discussions.create_index([("team_id", 1), ("created_at", -1)])
        await db.team_discussions.create_index([("title", "text"), ("content", "text")])

        # discussion_comments indexes
        await db.discussion_comments.create_index("discussion_id")
        await db.discussion_comments.create_index("team_id")
        await db.discussion_comments.create_index("author_id")
        await db.discussion_comments.create_index("parent_comment_id")
        await db.discussion_comments.create_index([("discussion_id", 1), ("created_at", 1)])

        logger.info("✅ Module 3 'team_discussions' and 'discussion_comments' collection indexes verified.")
    except Exception as exc:
        logger.warning("Could not create discussion/comment collection indexes: %s", exc)
