"""
Module 3 – Join Requests Tests (Phase 3).
Uses Python standard library (unittest + asyncio) so it executes standalone.

Verifies all required Phase 3 backend test scenarios:
1. Successful join request.
2. Invalid team ID format.
3. Team does not exist (404).
4. Team is full (400).
5. Team is not recruiting (400).
6. User is already a member (400).
7. Leader cannot request to join their own team (400).
8. Duplicate pending request prevention (400).
9. Reapplication after rejection.
10. Reapplication after cancellation.
11. Non-leader cannot view team requests (403).
12. Non-leader cannot accept or reject (403).
13. Requester can cancel their own pending request.
14. Other users cannot cancel the request (403).
15. Successful acceptance adds the member exactly once.
16. Rejected requests do not change membership.
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

from app.modules.team_collaboration.models.join_request_model import JoinRequestStatus
from app.modules.team_collaboration.models.team_model import TeamStatus
from app.modules.team_collaboration.schemas.join_request_schema import (
    CreateJoinRequest,
    JoinRequestDecision,
)
from app.modules.team_collaboration.services import join_request_service


class MockCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, *args, **kwargs):
        return self

    def skip(self, n):
        self.items = self.items[n:]
        return self

    def limit(self, n):
        self.items = self.items[:n]
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
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc):
        new_doc = dict(doc)
        if "_id" not in new_doc:
            new_doc["_id"] = ObjectId()
        self.docs.append(new_doc)

        class Result:
            inserted_id = new_doc["_id"]

        return Result()

    async def find_one(self, query, sort=None):
        for d in self.docs:
            match = True
            for k, v in query.items():
                if k == "$or":
                    or_match = False
                    for sub in v:
                        if all(d.get(sk) == sv for sk, sv in sub.items()):
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif d.get(k) != v:
                    match = False
                    break
            if match:
                return dict(d)
        return None

    def find(self, query):
        results = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                results.append(dict(d))
        return MockCursor(results)

    async def count_documents(self, query):
        count = 0
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count

    async def update_one(self, filter_query, update_doc):
        class UpdateRes:
            matched_count = 0
            modified_count = 0

        res = UpdateRes()
        for d in self.docs:
            match = True
            for k, v in filter_query.items():
                if k == "$expr":
                    continue
                if k == "members.user_id" and isinstance(v, dict) and "$ne" in v:
                    if any(m.get("user_id") == v["$ne"] for m in d.get("members", [])):
                        match = False
                        break
                elif d.get(k) != v:
                    match = False
                    break

            if match:
                res.matched_count = 1
                res.modified_count = 1
                if "$set" in update_doc:
                    d.update(update_doc["$set"])
                if "$push" in update_doc:
                    for pk, pv in update_doc["$push"].items():
                        if pk not in d:
                            d[pk] = []
                        d[pk].append(pv)
                break
        return res

    async def delete_one(self, filter_query):
        for i, d in enumerate(self.docs):
            if all(d.get(k) == v for k, v in filter_query.items()):
                self.docs.pop(i)
                return True
        return False


class MockDB:
    def __init__(self):
        self.teams = MockCollection()
        self.users = MockCollection()
        self.challenges = MockCollection()
        self.join_requests = MockCollection()


class TestJoinRequestsPhase3(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.db = MockDB()

        # Seed leader and team
        self.leader_id = ObjectId()
        self.applicant_id = ObjectId()
        self.other_user_id = ObjectId()
        self.challenge_id = ObjectId()

        self.db.users.docs.append({
            "_id": self.leader_id,
            "name": "Leader Ramesh",
            "email": "ramesh@jharkhand.edu",
            "role": "student",
            "skills": ["Leadership", "Python"],
        })
        self.db.users.docs.append({
            "_id": self.applicant_id,
            "name": "Applicant Priya",
            "email": "priya@jharkhand.edu",
            "role": "student",
            "skills": ["React", "UI/UX"],
        })
        self.db.users.docs.append({
            "_id": self.other_user_id,
            "name": "Other Student",
            "email": "other@jharkhand.edu",
            "role": "student",
            "skills": ["Data Analysis"],
        })
        self.db.challenges.docs.append({
            "_id": self.challenge_id,
            "title": "Groundwater Monitoring in Dhanbad",
            "category": "Water",
        })

        self.team_doc = {
            "_id": ObjectId(),
            "name": "AquaJharkhand Innovators",
            "description": "Building IoT water sensors for rural drinking water.",
            "challenge_id": self.challenge_id,
            "leader_id": self.leader_id,
            "members": [
                {"user_id": self.leader_id, "role": "Team Leader", "joined_at": datetime.now(timezone.utc)}
            ],
            "max_members": 3,
            "status": TeamStatus.RECRUITING.value,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        self.db.teams.docs.append(self.team_doc)

    def tearDown(self):
        self.loop.close()

    def test_01_submit_join_request_success(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(
                team_id=str(self.team_doc["_id"]),
                message="I would love to contribute my React frontend skills!",
            )
            res = await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(res.status, "pending")
            self.assertEqual(res.team_name, "AquaJharkhand Innovators")
            self.assertEqual(res.applicant_name, "Applicant Priya")
            self.assertEqual(res.message, "I would love to contribute my React frontend skills!")

        self.loop.run_until_complete(run())

    def test_02_invalid_team_id_format(self):
        with self.assertRaises(ValidationError):
            CreateJoinRequest(team_id="invalid-id-format")

    def test_03_team_not_found(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(ObjectId()))
            with self.assertRaises(HTTPException) as cm:
                await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(cm.exception.status_code, 404)

        self.loop.run_until_complete(run())

    def test_04_team_not_recruiting(self):
        async def run():
            self.team_doc["status"] = TeamStatus.COMPLETED.value
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            with self.assertRaises(HTTPException) as cm:
                await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("not accepting", cm.exception.detail)

        self.loop.run_until_complete(run())

    def test_05_team_is_full(self):
        async def run():
            self.team_doc["max_members"] = 1  # already has leader
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            with self.assertRaises(HTTPException) as cm:
                await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("capacity", cm.exception.detail)

        self.loop.run_until_complete(run())

    def test_06_leader_cannot_join_own_team(self):
        async def run():
            user_doc = {"_id": self.leader_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            with self.assertRaises(HTTPException) as cm:
                await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("leader", cm.exception.detail)

        self.loop.run_until_complete(run())

    def test_07_already_member_cannot_join(self):
        async def run():
            self.team_doc["members"].append({"user_id": self.applicant_id, "role": "Member"})
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            with self.assertRaises(HTTPException) as cm:
                await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("already a member", cm.exception.detail)

        self.loop.run_until_complete(run())

    def test_08_duplicate_pending_request_prevented(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            await join_request_service.submit_join_request(self.db, user_doc, payload)

            # Second attempt while first is pending must fail
            with self.assertRaises(HTTPException) as cm:
                await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("already have a pending", cm.exception.detail)

        self.loop.run_until_complete(run())

    def test_09_reapplication_allowed_after_rejection(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            req = await join_request_service.submit_join_request(self.db, user_doc, payload)

            # Leader rejects
            await join_request_service.decide_join_request(
                self.db, request_id=req.id, leader_user_id=str(self.leader_id), decision="rejected"
            )

            # Re-application must now succeed!
            new_req = await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(new_req.status, "pending")

        self.loop.run_until_complete(run())

    def test_10_reapplication_allowed_after_cancellation(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            req = await join_request_service.submit_join_request(self.db, user_doc, payload)

            # Applicant cancels
            await join_request_service.cancel_join_request(
                self.db, request_id=req.id, user_id=str(self.applicant_id)
            )

            # Re-application must now succeed!
            new_req = await join_request_service.submit_join_request(self.db, user_doc, payload)
            self.assertEqual(new_req.status, "pending")

        self.loop.run_until_complete(run())

    def test_11_non_leader_cannot_view_team_requests(self):
        async def run():
            with self.assertRaises(HTTPException) as cm:
                await join_request_service.get_team_join_requests(
                    self.db,
                    team_id=str(self.team_doc["_id"]),
                    leader_user_id=str(self.other_user_id),
                )
            self.assertEqual(cm.exception.status_code, 403)

        self.loop.run_until_complete(run())

    def test_12_non_leader_cannot_decide_request(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            req = await join_request_service.submit_join_request(self.db, user_doc, payload)

            with self.assertRaises(HTTPException) as cm:
                await join_request_service.decide_join_request(
                    self.db,
                    request_id=req.id,
                    leader_user_id=str(self.other_user_id),
                    decision="accepted",
                )
            self.assertEqual(cm.exception.status_code, 403)

        self.loop.run_until_complete(run())

    def test_13_requester_can_cancel_own_request(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            req = await join_request_service.submit_join_request(self.db, user_doc, payload)

            cancelled = await join_request_service.cancel_join_request(
                self.db, request_id=req.id, user_id=str(self.applicant_id)
            )
            self.assertEqual(cancelled.status, "cancelled")

        self.loop.run_until_complete(run())

    def test_14_other_user_cannot_cancel_request(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            req = await join_request_service.submit_join_request(self.db, user_doc, payload)

            with self.assertRaises(HTTPException) as cm:
                await join_request_service.cancel_join_request(
                    self.db, request_id=req.id, user_id=str(self.other_user_id)
                )
            self.assertEqual(cm.exception.status_code, 403)

        self.loop.run_until_complete(run())

    def test_15_acceptance_adds_member_and_marks_full(self):
        async def run():
            self.team_doc["max_members"] = 2  # Leader + 1 member = full
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            req = await join_request_service.submit_join_request(self.db, user_doc, payload)

            accepted = await join_request_service.decide_join_request(
                self.db,
                request_id=req.id,
                leader_user_id=str(self.leader_id),
                decision="accepted",
            )
            self.assertEqual(accepted.status, "accepted")

            # Check team members in DB
            self.assertEqual(len(self.team_doc["members"]), 2)
            self.assertTrue(any(m["user_id"] == self.applicant_id for m in self.team_doc["members"]))
            # Status should now be FULL
            self.assertEqual(self.team_doc["status"], TeamStatus.FULL.value)

        self.loop.run_until_complete(run())

    def test_16_rejection_does_not_modify_members(self):
        async def run():
            user_doc = {"_id": self.applicant_id}
            payload = CreateJoinRequest(team_id=str(self.team_doc["_id"]))
            req = await join_request_service.submit_join_request(self.db, user_doc, payload)

            rejected = await join_request_service.decide_join_request(
                self.db,
                request_id=req.id,
                leader_user_id=str(self.leader_id),
                decision="rejected",
            )
            self.assertEqual(rejected.status, "rejected")
            self.assertEqual(len(self.team_doc["members"]), 1)
            self.assertFalse(any(m["user_id"] == self.applicant_id for m in self.team_doc["members"]))

        self.loop.run_until_complete(run())


if __name__ == "__main__":
    unittest.main()
