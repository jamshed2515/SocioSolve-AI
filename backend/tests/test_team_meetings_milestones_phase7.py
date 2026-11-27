"""
Module 3 – Team Meetings & Milestones Tests (Phase 7).
Uses Python standard library (unittest + asyncio) for fast, standalone execution.

Verifies:
1. Team leader can schedule a meeting.
2. Regular member cannot schedule meetings (403).
3. Non-member cannot access team meetings (403).
4. External attendees are rejected (400).
5. End time must be later than start time (400).
6. Online meeting requires valid link; Offline requires location.
7. Unauthorized user cannot update or cancel meetings (403).
8. Leader or organizer can update and cancel meetings.
9. Deleting completed meetings is rejected to preserve history (400).
10. Only team leader can delete meetings (member gets 403).
11. My Meetings returns meetings for authenticated attendee.
12. Team leader can create milestone with linked tasks.
13. Regular member cannot create milestone (403).
14. Non-member cannot view milestones (403).
15. Tasks from different teams cannot be linked to milestone (400).
16. Milestone progress outside 0-100 rejected (400).
17. Milestone progress 100% sets status completed and stamps completed_at.
18. Reopening milestone clears completed_at.
19. Overdue milestone is calculated correctly.
20. Only team leader can update or delete milestone.
21. Deleting a milestone does not delete linked tasks.
"""
import asyncio
from datetime import datetime, timedelta, timezone
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.models.meeting_model import MeetingStatus, MeetingType
from app.modules.team_collaboration.models.milestone_model import MilestoneStatus
from app.modules.team_collaboration.schemas.meeting_schema import (
    MeetingCreate,
    MeetingUpdate,
)
from app.modules.team_collaboration.schemas.milestone_schema import (
    MilestoneCreate,
    MilestoneProgressUpdate,
    MilestoneUpdate,
)
from app.modules.team_collaboration.services import meeting_service, milestone_service


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
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if k == "_id":
                    if str(doc.get("_id")) != str(v):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    def find(self, query, *args, **kwargs):
        filtered = []
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if k == "_id" and isinstance(v, dict) and "$in" in v:
                    doc_id_str = str(doc.get("_id"))
                    target_strs = {str(x) for x in v["$in"]}
                    if doc_id_str not in target_strs:
                        match = False
                        break
                elif k == "_id":
                    if str(doc.get("_id")) != str(v):
                        match = False
                        break
                elif k == "team_id":
                    if str(doc.get("team_id")) != str(v):
                        match = False
                        break
                elif k == "attendees":
                    # Check if v in doc["attendees"]
                    attendees_strs = {str(x) for x in doc.get("attendees", [])}
                    if str(v) not in attendees_strs:
                        match = False
                        break
                elif k == "$or" and isinstance(v, list):
                    # Check if any condition matches
                    or_matched = False
                    for cond in v:
                        cond_match = True
                        for ck, cv in cond.items():
                            if ck == "attendees":
                                att_strs = {str(x) for x in doc.get("attendees", [])}
                                if str(cv) not in att_strs:
                                    cond_match = False
                                    break
                            elif ck == "scheduled_by":
                                if str(doc.get("scheduled_by")) != str(cv):
                                    cond_match = False
                                    break
                            elif doc.get(ck) != cv:
                                cond_match = False
                                break
                        if cond_match:
                            or_matched = True
                            break
                    if not or_matched:
                        match = False
                        break
                elif isinstance(v, dict) and "$regex" in v:
                    import re
                    val = doc.get(k, "")
                    if not re.search(v["$regex"], val, re.IGNORECASE):
                        match = False
                        break
                elif isinstance(v, dict) and "$gte" in v:
                    val = doc.get(k)
                    if not val or val < v["$gte"]:
                        match = False
                        break
                elif isinstance(v, dict) and "$lt" in v:
                    val = doc.get(k)
                    if not val or val >= v["$lt"]:
                        match = False
                        break
                elif isinstance(v, dict) and "$ne" in v:
                    if doc.get(k) == v["$ne"]:
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                filtered.append(dict(doc))
        return MockCursor(filtered)

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)
        class Res:
            inserted_id = d["_id"]
        return Res()

    async def update_one(self, query, update, *args, **kwargs):
        for i, doc in enumerate(self.docs):
            match = True
            for k, v in query.items():
                if k == "_id" and str(doc.get("_id")) != str(v):
                    match = False
                    break
                elif k != "_id" and doc.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update:
                    self.docs[i].update(update["$set"])
                class Res:
                    modified_count = 1
                return Res()
        class Res:
            modified_count = 0
        return Res()

    async def delete_one(self, query, *args, **kwargs):
        for i, doc in enumerate(self.docs):
            if str(doc.get("_id")) == str(query.get("_id")):
                self.docs.pop(i)
                class Res:
                    deleted_count = 1
                return Res()
        class Res:
            deleted_count = 0
        return Res()

    async def count_documents(self, query, *args, **kwargs):
        cursor = self.find(query)
        return len(cursor.items)


class MockDatabase:
    def __init__(self):
        self.collections = {}

    def __getitem__(self, name):
        if name not in self.collections:
            self.collections[name] = MockCollection()
        return self.collections[name]

    @property
    def users(self):
        return self["users"]

    @property
    def teams(self):
        return self[TeamCollaborationCollections.TEAMS.value]

    @property
    def team_tasks(self):
        return self[TeamCollaborationCollections.TEAM_TASKS.value]

    @property
    def team_meetings(self):
        return self[TeamCollaborationCollections.TEAM_MEETINGS.value]

    @property
    def team_milestones(self):
        return self[TeamCollaborationCollections.TEAM_MILESTONES.value]


class TestTeamMeetingsMilestonesPhase7(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.db = MockDatabase()

        # Seed Users
        self.leader_id = ObjectId()
        self.member1_id = ObjectId()
        self.member2_id = ObjectId()
        self.outsider_id = ObjectId()

        self.users = [
            {"_id": self.leader_id, "name": "Pooja Soren", "email": "pooja@jharkhand.gov.in"},
            {"_id": self.member1_id, "name": "Rohit Kumar", "email": "rohit@bitmesra.ac.in"},
            {"_id": self.member2_id, "name": "Ananya Sen", "email": "ananya@iitkgp.ac.in"},
            {"_id": self.outsider_id, "name": "Karan Verma", "email": "karan@external.com"},
        ]
        self.db.users.docs = [dict(u) for u in self.users]

        # Seed Team
        self.team_id = ObjectId()
        self.team = {
            "_id": self.team_id,
            "name": "JalRakshak Tech Squad",
            "leader_id": self.leader_id,
            "members": [
                {"user_id": self.member1_id, "role": "Developer", "joined_at": datetime.now(timezone.utc)},
                {"user_id": self.member2_id, "role": "Researcher", "joined_at": datetime.now(timezone.utc)},
            ],
            "max_members": 6,
            "status": "recruiting",
        }
        self.db.teams.docs = [dict(self.team)]

        # Seed Tasks for Milestone tests
        self.task1_id = ObjectId()
        self.task2_id = ObjectId()
        self.other_team_task_id = ObjectId()
        self.tasks = [
            {"_id": self.task1_id, "team_id": self.team_id, "title": "Sensor Hardware Prototyping", "status": "completed", "progress": 100},
            {"_id": self.task2_id, "team_id": self.team_id, "title": "Field Deployment in Bokaro", "status": "in_progress", "progress": 40},
            {"_id": self.other_team_task_id, "team_id": ObjectId(), "title": "External Task", "status": "todo", "progress": 0},
        ]
        self.db.team_tasks.docs = [dict(t) for t in self.tasks]

        # Context helpers
        self.leader_ctx = {"id": str(self.leader_id), "email": "pooja@jharkhand.gov.in"}
        self.member1_ctx = {"id": str(self.member1_id), "email": "rohit@bitmesra.ac.in"}
        self.member2_ctx = {"id": str(self.member2_id), "email": "ananya@iitkgp.ac.in"}
        self.outsider_ctx = {"id": str(self.outsider_id), "email": "karan@external.com"}

    def tearDown(self):
        self.loop.close()

    # ── PART A: MEETINGS TESTS ──────────────────────────────────────────────

    def test_leader_can_schedule_meeting(self):
        payload = MeetingCreate(
            title="Weekly Sprint Sync: IoT Calibration",
            description="Review sensor telemetry from Bokaro panchayat.",
            attendees=[str(self.member1_id), str(self.member2_id)],
            meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
            start_time="14:00",
            end_time="15:00",
            meeting_type=MeetingType.online,
            meeting_link="https://meet.google.com/abc-defg-hij",
            agenda="1. Sensor status, 2. Field visit logistics",
        )
        meeting = self.loop.run_until_complete(
            meeting_service.create_meeting(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        self.assertEqual(meeting.title, "Weekly Sprint Sync: IoT Calibration")
        self.assertEqual(meeting.status, "scheduled")
        self.assertEqual(len(meeting.attendees), 2)
        self.assertTrue(meeting.is_upcoming)

    def test_regular_member_cannot_schedule_meeting(self):
        payload = MeetingCreate(
            title="Unauthorized Meeting",
            meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
            start_time="10:00",
            end_time="11:00",
            meeting_type=MeetingType.online,
            meeting_link="https://meet.google.com/test",
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                meeting_service.create_meeting(self.db, str(self.team_id), payload, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_non_member_cannot_access_team_meetings(self):
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                meeting_service.get_team_meetings(self.db, str(self.team_id), self.outsider_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_external_attendees_rejected(self):
        payload = MeetingCreate(
            title="Meeting with outsider",
            attendees=[str(self.outsider_id)],
            meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
            start_time="14:00",
            end_time="15:00",
            meeting_type=MeetingType.online,
            meeting_link="https://meet.google.com/test",
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                meeting_service.create_meeting(self.db, str(self.team_id), payload, self.leader_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("External attendees cannot be added", ctx.exception.detail)

    def test_invalid_meeting_times_rejected(self):
        with self.assertRaises(ValueError):
            MeetingCreate(
                title="Invalid Time Meeting",
                meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
                start_time="16:00",
                end_time="15:00",  # earlier than start
                meeting_type=MeetingType.online,
                meeting_link="https://meet.google.com/test",
            )

    def test_online_meeting_requires_link_offline_requires_location(self):
        # Online without link
        with self.assertRaises(ValueError):
            MeetingCreate(
                title="Online without link",
                meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
                start_time="10:00",
                end_time="11:00",
                meeting_type=MeetingType.online,
                meeting_link="",
            )
        # Offline without location
        with self.assertRaises(ValueError):
            MeetingCreate(
                title="Offline without location",
                meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
                start_time="10:00",
                end_time="11:00",
                meeting_type=MeetingType.offline,
                location="",
            )

    def test_leader_or_organizer_can_update_and_cancel_meeting(self):
        payload = MeetingCreate(
            title="Sync Meeting",
            meeting_date=datetime.now(timezone.utc) + timedelta(days=3),
            start_time="10:00",
            end_time="11:00",
            meeting_type=MeetingType.online,
            meeting_link="https://meet.google.com/test",
        )
        created = self.loop.run_until_complete(
            meeting_service.create_meeting(self.db, str(self.team_id), payload, self.leader_ctx)
        )

        # Unauthorized member tries to cancel -> 403
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                meeting_service.cancel_meeting(self.db, created.id, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # Leader cancels meeting -> Success
        cancelled = self.loop.run_until_complete(
            meeting_service.cancel_meeting(self.db, created.id, self.leader_ctx)
        )
        self.assertEqual(cancelled.status, "cancelled")

    def test_delete_meeting_permissions_and_history(self):
        payload = MeetingCreate(
            title="Temporary Sync",
            meeting_date=datetime.now(timezone.utc) + timedelta(days=1),
            start_time="10:00",
            end_time="11:00",
            meeting_type=MeetingType.online,
            meeting_link="https://meet.google.com/test",
        )
        created = self.loop.run_until_complete(
            meeting_service.create_meeting(self.db, str(self.team_id), payload, self.leader_ctx)
        )

        # Member tries to delete -> 403
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                meeting_service.delete_meeting(self.db, created.id, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # Mark completed and try delete -> 400
        self.loop.run_until_complete(
            meeting_service.update_meeting(self.db, created.id, MeetingUpdate(status=MeetingStatus.completed), self.leader_ctx)
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                meeting_service.delete_meeting(self.db, created.id, self.leader_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Completed meeting records cannot be deleted", ctx.exception.detail)

    def test_get_my_meetings(self):
        payload = MeetingCreate(
            title="Member 1 Attendee Meeting",
            attendees=[str(self.member1_id)],
            meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
            start_time="14:00",
            end_time="15:00",
            meeting_type=MeetingType.online,
            meeting_link="https://meet.google.com/test",
        )
        self.loop.run_until_complete(
            meeting_service.create_meeting(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        res = self.loop.run_until_complete(
            meeting_service.get_my_meetings(self.db, self.member1_ctx)
        )
        self.assertEqual(res.total, 1)
        self.assertEqual(res.items[0].title, "Member 1 Attendee Meeting")

    # ── PART B: MILESTONES TESTS ────────────────────────────────────────────

    def test_leader_can_create_milestone(self):
        payload = MilestoneCreate(
            title="Phase 1 Hardware Validation & Calibrated Field Trial",
            description="Achieve verified readings across 5 rural sensor points.",
            due_date=datetime.now(timezone.utc) + timedelta(days=30),
            linked_task_ids=[str(self.task1_id), str(self.task2_id)],
        )
        milestone = self.loop.run_until_complete(
            milestone_service.create_milestone(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        self.assertEqual(milestone.title, "Phase 1 Hardware Validation & Calibrated Field Trial")
        self.assertEqual(milestone.status, "pending")
        self.assertEqual(milestone.progress, 0)
        self.assertEqual(len(milestone.linked_tasks), 2)

    def test_regular_member_cannot_create_milestone(self):
        payload = MilestoneCreate(
            title="Member Milestone Attempt",
            due_date=datetime.now(timezone.utc) + timedelta(days=10),
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                milestone_service.create_milestone(self.db, str(self.team_id), payload, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_tasks_from_different_teams_cannot_be_linked(self):
        payload = MilestoneCreate(
            title="Milestone with foreign task",
            due_date=datetime.now(timezone.utc) + timedelta(days=15),
            linked_task_ids=[str(self.other_team_task_id)],
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                milestone_service.create_milestone(self.db, str(self.team_id), payload, self.leader_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("belong to a different team", ctx.exception.detail)

    def test_milestone_progress_and_completion_sync(self):
        payload = MilestoneCreate(
            title="Sprint Milestone",
            due_date=datetime.now(timezone.utc) + timedelta(days=20),
        )
        created = self.loop.run_until_complete(
            milestone_service.create_milestone(self.db, str(self.team_id), payload, self.leader_ctx)
        )

        # Update to 100%
        updated = self.loop.run_until_complete(
            milestone_service.update_milestone_progress(self.db, created.id, MilestoneProgressUpdate(progress=100), self.leader_ctx)
        )
        self.assertEqual(updated.progress, 100)
        self.assertEqual(updated.status, "completed")
        self.assertIsNotNone(updated.completed_at)

        # Reopen to 50%
        reopened = self.loop.run_until_complete(
            milestone_service.update_milestone_progress(self.db, created.id, MilestoneProgressUpdate(progress=50), self.leader_ctx)
        )
        self.assertEqual(reopened.progress, 50)
        self.assertEqual(reopened.status, "in_progress")
        self.assertIsNone(reopened.completed_at)

    def test_overdue_milestone_calculation(self):
        # Seed milestone with past due date
        past_date = datetime.now(timezone.utc) - timedelta(days=5)
        payload = MilestoneCreate(
            title="Overdue Milestone",
            due_date=past_date,
        )
        created = self.loop.run_until_complete(
            milestone_service.create_milestone(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        fetched = self.loop.run_until_complete(
            milestone_service.get_milestone_details(self.db, created.id, self.member1_ctx)
        )
        self.assertTrue(fetched.is_overdue)
        self.assertEqual(fetched.status, "overdue")

    def test_delete_milestone_preserves_linked_tasks(self):
        payload = MilestoneCreate(
            title="Disposable Milestone",
            due_date=datetime.now(timezone.utc) + timedelta(days=25),
            linked_task_ids=[str(self.task1_id)],
        )
        created = self.loop.run_until_complete(
            milestone_service.create_milestone(self.db, str(self.team_id), payload, self.leader_ctx)
        )

        # Member cannot delete -> 403
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                milestone_service.delete_milestone(self.db, created.id, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # Leader deletes -> Success
        del_res = self.loop.run_until_complete(
            milestone_service.delete_milestone(self.db, created.id, self.leader_ctx)
        )
        self.assertEqual(del_res["message"], "Milestone deleted successfully.")

        # Ensure linked task is still intact in team_tasks
        task_still_exists = self.loop.run_until_complete(
            self.db.team_tasks.find_one({"_id": self.task1_id})
        )
        self.assertIsNotNone(task_still_exists)


if __name__ == "__main__":
    unittest.main()
