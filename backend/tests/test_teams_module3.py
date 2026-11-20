"""
Module 3 – Team Creation & Management Tests (Phase 2).
Uses Python standard library (unittest + asyncio) so it executes without third-party test runners.

Verifies all 13 required test scenarios from Section 13:
1. Create team successfully.
2. Create team with missing name.
3. Create team with invalid challenge ID.
4. Create team with invalid capacity (< 2 or > 20).
5. Retrieve all teams.
6. Retrieve my teams.
7. Search teams.
8. Filter by challenge.
9. Get team details.
10. Update team.
11. Unauthorized update attempt.
12. Unauthorized delete attempt.
13. Delete team.
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

from app.modules.team_collaboration.schemas.team_schema import TeamCreate, TeamUpdate
from app.modules.team_collaboration.services import team_service


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

    async def count_documents(self, query):
        filtered = self._filter(query)
        return len(filtered)

    async def find_one(self, query):
        filtered = self._filter(query)
        return dict(filtered[0]) if filtered else None

    def find(self, query=None):
        filtered = self._filter(query or {})
        return MockCursor([dict(d) for d in filtered])

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)

        class Result:
            inserted_id = d["_id"]
        return Result()

    async def insert_many(self, docs):
        for doc in docs:
            await self.insert_one(doc)

    async def update_one(self, query, update):
        target = await self.find_one(query)
        if target:
            set_vals = update.get("$set", {})
            for d in self.docs:
                if str(d.get("_id")) == str(target.get("_id")):
                    d.update(set_vals)
                    return True
        return False

    async def delete_one(self, query):
        target = await self.find_one(query)
        if target:
            self.docs = [d for d in self.docs if str(d.get("_id")) != str(target.get("_id"))]
            return True
        return False

    def _filter(self, query):
        res = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if k == "$or":
                    or_match = False
                    for sub in v:
                        if self._match_sub(d, sub):
                            or_match = True
                            break
                    if not or_match:
                        match = False
                        break
                elif not self._match_field(d, k, v):
                    match = False
                    break
            if match:
                res.append(d)
        return res

    def _match_sub(self, d, sub):
        for k, v in sub.items():
            if not self._match_field(d, k, v):
                return False
        return True

    def _match_field(self, d, k, v):
        if k == "members.user_id":
            user_ids = [str(m.get("user_id")) for m in d.get("members", [])]
            return str(v) in user_ids
        actual = d.get(k)
        if isinstance(v, dict) and "$regex" in v:
            pattern = v["$regex"]
            return bool(pattern.lower() in str(actual or "").lower())
        return str(actual) == str(v)


class MockDatabase:
    def __init__(self):
        self.teams = MockCollection()
        self.users = MockCollection()
        self.challenges = MockCollection()


class TestModule3Teams(unittest.TestCase):
    def setUp(self):
        self.db = MockDatabase()

    def test_schema_validations(self):
        valid_cid = str(ObjectId())

        # 2. Missing/empty name
        with self.assertRaises(ValidationError):
            TeamCreate(name="   ", description="Valid description", challenge_id=valid_cid, max_members=5)

        # 3. Invalid challenge ID
        with self.assertRaises(ValidationError):
            TeamCreate(name="Team Water", description="Valid description", challenge_id="not-an-objectid", max_members=5)

        # 4. Invalid capacity (<2 or >20)
        with self.assertRaises(ValidationError):
            TeamCreate(name="Team Water", description="Valid description", challenge_id=valid_cid, max_members=1)
        with self.assertRaises(ValidationError):
            TeamCreate(name="Team Water", description="Valid description", challenge_id=valid_cid, max_members=25)

    def test_team_lifecycle_async(self):
        asyncio.run(self._run_team_lifecycle())

    async def _run_team_lifecycle(self):
        db = self.db
        leader_id = ObjectId()
        other_user_id = ObjectId()

        # Seed users
        await db.users.insert_one({"_id": leader_id, "name": "Rohan Mahato", "email": "rohan@example.com"})
        await db.users.insert_one({"_id": other_user_id, "name": "Priya Singh", "email": "priya@example.com"})

        # Seed challenge
        challenge_id = ObjectId()
        await db.challenges.insert_one({
            "_id": challenge_id,
            "title": "Clean Water Jharkhand",
            "category": "Environment",
            "isPublished": True,
        })

        # 1. Create team successfully
        create_payload = TeamCreate(
            name="JalRakshak Squad",
            description="Developing IoT sensors for rural well monitoring.",
            challenge_id=str(challenge_id),
            max_members=5,
        )
        user_doc = {"_id": leader_id, "name": "Rohan Mahato"}
        team = await team_service.create_team(db, user_doc, create_payload)

        self.assertIsNotNone(team.id)
        self.assertEqual(team.name, "JalRakshak Squad")
        self.assertEqual(team.leader_id, str(leader_id))
        self.assertEqual(team.member_count, 1)
        self.assertEqual(team.max_members, 5)
        self.assertEqual(team.status, "recruiting")
        self.assertTrue(team.is_leader)

        # 5. Retrieve all teams
        all_teams_res = await team_service.get_all_teams(db, page=1, limit=10)
        self.assertEqual(all_teams_res.total, 1)
        self.assertEqual(all_teams_res.teams[0].name, "JalRakshak Squad")

        # 6. Retrieve my teams
        my_teams_leader = await team_service.get_my_teams(db, user_id=str(leader_id))
        self.assertEqual(my_teams_leader.total, 1)
        my_teams_other = await team_service.get_my_teams(db, user_id=str(other_user_id))
        self.assertEqual(my_teams_other.total, 0)

        # 7. Search teams
        search_hit = await team_service.get_all_teams(db, search="JalRakshak")
        self.assertEqual(search_hit.total, 1)
        search_miss = await team_service.get_all_teams(db, search="NonExistent")
        self.assertEqual(search_miss.total, 0)

        # 8. Filter by challenge
        ch_hit = await team_service.get_all_teams(db, challenge_id=str(challenge_id))
        self.assertEqual(ch_hit.total, 1)
        ch_miss = await team_service.get_all_teams(db, challenge_id=str(ObjectId()))
        self.assertEqual(ch_miss.total, 0)

        # 9. Get team details
        detail = await team_service.get_team_by_id(db, team_id=team.id, current_user_id=str(leader_id))
        self.assertEqual(detail.name, "JalRakshak Squad")
        self.assertEqual(detail.challenge_title, "Clean Water Jharkhand")
        self.assertTrue(detail.is_leader)

        # 10. Update team by leader
        update_payload = TeamUpdate(name="JalRakshak AI Squad", description="Updated description for sensors.", max_members=7)
        updated = await team_service.update_team(db, team_id=team.id, user_id=str(leader_id), payload=update_payload)
        self.assertEqual(updated.name, "JalRakshak AI Squad")
        self.assertEqual(updated.max_members, 7)

        # 11. Unauthorized update attempt
        with self.assertRaises(HTTPException) as cm:
            await team_service.update_team(
                db, team_id=team.id, user_id=str(other_user_id), payload=TeamUpdate(name="Hacked Name")
            )
        self.assertEqual(cm.exception.status_code, 403)

        # 12. Unauthorized delete attempt
        with self.assertRaises(HTTPException) as cm:
            await team_service.delete_team(db, team_id=team.id, user_id=str(other_user_id))
        self.assertEqual(cm.exception.status_code, 403)

        # 13. Delete team by leader
        del_res = await team_service.delete_team(db, team_id=team.id, user_id=str(leader_id))
        self.assertIn("successfully deleted", del_res["message"])

        # Verify team no longer exists
        with self.assertRaises(HTTPException) as cm:
            await team_service.get_team_by_id(db, team_id=team.id)
        self.assertEqual(cm.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
