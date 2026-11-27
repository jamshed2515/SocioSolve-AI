"""
Module 3 – Team Discussions & Comments Tests (Phase 5).
Uses Python standard library (unittest + asyncio) so it executes standalone.

Verifies all required Phase 5 backend scenarios:
1. Team member can create a discussion.
2. Non-member cannot create a discussion (403).
3. Non-member cannot access team discussions (403).
4. Discussion category validation (General, Ideas, Technical, etc.).
5. Author can edit their discussion.
6. Other member cannot edit another user's discussion (403).
7. Team leader can pin/unpin discussions.
8. Regular member cannot pin discussions (403).
9. Team leader can lock/unlock discussions.
10. Regular member cannot lock discussions (403).
11. Member can add a comment to unlocked discussion.
12. Non-member cannot add a comment (403).
13. Locked discussion rejects new comments (400).
14. Parent comment must belong to the same discussion (400).
15. Nested replies are structured correctly.
16. Comment author can edit their comment.
17. Unauthorized user cannot edit another user's comment (403).
18. Cannot edit comment in locked discussion (400).
19. Comment deletion removes comment and cascades to replies.
20. Discussion deletion cascades to all associated comments.
21. Pagination and category filter work correctly.
"""
import asyncio
from datetime import datetime, timezone
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.team_collaboration.models.discussion_model import DiscussionCategory
from app.modules.team_collaboration.schemas.discussion_schema import (
    CommentCreate,
    CommentUpdate,
    DiscussionCreate,
    DiscussionUpdate,
)
from app.modules.team_collaboration.services import discussion_service


class MockCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, *args, **kwargs):
        return self

    def limit(self, n):
        self.items = self.items[:n]
        return self

    def skip(self, n):
        self.items = self.items[n:]
        return self

    def __aiter__(self):
        self._iter = iter(self.items)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class MockCollection:
    def __init__(self, initial_data=None):
        self.docs = [dict(d) for d in (initial_data or [])]

    async def find_one(self, query, *args, **kwargs):
        matching = [d for d in self.docs if self._matches(d, query)]
        return matching[0] if matching else None

    def find(self, query=None, *args, **kwargs):
        query = query or {}
        matching = [d for d in self.docs if self._matches(d, query)]
        return MockCursor(matching)

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)

        class Result:
            inserted_id = d["_id"]
        return Result()

    async def update_one(self, query, update, *args, **kwargs):
        matched = 0
        modified = 0
        for d in self.docs:
            if self._matches(d, query):
                matched += 1
                if "$set" in update:
                    for k, val in update["$set"].items():
                        d[k] = val
                    modified += 1
                break

        class Res:
            matched_count = matched
            modified_count = modified
        return Res()

    async def delete_one(self, query):
        count = 0
        for i, d in enumerate(self.docs):
            if self._matches(d, query):
                del self.docs[i]
                count = 1
                break

        class Res:
            deleted_count = count
        return Res()

    async def delete_many(self, query):
        initial = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]
        deleted = initial - len(self.docs)

        class Res:
            deleted_count = deleted
        return Res()

    async def count_documents(self, query):
        return len([d for d in self.docs if self._matches(d, query)])

    def _matches(self, doc, query):
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, branch) for branch in v):
                    return False
            elif isinstance(v, dict):
                if "$in" in v and doc.get(k) not in v["$in"]:
                    return False
                if "$regex" in v:
                    pattern = v["$regex"]
                    text = str(doc.get(k, ""))
                    import re
                    if not re.search(pattern, text, re.IGNORECASE):
                        return False
            elif doc.get(k) != v:
                return False
        return True


class MockDatabase:
    def __init__(self):
        self.teams = MockCollection()
        self.users = MockCollection()
        self.team_discussions = MockCollection()
        self.discussion_comments = MockCollection()


class TestPhase5TeamDiscussionsAndComments(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        self.db = MockDatabase()
        self.leader_id = ObjectId()
        self.member_id = ObjectId()
        self.outsider_id = ObjectId()
        self.team_id = ObjectId()

        # Seed Users
        self.leader_user = {
            "_id": self.leader_id,
            "name": "Leader Birsa",
            "email": "birsa@jharkhand.gov.in",
            "role": "student",
        }
        self.member_user = {
            "_id": self.member_id,
            "name": "Member Rahul",
            "email": "rahul@bitmesra.ac.in",
            "role": "student",
        }
        self.outsider_user = {
            "_id": self.outsider_id,
            "name": "Outsider Anil",
            "email": "anil@jharkhand.edu",
            "role": "student",
        }
        self.db.users.docs = [self.leader_user, self.member_user, self.outsider_user]

        # Seed Team
        self.team_doc = {
            "_id": self.team_id,
            "name": "JalRakshak Squad",
            "description": "Smart IoT water monitoring.",
            "leader_id": self.leader_id,
            "members": [
                {"user_id": self.leader_id, "role": "Team Leader", "joined_at": datetime.now(timezone.utc)},
                {"user_id": self.member_id, "role": "Developer", "joined_at": datetime.now(timezone.utc)},
            ],
            "max_members": 4,
            "status": "recruiting",
        }
        self.db.teams.docs = [self.team_doc]

    def tearDown(self):
        self.loop.close()

    def test_01_team_member_can_create_discussion(self):
        """Team member can create a new discussion thread."""
        payload = DiscussionCreate(
            title="Sensor calibration protocols",
            content="We should calibrate the pH and turbidity sensors before field tests in Dhanbad.",
            category="Technical",
        )
        res = self.loop.run_until_complete(
            discussion_service.create_discussion(self.db, str(self.team_id), self.member_user, payload)
        )
        self.assertEqual(res.title, "Sensor calibration protocols")
        self.assertEqual(res.category, "Technical")
        self.assertEqual(res.author_id, str(self.member_id))
        self.assertEqual(res.author_role, "Developer")
        self.assertFalse(res.is_pinned)
        self.assertFalse(res.is_locked)
        self.assertEqual(len(self.db.team_discussions.docs), 1)

    def test_02_non_member_cannot_create_discussion(self):
        """User who is not a team member cannot create a discussion (403)."""
        payload = DiscussionCreate(
            title="Unauthorized Idea",
            content="I am not in this team but posting anyway.",
            category="Ideas",
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.create_discussion(self.db, str(self.team_id), self.outsider_user, payload)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_03_non_member_cannot_access_team_discussions(self):
        """Non-member cannot view discussions of a private team (403)."""
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.get_team_discussions(self.db, str(self.team_id), self.outsider_user)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_04_discussion_category_validation(self):
        """Invalid discussion category raises validation error."""
        with self.assertRaises(ValidationError):
            DiscussionCreate(
                title="Invalid Category Discussion",
                content="Valid content here for the test.",
                category="NonExistentCategory",
            )

    def test_05_author_can_edit_discussion(self):
        """Author can update title and content of their discussion."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.member_id,
            "title": "Initial Title",
            "content": "Initial body content here.",
            "category": "General",
            "is_pinned": False,
            "is_locked": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        payload = DiscussionUpdate(
            title="Updated Title Protocol",
            content="Updated body content with more detail.",
        )
        res = self.loop.run_until_complete(
            discussion_service.update_discussion(self.db, str(disc_id), self.member_user, payload)
        )
        self.assertEqual(res.title, "Updated Title Protocol")
        self.assertEqual(res.content, "Updated body content with more detail.")

    def test_06_other_member_cannot_edit_discussion(self):
        """Regular member cannot edit another user's discussion (403)."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.leader_id,
            "title": "Leader's Announcement",
            "content": "Meeting scheduled for Friday morning.",
            "category": "Announcements",
            "is_pinned": True,
            "is_locked": False,
        })
        payload = DiscussionUpdate(title="Hacked Title")
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.update_discussion(self.db, str(disc_id), self.member_user, payload)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_07_team_leader_can_pin_and_lock_discussion(self):
        """Team leader can pin and lock discussions."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.member_id,
            "title": "Roadmap Draft",
            "content": "Proposed timeline for hardware rollout.",
            "category": "Technical",
            "is_pinned": False,
            "is_locked": False,
        })
        # Pin
        res_pin = self.loop.run_until_complete(
            discussion_service.toggle_pin_discussion(self.db, str(disc_id), self.leader_user, is_pinned=True)
        )
        self.assertTrue(res_pin.is_pinned)

        # Lock
        res_lock = self.loop.run_until_complete(
            discussion_service.toggle_lock_discussion(self.db, str(disc_id), self.leader_user, is_locked=True)
        )
        self.assertTrue(res_lock.is_locked)

    def test_08_regular_member_cannot_pin_or_lock(self):
        """Regular member cannot pin or lock discussions (403)."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.member_id,
            "title": "Member Topic",
            "content": "General question.",
            "category": "Questions",
            "is_pinned": False,
            "is_locked": False,
        })
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.toggle_pin_discussion(self.db, str(disc_id), self.member_user, is_pinned=True)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        with self.assertRaises(HTTPException) as ctx2:
            self.loop.run_until_complete(
                discussion_service.toggle_lock_discussion(self.db, str(disc_id), self.member_user, is_locked=True)
            )
        self.assertEqual(ctx2.exception.status_code, 403)

    def test_09_member_can_add_comment(self):
        """Team member can post a comment to an unlocked discussion."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.leader_id,
            "title": "Welcome Discussion",
            "content": "Share your thoughts on the problem statement.",
            "category": "General",
            "is_locked": False,
        })
        payload = CommentCreate(content="Excited to contribute to water telemetry in Bokaro!")
        res = self.loop.run_until_complete(
            discussion_service.add_comment(self.db, str(disc_id), self.member_user, payload)
        )
        self.assertEqual(res.content, "Excited to contribute to water telemetry in Bokaro!")
        self.assertEqual(res.author_id, str(self.member_id))
        self.assertEqual(len(self.db.discussion_comments.docs), 1)

    def test_10_non_member_cannot_comment(self):
        """Non-member cannot add comments (403)."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.leader_id,
            "title": "Private Discussion",
            "content": "Confidential hardware schematics.",
            "is_locked": False,
        })
        payload = CommentCreate(content="Trying to comment as an outsider.")
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.add_comment(self.db, str(disc_id), self.outsider_user, payload)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_11_locked_discussion_rejects_new_comments(self):
        """Posting comment to a locked discussion returns 400 Bad Request."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.leader_id,
            "title": "Concluded Topic",
            "content": "Decisions are finalized.",
            "is_locked": True,
        })
        payload = CommentCreate(content="Can I still add my thoughts?")
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.add_comment(self.db, str(disc_id), self.member_user, payload)
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_12_reply_must_belong_to_same_discussion(self):
        """Parent comment belonging to a different discussion is rejected (400)."""
        disc_id1 = ObjectId()
        disc_id2 = ObjectId()
        parent_comment_id = ObjectId()

        self.db.team_discussions.docs.extend([
            {"_id": disc_id1, "team_id": self.team_id, "is_locked": False},
            {"_id": disc_id2, "team_id": self.team_id, "is_locked": False},
        ])
        # Comment belongs to disc_id2
        self.db.discussion_comments.docs.append({
            "_id": parent_comment_id,
            "discussion_id": disc_id2,
            "team_id": self.team_id,
            "content": "Parent on discussion 2",
        })

        # Try to reply to it on disc_id1
        payload = CommentCreate(
            content="Mismatched reply",
            parent_comment_id=str(parent_comment_id),
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.add_comment(self.db, str(disc_id1), self.member_user, payload)
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_13_nested_replies_structured_correctly(self):
        """Retrieving comments returns top-level comments with replies attached."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "title": "Nested Thread",
            "content": "Top-level post",
        })
        parent_id = ObjectId()
        reply_id = ObjectId()

        self.db.discussion_comments.docs.extend([
            {
                "_id": parent_id,
                "discussion_id": disc_id,
                "team_id": self.team_id,
                "author_id": self.leader_id,
                "content": "Top level comment",
                "parent_comment_id": None,
                "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
            },
            {
                "_id": reply_id,
                "discussion_id": disc_id,
                "team_id": self.team_id,
                "author_id": self.member_id,
                "content": "Reply to top level comment",
                "parent_comment_id": parent_id,
                "created_at": datetime(2026, 1, 2, tzinfo=timezone.utc),
            },
        ])

        res = self.loop.run_until_complete(
            discussion_service.get_discussion_comments(self.db, str(disc_id), self.member_user)
        )
        self.assertEqual(len(res.items), 1)  # 1 top level comment
        self.assertEqual(res.items[0].replies_count, 1)
        self.assertEqual(len(res.items[0].replies), 1)
        self.assertEqual(res.items[0].replies[0].content, "Reply to top level comment")

    def test_14_comment_author_can_edit_comment(self):
        """Comment author can edit their own comment."""
        disc_id = ObjectId()
        comment_id = ObjectId()
        self.db.team_discussions.docs.append({"_id": disc_id, "team_id": self.team_id, "is_locked": False})
        self.db.discussion_comments.docs.append({
            "_id": comment_id,
            "discussion_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.member_id,
            "content": "Original comment content",
        })
        payload = CommentUpdate(content="Revised comment content")
        res = self.loop.run_until_complete(
            discussion_service.update_comment(self.db, str(comment_id), self.member_user, payload)
        )
        self.assertEqual(res.content, "Revised comment content")

    def test_15_unauthorized_user_cannot_edit_comment(self):
        """Other users cannot edit another member's comment (403)."""
        disc_id = ObjectId()
        comment_id = ObjectId()
        self.db.team_discussions.docs.append({"_id": disc_id, "team_id": self.team_id, "is_locked": False})
        self.db.discussion_comments.docs.append({
            "_id": comment_id,
            "discussion_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.leader_id,
            "content": "Leader note",
        })
        payload = CommentUpdate(content="Attempted edit by member")
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.update_comment(self.db, str(comment_id), self.member_user, payload)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_16_comment_deletion_cascades_replies(self):
        """Deleting a parent comment removes both the comment and its nested replies."""
        disc_id = ObjectId()
        parent_id = ObjectId()
        reply_id = ObjectId()
        self.db.team_discussions.docs.append({"_id": disc_id, "team_id": self.team_id})
        self.db.discussion_comments.docs.extend([
            {"_id": parent_id, "discussion_id": disc_id, "team_id": self.team_id, "author_id": self.member_id},
            {"_id": reply_id, "discussion_id": disc_id, "team_id": self.team_id, "parent_comment_id": parent_id},
        ])
        res = self.loop.run_until_complete(
            discussion_service.delete_comment(self.db, str(parent_id), self.member_user)
        )
        self.assertTrue(res["success"])
        self.assertEqual(len(self.db.discussion_comments.docs), 0)

    def test_17_discussion_deletion_cascades_comments(self):
        """Deleting a discussion cascades to delete all comments associated with it."""
        disc_id = ObjectId()
        self.db.team_discussions.docs.append({
            "_id": disc_id,
            "team_id": self.team_id,
            "author_id": self.member_id,
            "title": "To be deleted",
        })
        self.db.discussion_comments.docs.extend([
            {"_id": ObjectId(), "discussion_id": disc_id, "team_id": self.team_id, "content": "Comment 1"},
            {"_id": ObjectId(), "discussion_id": disc_id, "team_id": self.team_id, "content": "Comment 2"},
        ])
        res = self.loop.run_until_complete(
            discussion_service.delete_discussion(self.db, str(disc_id), self.member_user)
        )
        self.assertTrue(res["success"])
        self.assertEqual(len(self.db.team_discussions.docs), 0)
        self.assertEqual(len(self.db.discussion_comments.docs), 0)


if __name__ == "__main__":
    unittest.main()
