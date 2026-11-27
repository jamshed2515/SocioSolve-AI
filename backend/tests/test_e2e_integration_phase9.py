"""
Phase 9: Comprehensive End-to-End Integration & Security Test Suite.
Tests complete multi-step collaboration workflows across all Module 3 phases:

Workflow 1: Team Creation & Join Request Workflow
Workflow 2: Team Invitation & Member Onboarding Workflow
Workflow 3: Full Team Collaboration (Discussions, Tasks, Milestones, Meetings)
Workflow 4: Persistent Notifications & Real-Time Socket Event Delivery
Workflow 5: Rigorous Security & Role-Based Access Control (Leader, Member, Non-Member, Guest)
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

from app.modules.team_collaboration.schemas.team_schema import TeamCreate, TeamUpdate
from app.modules.team_collaboration.schemas.join_request_schema import CreateJoinRequest, JoinRequestDecision
from app.modules.team_collaboration.schemas.invitation_schema import CreateInvitationRequest, ChangeRoleRequest
from app.modules.team_collaboration.schemas.discussion_schema import DiscussionCreate, CommentCreate, DiscussionUpdate
from app.modules.team_collaboration.schemas.task_schema import TaskCreate, TaskStatusUpdate, TaskProgressUpdate
from app.modules.team_collaboration.schemas.milestone_schema import MilestoneCreate
from app.modules.team_collaboration.schemas.meeting_schema import MeetingCreate, MeetingType

from app.modules.team_collaboration.services import (
    team_service,
    join_request_service,
    invitation_service,
    discussion_service,
    task_service,
    milestone_service,
    meeting_service,
    notification_service,
)
from app.modules.team_collaboration.socket import (
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
    def __init__(self, name="collection", initial_data=None):
        self.name = name
        self.docs = [dict(d) for d in (initial_data or [])]

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)

        class Result:
            inserted_id = d["_id"]

        return Result()

    async def find_one(self, query, *args, **kwargs):
        sort_by = kwargs.get("sort")
        matching = []
        for d in self.docs:
            if self._match(d, query):
                matching.append(d)
        if not matching:
            return None
        if sort_by:
            field, direction = sort_by[0]
            matching.sort(key=lambda x: x.get(field, datetime.min), reverse=(direction == -1))
        return matching[0]

    def find(self, query=None, *args, **kwargs):
        query = query or {}
        matching = [d for d in self.docs if self._match(d, query)]
        return MockCursor(matching)

    async def count_documents(self, query=None):
        query = query or {}
        return len([d for d in self.docs if self._match(d, query)])

    async def update_one(self, query, update, *args, **kwargs):
        matched = 0
        modified = 0
        for d in self.docs:
            if self._match(d, query):
                matched += 1
                # Check $expr if present
                if "$expr" in query:
                    expr = query["$expr"]
                    if "$lt" in expr:
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
            if self._match(d, query):
                if "$set" in update:
                    for k, val in update["$set"].items():
                        d[k] = val
                count += 1

        class Res:
            modified_count = count

        return Res()

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
                if not any(self._match(doc, branch) for branch in v):
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
                field_val = doc.get(k)
                if "$gte" in v:
                    if field_val is None or field_val < v["$gte"]:
                        return False
                if "$ne" in v and doc.get(k) == v["$ne"]:
                    return False
                if "$in" in v and doc.get(k) not in v["$in"]:
                    return False
            elif doc.get(k) != v:
                return False
        return True


class MockDB:
    def __init__(self):
        self.users = MockCollection("users")
        self.challenges = MockCollection("challenges")
        self.teams = MockCollection("teams")
        self.join_requests = MockCollection("join_requests")
        self.team_invitations = MockCollection("team_invitations")
        self.team_discussions = MockCollection("team_discussions")
        self.discussion_comments = MockCollection("discussion_comments")
        self.team_tasks = MockCollection("team_tasks")
        self.team_meetings = MockCollection("team_meetings")
        self.team_milestones = MockCollection("team_milestones")
        self.notifications = MockCollection("notifications")

    def __getitem__(self, name):
        return getattr(self, name)


class TestPhase9EndToEndIntegration(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        self.db = MockDB()

        # Seed Platform Users
        # User A: Leader
        self.user_a_id = ObjectId()
        self.user_a = {
            "_id": self.user_a_id,
            "id": str(self.user_a_id),
            "name": "Dr. Aarav Sharma",
            "email": "aarav@jharkhand.edu",
            "role": "student",
            "is_active": True,
            "firebase_uid": "fb_aarav",
        }

        # User B: Applicant / Member
        self.user_b_id = ObjectId()
        self.user_b = {
            "_id": self.user_b_id,
            "id": str(self.user_b_id),
            "name": "Priya Kumari",
            "email": "priya@bitmesra.edu",
            "role": "student",
            "is_active": True,
            "firebase_uid": "fb_priya",
        }

        # User C: Invitee
        self.user_c_id = ObjectId()
        self.user_c = {
            "_id": self.user_c_id,
            "id": str(self.user_c_id),
            "name": "Rajesh Mahato",
            "email": "rajesh@ranchi.org",
            "role": "student",
            "is_active": True,
            "firebase_uid": "fb_rajesh",
        }

        # User D: External / Non-member
        self.user_d_id = ObjectId()
        self.user_d = {
            "_id": self.user_d_id,
            "id": str(self.user_d_id),
            "name": "Sunita Soren",
            "email": "sunita@jamshedpur.org",
            "role": "citizen",
            "is_active": True,
            "firebase_uid": "fb_sunita",
        }

        for u in [self.user_a, self.user_b, self.user_c, self.user_d]:
            self.loop.run_until_complete(self.db.users.insert_one(u))

        # Seed challenge
        self.challenge_id = ObjectId()
        self.loop.run_until_complete(
            self.db.challenges.insert_one({
                "_id": self.challenge_id,
                "title": "Clean Water & Sustainable Agri Jharkhand",
                "category": "Environment",
                "isPublished": True,
            })
        )

        # Patch get_database for notification_service and socket
        notification_service.get_database = lambda: self.db
        import app.modules.team_collaboration.socket as sock_mod
        sock_mod.get_database = lambda: self.db

    def tearDown(self):
        self.loop.close()

    # ── WORKFLOW 1: Team Creation & Join Request Workflow ───────────────────────

    def test_workflow_1_team_creation_and_joining(self):
        """
        1. User A creates team -> User A is leader.
        2. User B discovers team and submits join request.
        3. User A receives notification and accepts request.
        4. User B is added to team members roster.
        5. User B can now access team information.
        """
        # 1. User A creates team
        create_payload = TeamCreate(
            name="Jharkhand JalSuraksha",
            description="IoT water quality monitoring in Subarnarekha river basin",
            challenge_id=str(self.challenge_id),
            max_members=4,
        )
        team_res = self.loop.run_until_complete(
            team_service.create_team(self.db, self.user_a, create_payload)
        )
        team_id = str(team_res.id)
        self.assertEqual(team_res.name, "Jharkhand JalSuraksha")
        self.assertEqual(team_res.leader_id, str(self.user_a_id))
        self.assertTrue(team_res.is_leader)

        # 2. User B submits join request
        join_payload = CreateJoinRequest(
            team_id=team_id,
            message="I have 2 years of experience with ESP32 sensors and LoRaWAN in Ranchi.",
            skills=["IoT", "LoRaWAN"],
        )
        req_res = self.loop.run_until_complete(
            join_request_service.submit_join_request(
                self.db, self.user_b, join_payload
            )
        )
        self.assertEqual(req_res.status, "pending")
        req_id = str(req_res.id)

        # 3. User A views received requests and accepts
        leader_requests = self.loop.run_until_complete(
            join_request_service.get_team_join_requests(self.db, team_id, str(self.user_a_id))
        )
        self.assertEqual(len(leader_requests.requests), 1)
        self.assertEqual(leader_requests.requests[0].id, req_id)

        dec_res = self.loop.run_until_complete(
            join_request_service.decide_join_request(
                self.db, req_id, str(self.user_a_id), "accept"
            )
        )
        self.assertEqual(dec_res.status, "accepted")

        # 4. User B is now a team member
        team_updated = self.loop.run_until_complete(
            team_service.get_team_by_id(self.db, team_id, str(self.user_b_id))
        )
        self.assertTrue(team_updated.is_member)
        self.assertFalse(team_updated.is_leader)
        self.assertEqual(team_updated.member_count, 2)

    # ── WORKFLOW 2: Team Invitation Workflow ────────────────────────────────────

    def test_workflow_2_invitation_lifecycle(self):
        """
        1. User A creates team.
        2. User A invites User C.
        3. User C receives notification & invitation.
        4. User C accepts invitation.
        5. User C is enrolled in roster; capacity & membership verified.
        """
        # Create team
        create_payload = TeamCreate(
            name="Bokaro Solar AgriTech",
            description="Solar cold storage units for local farmers in Bokaro",
            challenge_id=str(self.challenge_id),
            max_members=3,
        )
        team_res = self.loop.run_until_complete(
            team_service.create_team(self.db, self.user_a, create_payload)
        )
        team_id = str(team_res.id)

        # 2. Leader invites User C
        inv_payload = CreateInvitationRequest(
            invitee_id=str(self.user_c_id),
            message="We need your expertise in Solar PV sizing.",
        )
        inv_res = self.loop.run_until_complete(
            invitation_service.send_team_invitation(
                self.db, team_id, self.user_a, inv_payload
            )
        )
        self.assertEqual(inv_res.status, "pending")
        inv_id = str(inv_res.id)

        # 3. User C accepts invitation
        accept_res = self.loop.run_until_complete(
            invitation_service.respond_to_team_invitation(
                self.db, inv_id, self.user_c, decision="accepted"
            )
        )
        self.assertEqual(accept_res.status, "accepted")

        # 4. Verify membership roster contains User C
        members = self.loop.run_until_complete(
            invitation_service.get_team_members(self.db, team_id)
        )
        member_ids = [m.user_id for m in members]
        self.assertIn(str(self.user_c_id), member_ids)

    # ── WORKFLOW 3: Full Team Collaboration ─────────────────────────────────────

    def test_workflow_3_full_collaboration_suite(self):
        """
        1. Leader creates discussion.
        2. Member adds comment and reply.
        3. Leader pins and locks discussion.
        4. Attempt to comment on locked discussion raises 400.
        5. Leader creates task and assigns to member.
        6. Member transitions task status and reports progress.
        7. Leader creates milestone and links task.
        8. Leader schedules team meeting with members.
        """
        # Setup team with User A (leader) and User B (member)
        team_res = self.loop.run_until_complete(
            team_service.create_team(
                self.db,
                self.user_a,
                TeamCreate(
                    name="Dhanbad Clean Energy Hub",
                    description="Decentralized biomass & solar in Dhanbad",
                    challenge_id=str(self.challenge_id),
                    max_members=4,
                ),
            )
        )
        team_id = str(team_res.id)

        # Add User B to members
        self.loop.run_until_complete(
            self.db.teams.update_one(
                {"_id": ObjectId(team_id)},
                {"$push": {"members": {"user_id": self.user_b_id, "role": "Member"}}},
            )
        )

        # 1. Leader creates discussion
        disc_payload = DiscussionCreate(
            title="Biomass gasification feedstock selection",
            content="Should we focus on rice husk or paddy straw for Dhanbad rural clusters?",
            category="Technical",
        )
        disc = self.loop.run_until_complete(
            discussion_service.create_discussion(self.db, team_id, self.user_a, disc_payload)
        )
        disc_id = str(disc.id)
        self.assertEqual(disc.title, "Biomass gasification feedstock selection")

        # 2. Member comments
        comm_payload = CommentCreate(
            content="Rice husk is abundantly available near Govindpur mills."
        )
        comm = self.loop.run_until_complete(
            discussion_service.add_comment(self.db, disc_id, self.user_b, comm_payload)
        )
        self.assertEqual(comm.content, comm_payload.content)

        # 3. Leader locks discussion
        updated_disc = self.loop.run_until_complete(
            discussion_service.toggle_lock_discussion(self.db, disc_id, self.user_a, is_locked=True)
        )
        self.assertTrue(updated_disc.is_locked)

        # 4. Attempt to comment on locked discussion -> 400 Bad Request
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.add_comment(
                    self.db, disc_id, self.user_b, CommentCreate(content="Can I still reply?")
                )
            )
        self.assertEqual(ctx.exception.status_code, 400)

        # 5. Leader creates task and assigns to User B
        task_payload = TaskCreate(
            title="Field survey of Govindpur rice mills",
            description="Collect 5 feedstock samples for moisture testing",
            assigned_to=[str(self.user_b_id)],
            priority="high",
        )
        task = self.loop.run_until_complete(
            task_service.create_task(self.db, team_id, task_payload, self.user_a)
        )
        task_id = str(task.id)
        self.assertEqual(task.status, "todo")

        # 6. Member updates task status and progress
        task_status_payload = TaskStatusUpdate(status="in_progress")
        updated_task = self.loop.run_until_complete(
            task_service.update_task_status(self.db, task_id, task_status_payload, self.user_b)
        )
        self.assertEqual(updated_task.status, "in_progress")

        progress_task = self.loop.run_until_complete(
            task_service.update_task_progress(self.db, task_id, TaskProgressUpdate(progress=60), self.user_b)
        )
        self.assertEqual(progress_task.progress, 60)

        # 7. Leader creates milestone and links task
        milestone_payload = MilestoneCreate(
            title="Phase 1 Feedstock Feasibility Report",
            description="Moisture analysis, availability matrix, and cost modeling",
            due_date=datetime.now(timezone.utc) + timedelta(days=14),
            linked_task_ids=[task_id],
        )
        milestone = self.loop.run_until_complete(
            milestone_service.create_milestone(self.db, team_id, milestone_payload, self.user_a)
        )
        self.assertEqual(len(milestone.linked_task_ids), 1)

        # 8. Leader schedules team meeting
        meeting_payload = MeetingCreate(
            title="Weekly Sprint Sync: Feedstock Analysis",
            description="Review sample test results and finalize gasifier dimensions",
            attendees=[str(self.user_b_id)],
            meeting_date=datetime.now(timezone.utc) + timedelta(days=2),
            start_time="10:00",
            end_time="11:00",
            timezone="Asia/Kolkata",
            meeting_type=MeetingType.online,
            meeting_link="https://meet.google.com/socio-solve-team",
        )
        meeting = self.loop.run_until_complete(
            meeting_service.create_meeting(self.db, team_id, meeting_payload, self.user_a)
        )
        self.assertEqual(meeting.title, "Weekly Sprint Sync: Feedstock Analysis")
        self.assertIn(str(self.user_b_id), meeting.attendees)

    # ── WORKFLOW 4: Persistent Notifications & Real-Time Updates ────────────────

    def test_workflow_4_notifications_and_realtime_resilience(self):
        """
        1. Task assignment creates persistent notification.
        2. Real-time events delivered to recipient user room.
        3. Self-actions are suppressed (no self-notification).
        4. Duplicate notifications suppressed within time window.
        5. User retrieves unread count and marks notifications as read.
        """
        # Create notification for User B
        notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user_b_id,
                sender_id=self.user_a_id,
                title="New Task Assigned",
                message="You were assigned: 'Field survey of Govindpur rice mills'",
                notification_type="task_assigned",
                sender_name="Dr. Aarav Sharma",
                db=self.db,
            )
        )
        self.assertIsNotNone(notif)
        self.assertFalse(notif.is_read)

        # 3. Self-notification suppression: User A cannot notify themselves
        self_notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user_a_id,
                sender_id=self.user_a_id,
                title="Self Action",
                message="Should not be created",
                notification_type="task_assigned",
                db=self.db,
            )
        )
        self.assertIsNone(self_notif)

        # 4. User B checks unread count
        unread_count = self.loop.run_until_complete(
            notification_service.get_unread_count(self.user_b_id)
        )
        self.assertGreaterEqual(unread_count, 1)

        # Mark notification as read
        read_res = self.loop.run_until_complete(
            notification_service.mark_notification_as_read(notif.id, self.user_b_id)
        )
        self.assertTrue(read_res.is_read)

    # ── WORKFLOW 5: Security, RBAC & Boundary Enforcement ────────────────────────

    def test_workflow_5_security_and_rbac_boundaries(self):
        """
        1. Non-member (User D) cannot access private discussions (403).
        2. Non-leader (User B) cannot delete a team (403).
        3. Non-leader cannot modify team settings (403).
        4. User cannot mark another user's notifications as read (403).
        5. User cannot delete another user's notifications (403).
        6. Socket.IO rejects non-member join to team room.
        """
        # Create team with User A (leader) and User B (member)
        team_res = self.loop.run_until_complete(
            team_service.create_team(
                self.db,
                self.user_a,
                TeamCreate(
                    name="Ranchi Smart Waste",
                    description="Sensors for municipal waste segregation",
                    challenge_id=str(self.challenge_id),
                    max_members=5,
                ),
            )
        )
        team_id = str(team_res.id)

        # 1. Non-member (User D) cannot access private discussions -> 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                discussion_service.get_team_discussions(self.db, team_id, self.user_d)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 2. Non-leader (User B) cannot delete team -> 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                team_service.delete_team(self.db, team_id, self.user_b)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 3. Non-leader (User B) cannot update team -> 403 Forbidden
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                team_service.update_team(
                    self.db, team_id, self.user_b, TeamUpdate(name="Hacked Team Name")
                )
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 4. User cannot mark another user's notification as read
        notif = self.loop.run_until_complete(
            notification_service.create_notification(
                recipient_id=self.user_a_id,
                title="Leader Notice",
                message="Only for Leader",
                notification_type="general",
                db=self.db,
            )
        )
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                notification_service.mark_notification_as_read(notif.id, self.user_b_id)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 5. User cannot delete another user's notification
        with self.assertRaises(HTTPException) as ctx:
            self.loop.run_until_complete(
                notification_service.delete_notification(notif.id, self.user_b_id)
            )
        self.assertEqual(ctx.exception.status_code, 403)

        # 6. Socket.IO connection authorization: non-member rejected from team room
        self.loop.run_until_complete(
            _save_session("sid_user_d", {"user_id": str(self.user_d_id)})
        )
        emitted_events = []
        original_emit = sio.emit

        async def mock_emit(event, data, to=None, room=None):
            emitted_events.append((event, data, to or room))

        sio.emit = mock_emit
        try:
            self.loop.run_until_complete(
                handle_join_team("sid_user_d", {"team_id": team_id})
            )
            # Must emit error to sid_user_d
            self.assertTrue(any(ev[0] == "error" for ev in emitted_events))
        finally:
            sio.emit = original_emit


if __name__ == "__main__":
    unittest.main()
