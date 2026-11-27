"""
Module 3 – Team Task Management Tests (Phase 6).
Uses Python standard library (unittest + asyncio) for fast, standalone execution.

Verifies all required Phase 6 backend scenarios:
1. Team leader can create a task.
2. Regular member cannot create a task (403).
3. Task cannot be created for a nonexistent team (404).
4. External users cannot be assigned (400).
5. Duplicate assignees are deduplicated correctly.
6. Team member can view team tasks.
7. Non-member cannot view team tasks (403).
8. User can view their assigned tasks across teams.
9. Unauthorized user cannot update task details (403).
10. Assigned member can update status.
11. Team leader can update status.
12. Unassigned regular member cannot update status (403).
13. Assigned member can update progress.
14. Progress outside 0–100 is rejected (400).
15. Setting progress to 100 sets status to completed and records completed_at.
16. Setting status to completed sets progress to 100 and records completed_at.
17. Reopening a task clears completed_at and updates progress.
18. Invalid due dates (due < start) are rejected (400).
19. Only team leader can reassign tasks (member gets 403).
20. Only authorized users (leader or creator) can delete tasks.
21. Task search and filters work correctly.
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
from app.modules.team_collaboration.models.task_model import TaskPriority, TaskStatus
from app.modules.team_collaboration.schemas.task_schema import (
    TaskAssignUpdate,
    TaskCreate,
    TaskProgressUpdate,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.modules.team_collaboration.services import task_service


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
                elif k == "assigned_to":
                    # Check if v in doc["assigned_to"]
                    assigned_strs = {str(x) for x in doc.get("assigned_to", [])}
                    if str(v) not in assigned_strs:
                        match = False
                        break
                elif isinstance(v, dict) and "$regex" in v:
                    import re
                    val = doc.get(k, "")
                    if not re.search(v["$regex"], val, re.IGNORECASE):
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


class TestTeamTasksPhase6(unittest.TestCase):
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

        # Context helpers
        self.leader_ctx = {"id": str(self.leader_id), "email": "pooja@jharkhand.gov.in"}
        self.member1_ctx = {"id": str(self.member1_id), "email": "rohit@bitmesra.ac.in"}
        self.member2_ctx = {"id": str(self.member2_id), "email": "ananya@iitkgp.ac.in"}
        self.outsider_ctx = {"id": str(self.outsider_id), "email": "karan@external.com"}

    def tearDown(self):
        self.loop.close()

    # 1. Leader can create task
    def test_leader_can_create_task(self):
        payload = TaskCreate(
            title="Deploy Water Quality Sensor in Bokaro",
            description="Install solar-powered turbidity probes.",
            assigned_to=[str(self.member1_id)],
            priority=TaskPriority.high,
            start_date=datetime.now(timezone.utc),
            due_date=datetime.now(timezone.utc) + timedelta(days=7),
        )
        task = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        self.assertEqual(task.title, "Deploy Water Quality Sensor in Bokaro")
        self.assertEqual(task.status, "todo")
        self.assertEqual(task.progress, 0)
        self.assertEqual(len(task.assigned_to), 1)
        self.assertEqual(task.assigned_to[0], str(self.member1_id))
        self.assertEqual(task.priority, "high")

    # 2. Regular member cannot create task (403)
    def test_regular_member_cannot_create_task(self):
        payload = TaskCreate(
            title="Unauthorized Task Attempt",
            description="Regular member trying to create a task.",
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.create_task(self.db, str(self.team_id), payload, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    # 3. Nonexistent team (404)
    def test_nonexistent_team_task_creation(self):
        fake_id = str(ObjectId())
        payload = TaskCreate(title="Fake Task")
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.create_task(self.db, fake_id, payload, self.leader_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 404)

    # 4. External users cannot be assigned (400)
    def test_external_user_cannot_be_assigned(self):
        payload = TaskCreate(
            title="Task with outsider",
            assigned_to=[str(self.outsider_id)],
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("External users cannot be assigned", ctx.exception.detail)

    # 5. Duplicate assignees are deduplicated correctly
    def test_duplicate_assignees_deduplicated(self):
        payload = TaskCreate(
            title="Deduplication Task",
            assigned_to=[str(self.member1_id), str(self.member1_id), str(self.member2_id)],
        )
        task = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        self.assertEqual(len(task.assigned_to), 2)
        self.assertEqual(set(task.assigned_to), {str(self.member1_id), str(self.member2_id)})

    # 6. Team member can view team tasks
    def test_team_member_can_view_tasks(self):
        payload = TaskCreate(title="Task for All Members")
        self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        res = self.loop.run_until_complete(
            task_service.get_team_tasks(self.db, str(self.team_id), self.member2_ctx)
        )
        self.assertEqual(res.total, 1)
        self.assertEqual(res.items[0].title, "Task for All Members")

    # 7. Non-member cannot view team tasks (403)
    def test_non_member_cannot_view_tasks(self):
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.get_team_tasks(self.db, str(self.team_id), self.outsider_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    # 8. User can view their assigned tasks across teams
    def test_get_my_assigned_tasks(self):
        payload1 = TaskCreate(title="Task Assigned to Member 1", assigned_to=[str(self.member1_id)])
        payload2 = TaskCreate(title="Task Not Assigned to Member 1", assigned_to=[str(self.member2_id)])
        self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload1, self.leader_ctx)
        )
        self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload2, self.leader_ctx)
        )
        my_tasks = self.loop.run_until_complete(
            task_service.get_my_assigned_tasks(self.db, self.member1_ctx)
        )
        self.assertEqual(my_tasks.total, 1)
        self.assertEqual(my_tasks.items[0].title, "Task Assigned to Member 1")

    # 9. Unauthorized users cannot update task details (403)
    def test_unauthorized_user_cannot_update_task(self):
        payload = TaskCreate(title="Original Task")
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        update_payload = TaskUpdate(title="Hacked Task Title")
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.update_task(self.db, created.id, update_payload, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    # 10. Assigned member can update status
    def test_assigned_member_can_update_status(self):
        payload = TaskCreate(title="Sprint Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        status_payload = TaskStatusUpdate(status=TaskStatus.in_progress)
        updated = self.loop.run_until_complete(
            task_service.update_task_status(self.db, created.id, status_payload, self.member1_ctx)
        )
        self.assertEqual(updated.status, "in_progress")
        self.assertGreater(updated.progress, 0)

    # 11. Team leader can update status
    def test_team_leader_can_update_status(self):
        payload = TaskCreate(title="Leader Review Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        status_payload = TaskStatusUpdate(status=TaskStatus.review)
        updated = self.loop.run_until_complete(
            task_service.update_task_status(self.db, created.id, status_payload, self.leader_ctx)
        )
        self.assertEqual(updated.status, "review")

    # 12. Unassigned regular member cannot update status (403)
    def test_unassigned_member_cannot_update_status(self):
        payload = TaskCreate(title="Private Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        status_payload = TaskStatusUpdate(status=TaskStatus.completed)
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.update_task_status(self.db, created.id, status_payload, self.member2_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

    # 13. Assigned member can update progress
    def test_assigned_member_can_update_progress(self):
        payload = TaskCreate(title="Progress Tracking Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        prog_payload = TaskProgressUpdate(progress=65)
        updated = self.loop.run_until_complete(
            task_service.update_task_progress(self.db, created.id, prog_payload, self.member1_ctx)
        )
        self.assertEqual(updated.progress, 65)
        self.assertEqual(updated.status, "in_progress")

    # 14. Progress outside 0-100 rejected (400 / validation)
    def test_invalid_progress_rejected(self):
        with self.assertRaises(ValidationError):
            TaskProgressUpdate(progress=150)
        with self.assertRaises(ValidationError):
            TaskProgressUpdate(progress=-10)

    # 15. Progress 100% sets status completed and completed_at
    def test_progress_100_completes_task(self):
        payload = TaskCreate(title="Final Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        prog_payload = TaskProgressUpdate(progress=100)
        updated = self.loop.run_until_complete(
            task_service.update_task_progress(self.db, created.id, prog_payload, self.member1_ctx)
        )
        self.assertEqual(updated.status, "completed")
        self.assertEqual(updated.progress, 100)
        self.assertIsNotNone(updated.completed_at)

    # 16. Setting status to completed sets progress 100 and completed_at
    def test_status_completed_sets_progress_100(self):
        payload = TaskCreate(title="Done Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        status_payload = TaskStatusUpdate(status=TaskStatus.completed)
        updated = self.loop.run_until_complete(
            task_service.update_task_status(self.db, created.id, status_payload, self.member1_ctx)
        )
        self.assertEqual(updated.progress, 100)
        self.assertEqual(updated.status, "completed")
        self.assertIsNotNone(updated.completed_at)

    # 17. Reopening completed task clears completed_at and updates progress
    def test_reopening_task_clears_completed_at(self):
        payload = TaskCreate(title="Cycle Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        # Complete it
        self.loop.run_until_complete(
            task_service.update_task_status(self.db, created.id, TaskStatusUpdate(status=TaskStatus.completed), self.member1_ctx)
        )
        # Reopen to todo
        reopened = self.loop.run_until_complete(
            task_service.update_task_status(self.db, created.id, TaskStatusUpdate(status=TaskStatus.todo), self.member1_ctx)
        )
        self.assertEqual(reopened.status, "todo")
        self.assertEqual(reopened.progress, 0)
        self.assertIsNone(reopened.completed_at)

    # 18. Invalid due date rejected (start > due)
    def test_invalid_due_date_rejected(self):
        with self.assertRaises(ValueError):
            TaskCreate(
                title="Bad Date Task",
                start_date=datetime.now(timezone.utc) + timedelta(days=5),
                due_date=datetime.now(timezone.utc),
            )

    # 19. Only leader can reassign tasks
    def test_only_leader_can_reassign_tasks(self):
        payload = TaskCreate(title="Reassign Target Task", assigned_to=[str(self.member1_id)])
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        reassign_payload = TaskAssignUpdate(assigned_to=[str(self.member2_id)])
        # Member attempt -> 403
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.reassign_task(self.db, created.id, reassign_payload, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # Leader attempt -> 200
        reassigned = self.loop.run_until_complete(
            task_service.reassign_task(self.db, created.id, reassign_payload, self.leader_ctx)
        )
        self.assertEqual(reassigned.assigned_to, [str(self.member2_id)])

    # 20. Only authorized users can delete task
    def test_delete_task_permissions(self):
        payload = TaskCreate(title="Task to Delete")
        created = self.loop.run_until_complete(
            task_service.create_task(self.db, str(self.team_id), payload, self.leader_ctx)
        )
        # Non-creator member attempt -> 403
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                task_service.delete_task(self.db, created.id, self.member1_ctx)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # Leader attempt -> Success
        res = self.loop.run_until_complete(
            task_service.delete_task(self.db, created.id, self.leader_ctx)
        )
        self.assertEqual(res["message"], "Task deleted successfully.")

    # 21. Search and filters work
    def test_search_and_filters(self):
        p1 = TaskCreate(title="Soil Quality IoT Node", priority=TaskPriority.urgent)
        p2 = TaskCreate(title="Solar Cold Storage Firmware", priority=TaskPriority.low)
        self.loop.run_until_complete(task_service.create_task(self.db, str(self.team_id), p1, self.leader_ctx))
        self.loop.run_until_complete(task_service.create_task(self.db, str(self.team_id), p2, self.leader_ctx))

        # Search for "Solar"
        res_search = self.loop.run_until_complete(
            task_service.get_team_tasks(self.db, str(self.team_id), self.leader_ctx, search="Solar")
        )
        self.assertEqual(res_search.total, 1)
        self.assertEqual(res_search.items[0].title, "Solar Cold Storage Firmware")

        # Filter by priority urgent
        res_prio = self.loop.run_until_complete(
            task_service.get_team_tasks(self.db, str(self.team_id), self.leader_ctx, priority_filter="urgent")
        )
        self.assertEqual(res_prio.total, 1)
        self.assertEqual(res_prio.items[0].title, "Soil Quality IoT Node")


if __name__ == "__main__":
    unittest.main()
