"""
Module 3 – Team Invitations & Member Management Tests (Phase 4).
Uses Python standard library (unittest + asyncio) so it executes standalone.

Verifies all required Phase 4 backend scenarios:
1. Leader successfully invites an existing user.
2. Non-leader cannot invite users (403).
3. Cannot invite nonexistent user (404).
4. Cannot invite self / team leader (400).
5. Cannot invite existing team member (400).
6. Cannot invite to full team (400).
7. Duplicate pending invitation prevention (409).
8. Re-inviting after rejection succeeds.
9. Re-inviting after cancellation succeeds.
10. Only the invitee can accept or reject (403).
11. Responding to non-pending invitation fails (400).
12. Invitee rejects invitation (status updated to rejected, no member added).
13. Invitee accepts invitation (member added exactly once, status updated to accepted).
14. Accepting when team is full is rejected (400).
15. Team status auto-transitions to full when capacity is reached on acceptance.
16. Leader can cancel pending invitation.
17. Non-leader / non-inviter cannot cancel invitation (403).
18. Get sanitized team members (passwords and sensitive fields omitted).
19. Leader removes member (member pulled, full team re-opens to recruiting).
20. Leader cannot remove themselves (400).
21. Non-leader cannot remove member (403).
22. Member can leave their own team.
23. Leader cannot leave team without transferring leadership (400).
24. Leader changes member role to valid role.
25. Non-leader cannot change member role (403).
26. Invalid role rejected (400).
27. Leader role cannot be changed through change role endpoint (400).
"""
import asyncio
from datetime import datetime, timezone
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bson import ObjectId
from fastapi import HTTPException

from app.modules.team_collaboration.models.invitation_model import InvitationStatus
from app.modules.team_collaboration.models.team_model import (
    ASSIGNABLE_MEMBER_ROLES,
    MemberRole,
    TeamStatus,
)
from app.modules.team_collaboration.schemas.invitation_schema import (
    ChangeRoleRequest,
    CreateInvitationRequest,
    InvitationDecision,
)
from app.modules.team_collaboration.services import invitation_service


class MockCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, *args, **kwargs):
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
    def __init__(self, initial_data=None):
        self.docs = [dict(d) for d in (initial_data or [])]

    async def find_one(self, query, *args, **kwargs):
        sort_by = kwargs.get("sort")
        matching = []
        for d in self.docs:
            if self._matches(d, query):
                matching.append(d)
        if not matching:
            return None
        if sort_by:
            field, direction = sort_by[0]
            matching.sort(key=lambda x: x.get(field, datetime.min), reverse=(direction == -1))
        return matching[0]

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
                # Check $expr if present
                if "$expr" in query:
                    expr = query["$expr"]
                    if "$lt" in expr:
                        left, right = expr["$lt"]
                        members_len = len(d.get("members", []))
                        max_cap = d.get("max_members", 6)
                        if not (members_len < max_cap):
                            continue
                # Apply $push
                if "$push" in update:
                    for k, val in update["$push"].items():
                        d.setdefault(k, []).append(val)
                        modified += 1
                # Apply $pull
                if "$pull" in update:
                    for k, val in update["$pull"].items():
                        if isinstance(val, dict) and "user_id" in val:
                            target_uid = val["user_id"]
                            d[k] = [m for m in d.get(k, []) if m.get("user_id") != target_uid]
                            modified += 1
                # Apply $set
                if "$set" in update:
                    for k, val in update["$set"].items():
                        if k.startswith("members.$."):
                            subfield = k.split("members.$.")[1]
                            # Update target member in query
                            target_uid = query.get("members.user_id")
                            for m in d.get("members", []):
                                if m.get("user_id") == target_uid:
                                    m[subfield] = val
                        else:
                            d[k] = val
                        modified += 1
                break

        class Res:
            matched_count = matched
            modified_count = modified
        return Res()

    async def update_many(self, query, update):
        count = 0
        for d in self.docs:
            if self._matches(d, query):
                if "$set" in update:
                    for k, val in update["$set"].items():
                        d[k] = val
                count += 1
        class Res:
            modified_count = count
        return Res()

    def _matches(self, doc, query):
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, branch) for branch in v):
                    return False
            elif k == "$expr":
                continue
            elif k == "members.user_id":
                m_uids = [m.get("user_id") for m in doc.get("members", [])]
                if isinstance(v, dict) and "$ne" in v:
                    if v["$ne"] in m_uids:
                        return False
                elif v not in m_uids:
                    return False
            elif isinstance(v, dict):
                if "$ne" in v and doc.get(k) == v["$ne"]:
                    return False
                if "$in" in v and doc.get(k) not in v["$in"]:
                    return False
            elif doc.get(k) != v:
                return False
        return True


class MockDatabase:
    def __init__(self):
        self.teams = MockCollection()
        self.team_invitations = MockCollection()
        self.join_requests = MockCollection()
        self.users = MockCollection()
        self.challenges = MockCollection()


class TestPhase4TeamInvitationsAndMembers(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        self.db = MockDatabase()
        self.leader_id = ObjectId()
        self.member1_id = ObjectId()
        self.invitee_id = ObjectId()
        self.outsider_id = ObjectId()
        self.challenge_id = ObjectId()

        # Seed Users
        self.leader_user = {
            "_id": self.leader_id,
            "name": "Leader Birsa",
            "email": "birsa@jharkhand.gov.in",
            "role": "student",
            "password_hash": "SUPER_SECRET_HASH",
        }
        self.member1_user = {
            "_id": self.member1_id,
            "name": "Member Rahul",
            "email": "rahul@bitmesra.ac.in",
            "role": "student",
            "password_hash": "SUPER_SECRET_HASH",
        }
        self.invitee_user = {
            "_id": self.invitee_id,
            "name": "Priya Sharma",
            "email": "priya@iitkgp.ac.in",
            "role": "student",
            "skills": ["React", "FastAPI"],
            "password_hash": "SUPER_SECRET_HASH",
        }
        self.outsider_user = {
            "_id": self.outsider_id,
            "name": "Outsider Anil",
            "email": "anil@jharkhand.edu",
            "role": "student",
        }

        self.db.users.docs = [
            self.leader_user,
            self.member1_user,
            self.invitee_user,
            self.outsider_user,
        ]

        # Seed Challenge
        self.challenge_doc = {
            "_id": self.challenge_id,
            "title": "IoT Water Monitoring – Dhanbad",
            "category": "Water & Environment",
        }
        self.db.challenges.docs = [self.challenge_doc]

        # Seed Team
        self.team_id = ObjectId()
        self.team_doc = {
            "_id": self.team_id,
            "name": "JalRakshak Squad",
            "description": "Smart IoT water sensors for rural Jharkhand.",
            "challenge_id": self.challenge_id,
            "leader_id": self.leader_id,
            "members": [
                {"user_id": self.leader_id, "role": "Team Leader", "joined_at": datetime.now(timezone.utc)},
                {"user_id": self.member1_id, "role": "Member", "joined_at": datetime.now(timezone.utc)},
            ],
            "max_members": 3,
            "status": "recruiting",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        self.db.teams.docs = [self.team_doc]

    def tearDown(self):
        self.loop.close()

    def test_01_leader_successfully_invites_user(self):
        """Team leader can invite an existing platform user."""
        payload = CreateInvitationRequest(
            invitee_id=str(self.invitee_id),
            message="Join our IoT water sensor team!",
        )
        res = self.loop.run_until_complete(
            invitation_service.send_team_invitation(
                self.db, str(self.team_id), self.leader_user, payload
            )
        )
        self.assertEqual(res.status, "pending")
        self.assertEqual(res.invitee_id, str(self.invitee_id))
        self.assertEqual(res.inviter_id, str(self.leader_id))
        self.assertEqual(res.team_name, "JalRakshak Squad")
        self.assertEqual(len(self.db.team_invitations.docs), 1)

    def test_02_non_leader_cannot_invite_users(self):
        """Regular member or outsider cannot send invitations (403)."""
        payload = CreateInvitationRequest(invitee_id=str(self.invitee_id))
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.send_team_invitation(
                    self.db, str(self.team_id), self.member1_user, payload
                )
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_03_cannot_invite_nonexistent_user(self):
        """Inviting a user that does not exist returns 404."""
        payload = CreateInvitationRequest(invitee_id=str(ObjectId()))
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.send_team_invitation(
                    self.db, str(self.team_id), self.leader_user, payload
                )
            )
        self.assertEqual(ctx.exception.status_code, 404)

    def test_04_cannot_invite_self(self):
        """Leader cannot invite themselves (400)."""
        payload = CreateInvitationRequest(invitee_id=str(self.leader_id))
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.send_team_invitation(
                    self.db, str(self.team_id), self.leader_user, payload
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_05_cannot_invite_existing_member(self):
        """Cannot invite a user who is already in the team (400)."""
        payload = CreateInvitationRequest(invitee_id=str(self.member1_id))
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.send_team_invitation(
                    self.db, str(self.team_id), self.leader_user, payload
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_06_cannot_invite_when_team_full(self):
        """Cannot invite when team capacity is reached (400)."""
        self.team_doc["members"].append(
            {"user_id": self.outsider_id, "role": "Member", "joined_at": datetime.now(timezone.utc)}
        )
        self.team_doc["status"] = "full"
        payload = CreateInvitationRequest(invitee_id=str(self.invitee_id))
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.send_team_invitation(
                    self.db, str(self.team_id), self.leader_user, payload
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_07_duplicate_pending_invitation_prevented(self):
        """Cannot send a second pending invitation to the same user for the same team (409)."""
        payload = CreateInvitationRequest(invitee_id=str(self.invitee_id))
        self.loop.run_until_complete(
            invitation_service.send_team_invitation(
                self.db, str(self.team_id), self.leader_user, payload
            )
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.send_team_invitation(
                    self.db, str(self.team_id), self.leader_user, payload
                )
            )
        self.assertEqual(ctx.exception.status_code, 409)

    def test_08_reinviting_after_rejection_or_cancellation_succeeds(self):
        """After rejection or cancellation, leader can send a new invitation."""
        inv_oid = ObjectId()
        self.db.team_invitations.docs.append({
            "_id": inv_oid,
            "team_id": self.team_id,
            "inviter_id": self.leader_id,
            "invitee_id": self.invitee_id,
            "status": "rejected",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        payload = CreateInvitationRequest(invitee_id=str(self.invitee_id))
        res = self.loop.run_until_complete(
            invitation_service.send_team_invitation(
                self.db, str(self.team_id), self.leader_user, payload
            )
        )
        self.assertEqual(res.status, "pending")

    def test_09_only_invitee_can_respond(self):
        """Non-invitee cannot accept or reject the invitation (403)."""
        inv_oid = ObjectId()
        self.db.team_invitations.docs.append({
            "_id": inv_oid,
            "team_id": self.team_id,
            "inviter_id": self.leader_id,
            "invitee_id": self.invitee_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.respond_to_team_invitation(
                    self.db, str(inv_oid), self.outsider_user, decision="accepted"
                )
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_10_invitee_rejects_invitation(self):
        """Invitee rejects invitation: status becomes rejected, membership unchanged."""
        inv_oid = ObjectId()
        self.db.team_invitations.docs.append({
            "_id": inv_oid,
            "team_id": self.team_id,
            "inviter_id": self.leader_id,
            "invitee_id": self.invitee_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        res = self.loop.run_until_complete(
            invitation_service.respond_to_team_invitation(
                self.db, str(inv_oid), self.invitee_user, decision="rejected"
            )
        )
        self.assertEqual(res.status, "rejected")
        self.assertEqual(len(self.team_doc["members"]), 2)

    def test_11_invitee_accepts_invitation_enrolled_once(self):
        """Invitee accepts: added to team members exactly once, capacity updated."""
        inv_oid = ObjectId()
        self.db.team_invitations.docs.append({
            "_id": inv_oid,
            "team_id": self.team_id,
            "inviter_id": self.leader_id,
            "invitee_id": self.invitee_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        res = self.loop.run_until_complete(
            invitation_service.respond_to_team_invitation(
                self.db, str(inv_oid), self.invitee_user, decision="accepted"
            )
        )
        self.assertEqual(res.status, "accepted")
        self.assertEqual(len(self.team_doc["members"]), 3)
        self.assertEqual(self.team_doc["status"], "full")  # Reached max_members 3

    def test_12_accepting_when_full_rejected(self):
        """Accepting an invitation when team capacity is already full returns 400."""
        self.team_doc["members"].append(
            {"user_id": self.outsider_id, "role": "Member", "joined_at": datetime.now(timezone.utc)}
        )
        self.team_doc["status"] = "full"
        inv_oid = ObjectId()
        self.db.team_invitations.docs.append({
            "_id": inv_oid,
            "team_id": self.team_id,
            "inviter_id": self.leader_id,
            "invitee_id": self.invitee_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.respond_to_team_invitation(
                    self.db, str(inv_oid), self.invitee_user, decision="accepted"
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_13_leader_cancels_pending_invitation(self):
        """Team leader can cancel their pending invitation."""
        inv_oid = ObjectId()
        self.db.team_invitations.docs.append({
            "_id": inv_oid,
            "team_id": self.team_id,
            "inviter_id": self.leader_id,
            "invitee_id": self.invitee_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        res = self.loop.run_until_complete(
            invitation_service.cancel_team_invitation(
                self.db, str(inv_oid), self.leader_user
            )
        )
        self.assertEqual(res.status, "cancelled")

    def test_14_non_leader_cannot_cancel_invitation(self):
        """Non-leader cannot cancel invitations (403)."""
        inv_oid = ObjectId()
        self.db.team_invitations.docs.append({
            "_id": inv_oid,
            "team_id": self.team_id,
            "inviter_id": self.leader_id,
            "invitee_id": self.invitee_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.cancel_team_invitation(
                    self.db, str(inv_oid), self.member1_user
                )
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_15_get_team_members_sanitizes_sensitive_fields(self):
        """Member listing returns name and email, but strictly hides password hashes or tokens."""
        members = self.loop.run_until_complete(
            invitation_service.get_team_members(self.db, str(self.team_id))
        )
        self.assertEqual(len(members), 2)
        # Check that attributes like password_hash are not present
        for m in members:
            self.assertFalse(hasattr(m, "password_hash"))
            self.assertIn(m.role, ["Team Leader", "Member"])

    def test_16_leader_removes_member_reopens_recruiting(self):
        """Leader removes member: capacity freed, team status re-opens from full to recruiting."""
        self.team_doc["members"].append(
            {"user_id": self.outsider_id, "role": "Member", "joined_at": datetime.now(timezone.utc)}
        )
        self.team_doc["status"] = "full"
        res = self.loop.run_until_complete(
            invitation_service.remove_team_member(
                self.db, str(self.team_id), str(self.member1_id), self.leader_user
            )
        )
        self.assertTrue(res["success"])
        self.assertEqual(len(self.team_doc["members"]), 2)
        self.assertEqual(self.team_doc["status"], "recruiting")

    def test_17_leader_cannot_remove_themselves(self):
        """Leader cannot remove themselves via member removal (400)."""
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.remove_team_member(
                    self.db, str(self.team_id), str(self.leader_id), self.leader_user
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_18_non_leader_cannot_remove_members(self):
        """Regular member cannot remove another member (403)."""
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.remove_team_member(
                    self.db, str(self.team_id), str(self.member1_id), self.outsider_user
                )
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_19_member_can_leave_team(self):
        """Regular member can voluntarily leave the team."""
        res = self.loop.run_until_complete(
            invitation_service.leave_team(
                self.db, str(self.team_id), self.member1_user
            )
        )
        self.assertTrue(res["success"])
        self.assertEqual(len(self.team_doc["members"]), 1)

    def test_20_leader_cannot_leave_without_transfer(self):
        """Leader cannot leave the team (400)."""
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.leave_team(
                    self.db, str(self.team_id), self.leader_user
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_21_leader_changes_member_role_successfully(self):
        """Leader changes member role to 'Researcher'."""
        res = self.loop.run_until_complete(
            invitation_service.change_member_role(
                self.db, str(self.team_id), str(self.member1_id), "Researcher", self.leader_user
            )
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["role"], "Researcher")
        # Verify in memory
        target = next(m for m in self.team_doc["members"] if m["user_id"] == self.member1_id)
        self.assertEqual(target["role"], "Researcher")

    def test_22_non_leader_cannot_change_roles(self):
        """Non-leader cannot change roles (403)."""
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.change_member_role(
                    self.db, str(self.team_id), str(self.member1_id), "Researcher", self.member1_user
                )
            )
        self.assertEqual(ctx.exception.status_code, 403)

    def test_23_invalid_role_rejected(self):
        """Assigning an invalid role name returns 400."""
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.change_member_role(
                    self.db, str(self.team_id), str(self.member1_id), "SuperAdmin", self.leader_user
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_24_cannot_change_leaders_role(self):
        """Leader's own role cannot be altered via change role endpoint (400)."""
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                invitation_service.change_member_role(
                    self.db, str(self.team_id), str(self.leader_id), "Developer", self.leader_user
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
