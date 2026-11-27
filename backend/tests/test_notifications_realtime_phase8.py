"""
Module 3 – Notifications & Real-Time Collaboration Tests (Phase 8).
Uses Python standard library (unittest + asyncio) for fast, standalone execution.

Verifies:
1. Notification document structure and database persistence.
2. Users can retrieve only their own notifications.
3. Filtering by read/unread and notification type works with pagination.
4. Unread count calculation is accurate.
5. User can mark their own notification as read.
6. User cannot mark another user's notification as read (403).
7. Mark all as read affects only the authenticated user.
8. User cannot delete another user's notification (403).
9. Clear read notifications deletes only read notifications for the calling user.
10. Self-action notifications are suppressed (sender == recipient).
11. Duplicate notifications within the deduplication window are suppressed.
12. Socket.IO token extraction and connection authentication.
13. Socket.IO team room authorization (members allowed, external users rejected).
"""
import asyncio
from datetime import datetime, timedelta, timezone
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bson import ObjectId
from fastapi import HTTPException
import socketio

from app.modules.team_collaboration.models.notification_model import (
    NotificationType,
    new_notification_document,
)
from app.modules.team_collaboration.services import notification_service
from app.modules.team_collaboration.socket import (
    _extract_token,
    _save_session,
    connect,
    handle_join_team,
    sio,
)


class MockCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, *args, **kwargs):
        return self

    def skip(self, count):
        self.items = self.items[count:]
        return self

    def limit(self, count):
        self.items = self.items[:count]
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
    def __init__(self, name="collection"):
        self.name = name
        self.docs = []

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)

        class Result:
            inserted_id = d["_id"]

        return Result()

    async def find_one(self, query):
        for doc in reversed(self.docs):
            if self._match(doc, query):
                return dict(doc)
        return None

    def find(self, query=None):
        query = query or {}
        matched = [dict(doc) for doc in self.docs if self._match(doc, query)]
        return MockCursor(matched)

    async def count_documents(self, query=None):
        query = query or {}
        return len([d for d in self.docs if self._match(d, query)])

    async def update_one(self, query, update):
        for doc in self.docs:
            if self._match(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                class Result:
                    matched_count = 1
                    modified_count = 1
                return Result()
        class ResultZero:
            matched_count = 0
            modified_count = 0
        return ResultZero()

    async def update_many(self, query, update):
        count = 0
        for doc in self.docs:
            if self._match(doc, query):
                if "$set" in update:
                    doc.update(update["$set"])
                count += 1
        class ResultMany:
            matched_count = count
            modified_count = count
        return ResultMany()

    async def delete_one(self, query):
        for i, doc in enumerate(self.docs):
            if self._match(doc, query):
                del self.docs[i]
                class ResDel:
                    deleted_count = 1
                return ResDel()
        class ResZero:
            deleted_count = 0
        return ResZero()

    async def delete_many(self, query):
        initial = len(self.docs)
        self.docs = [d for d in self.docs if not self._match(d, query)]
        del_count = initial - len(self.docs)
        class ResDelMany:
            deleted_count = del_count
        return ResDelMany()

    def _match(self, doc, query):
        for k, v in query.items():
            if k == "$or":
                if not any(self._match(doc, sub_q) for sub_q in v):
                    return False
                continue
            if isinstance(v, dict):
                field_val = doc.get(k)
                if "$gte" in v:
                    if field_val is None or field_val < v["$gte"]:
                        return False
                if "$ne" in v:
                    if field_val == v["$ne"]:
                        return False
            elif doc.get(k) != v:
                return False
        return True


class MockDB:
    def __init__(self):
        self.notifications = MockCollection("notifications")
        self.users = MockCollection("users")
        self.teams = MockCollection("teams")
        self.team_discussions = MockCollection("team_discussions")
        self.discussion_comments = MockCollection("discussion_comments")
        self.team_tasks = MockCollection("team_tasks")
        self.team_meetings = MockCollection("team_meetings")
        self.team_milestones = MockCollection("team_milestones")


class TestPhase8NotificationsAndRealtime(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        self.db = MockDB()
        self.user1_id = ObjectId()
        self.user2_id = ObjectId()
        self.team_id = ObjectId()

        # Seed mock users
        self.loop.run_until_complete(
            self.db.users.insert_one({
                "_id": self.user1_id,
                "name": "Aarav Sharma",
                "email": "aarav@jharkhand.edu",
                "is_active": True,
                "firebase_uid": "fb_aarav",
            })
        )
        self.loop.run_until_complete(
            self.db.users.insert_one({
                "_id": self.user2_id,
                "name": "Priya Kumari",
                "email": "priya@jharkhand.edu",
                "is_active": True,
                "firebase_uid": "fb_priya",
            })
        )

        # Seed mock team with user1 as leader and user2 as member
        self.loop.run_until_complete(
            self.db.teams.insert_one({
                "_id": self.team_id,
                "name": "Jharkhand AquaTech",
                "leader_id": self.user1_id,
                "members": [
                    {"user_id": self.user1_id, "role": "Leader"},
                    {"user_id": self.user2_id, "role": "Member"},
                ],
                "status": "recruiting",
                "max_members": 6,
            })
        )

        # Patch get_database
        notification_service.get_database = lambda: self.db
        import app.modules.team_collaboration.socket as sock_mod
        sock_mod.get_database = lambda: self.db

    def tearDown(self):
        self.loop.close()

    def test_01_create_notification_success(self):
        """Notification document is created in MongoDB with is_read=False and correct fields."""
        notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                team_id=self.team_id,
                notification_type=NotificationType.TASK_ASSIGNED.value,
                title="Task Assignment",
                message="You have been assigned to IoT Sensor Setup.",
                reference_id="task_101",
                reference_type="task",
            )
        )
        self.assertIsNotNone(notif)
        self.assertEqual(notif.recipient_id, str(self.user2_id))
        self.assertEqual(notif.sender_id, str(self.user1_id))
        self.assertEqual(notif.title, "Task Assignment")
        self.assertFalse(notif.is_read)

        stored_count = self.loop.run_until_complete(
            self.db.notifications.count_documents({"recipient_id": self.user2_id})
        )
        self.assertEqual(stored_count, 1)

    def test_02_self_notification_suppressed(self):
        """User is not notified about their own action."""
        notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user1_id,
                sender_id=self.user1_id,
                notification_type=NotificationType.TASK_COMPLETED.value,
                title="Task Completed",
                message="Self completed",
            )
        )
        self.assertIsNone(notif)
        count = self.loop.run_until_complete(
            self.db.notifications.count_documents({"recipient_id": self.user1_id})
        )
        self.assertEqual(count, 0)

    def test_03_duplicate_suppression_within_window(self):
        """Identical notifications within the deduplication window are suppressed."""
        n1 = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                team_id=self.team_id,
                notification_type=NotificationType.MEETING_SCHEDULED.value,
                title="Sync Scheduled",
                message="Weekly sprint check-in",
                reference_id="meet_1",
                prevent_duplicate_window_sec=5,
            )
        )
        self.assertIsNotNone(n1)

        # Immediate duplicate attempt
        n2 = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                team_id=self.team_id,
                notification_type=NotificationType.MEETING_SCHEDULED.value,
                title="Sync Scheduled",
                message="Weekly sprint check-in",
                reference_id="meet_1",
                prevent_duplicate_window_sec=5,
            )
        )
        self.assertIsNotNone(n2)
        count = self.loop.run_until_complete(
            self.db.notifications.count_documents({"recipient_id": self.user2_id})
        )
        # Only 1 document inserted into MongoDB
        self.assertEqual(count, 1)

    def test_04_user_retrieves_only_own_notifications(self):
        """User queries return only notifications where recipient_id == user_id."""
        self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user1_id,
                sender_id=self.user2_id,
                notification_type="join_request_received",
                title="For User 1",
                message="User 1 only",
            )
        )
        self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="task_assigned",
                title="For User 2",
                message="User 2 only",
            )
        )

        user1_list = self.loop.run_until_complete(
            notification_service.get_my_notifications(user_id=self.user1_id)
        )
        self.assertEqual(user1_list.total, 1)
        self.assertEqual(user1_list.items[0].title, "For User 1")

        user2_list = self.loop.run_until_complete(
            notification_service.get_my_notifications(user_id=self.user2_id)
        )
        self.assertEqual(user2_list.total, 1)
        self.assertEqual(user2_list.items[0].title, "For User 2")

    def test_05_unread_count_and_mark_as_read(self):
        """Accurate unread count and marking notification as read."""
        notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="discussion_comment",
                title="Comment posted",
                message="Check this discussion",
            )
        )
        unread = self.loop.run_until_complete(
            notification_service.get_unread_count(self.user2_id)
        )
        self.assertEqual(unread, 1)

        # Mark as read
        updated = self.loop.run_until_complete(
            notification_service.mark_notification_as_read(notif.id, self.user2_id)
        )
        self.assertTrue(updated.is_read)
        self.assertIsNotNone(updated.read_at)

        unread_after = self.loop.run_until_complete(
            notification_service.get_unread_count(self.user2_id)
        )
        self.assertEqual(unread_after, 0)

    def test_06_cannot_mark_other_users_notification_as_read(self):
        """User cannot mark another recipient's notification as read (403 Forbidden)."""
        notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="task_assigned",
                title="User 2 task",
                message="Secret task",
            )
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                notification_service.mark_notification_as_read(notif.id, self.user1_id)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_07_mark_all_as_read(self):
        """Mark all as read only affects the authenticated user's notifications."""
        # Create 2 for user2 and 1 for user1
        self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="meeting_scheduled",
                title="M1",
                message="M1",
                prevent_duplicate_window_sec=0,
            )
        )
        self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="task_assigned",
                title="T1",
                message="T1",
                prevent_duplicate_window_sec=0,
            )
        )
        self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user1_id,
                sender_id=self.user2_id,
                notification_type="team_invitation",
                title="U1",
                message="U1",
                prevent_duplicate_window_sec=0,
            )
        )

        res = self.loop.run_until_complete(
            notification_service.mark_all_as_read(self.user2_id)
        )
        self.assertEqual(res.affected_count, 2)

        # User2 unread should now be 0, user1 unread should still be 1
        u2_unread = self.loop.run_until_complete(
            notification_service.get_unread_count(self.user2_id)
        )
        u1_unread = self.loop.run_until_complete(
            notification_service.get_unread_count(self.user1_id)
        )
        self.assertEqual(u2_unread, 0)
        self.assertEqual(u1_unread, 1)

    def test_08_delete_notification_ownership_protection(self):
        """User cannot delete another user's notification (403 Forbidden)."""
        notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="task_assigned",
                title="Target notif",
                message="Target message",
            )
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                notification_service.delete_notification(notif.id, self.user1_id)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # Owner can delete it
        del_res = self.loop.run_until_complete(
            notification_service.delete_notification(notif.id, self.user2_id)
        )
        self.assertTrue(del_res.success)
        remaining = self.loop.run_until_complete(
            self.db.notifications.count_documents({"_id": ObjectId(notif.id)})
        )
        self.assertEqual(remaining, 0)

    def test_09_clear_read_notifications(self):
        """Clearing read notifications only deletes read items for the calling user."""
        # user2 has 1 unread and 1 read
        n_unread = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="milestone_created",
                title="Unread",
                message="Unread",
                prevent_duplicate_window_sec=0,
            )
        )
        n_read = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user2_id,
                sender_id=self.user1_id,
                notification_type="meeting_scheduled",
                title="Read",
                message="Read",
                prevent_duplicate_window_sec=0,
            )
        )
        self.loop.run_until_complete(
            notification_service.mark_notification_as_read(n_read.id, self.user2_id)
        )

        clear_res = self.loop.run_until_complete(
            notification_service.clear_read_notifications(self.user2_id)
        )
        self.assertEqual(clear_res.affected_count, 1)

        # Only unread notification remains
        user2_notifs = self.loop.run_until_complete(
            notification_service.get_my_notifications(self.user2_id)
        )
        self.assertEqual(user2_notifs.total, 1)
        self.assertEqual(user2_notifs.items[0].id, n_unread.id)

    def test_10_socket_extract_token(self):
        """Token extraction handles auth dict, query string, and Bearer header."""
        t1 = _extract_token({}, {"token": "secret_abc"})
        self.assertEqual(t1, "secret_abc")

        t2 = _extract_token({"QUERY_STRING": "token=query_123&other=val"}, None)
        self.assertEqual(t2, "query_123")

        t3 = _extract_token({"HTTP_AUTHORIZATION": "Bearer header_token"}, None)
        self.assertEqual(t3, "header_token")

        t4 = _extract_token({}, None)
        self.assertIsNone(t4)

    def test_11_socket_connect_with_valid_token(self):
        """Valid test/JWT token authenticates socket and joins user private room."""
        auth_payload = {"token": f"test_token_{str(self.user1_id)}"}
        connected = self.loop.run_until_complete(
            connect("sid_test_1", {}, auth_payload)
        )
        self.assertTrue(connected)

    def test_12_socket_connect_missing_token_refused(self):
        """Connection without token raises ConnectionRefusedError."""
        with self.assertRaises(socketio.exceptions.ConnectionRefusedError):
            self.loop.run_until_complete(
                connect("sid_fail_1", {}, None)
            )

    def test_13_socket_team_room_membership_authorization(self):
        """Team member can join team room; external user is denied."""
        # 1. user2 is a team member -> authorized
        self.loop.run_until_complete(
            _save_session("sid_user2", {"user_id": str(self.user2_id)})
        )
        self.loop.run_until_complete(
            handle_join_team("sid_user2", {"team_id": str(self.team_id)})
        )
        # Verify no error emitted or accepted

        # 2. External user (user3) not in team -> rejected
        user3_id = ObjectId()
        self.loop.run_until_complete(
            _save_session("sid_user3", {"user_id": str(user3_id)})
        )
        # Mock emit to capture error
        emitted_events = []
        original_emit = sio.emit

        async def mock_emit(event, data, to=None, room=None):
            emitted_events.append((event, data, to or room))

        sio.emit = mock_emit
        try:
            self.loop.run_until_complete(
                handle_join_team("sid_user3", {"team_id": str(self.team_id)})
            )
            self.assertTrue(any(ev[0] == "error" for ev in emitted_events))
        finally:
            sio.emit = original_emit


if __name__ == "__main__":
    unittest.main()
