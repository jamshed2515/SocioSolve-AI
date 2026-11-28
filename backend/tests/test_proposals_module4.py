"""
Comprehensive automated tests for Module 4: Solution Proposals & Evaluation.
Covers every endpoint, RBAC rule, workflow state transition, Module 2/3 integration,
and all audit fixes (H1-H3, M1-M5, L1-L5).
"""
import asyncio
from datetime import datetime, timezone, timedelta
import os
import re
import sys
import types

from bson import ObjectId
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Allow running tests even in minimal environments where optional firebase_admin SDK is absent
if "firebase_admin" not in sys.modules:
    try:
        import firebase_admin  # noqa: F401
    except ImportError:
        fake_fb = types.ModuleType("firebase_admin")
        fake_fb.App = object
        fake_fb._apps = {}
        fake_fb.initialize_app = lambda cred=None, options=None: types.SimpleNamespace(project_id="test")
        fake_fb.get_app = lambda: types.SimpleNamespace(project_id="test")

        class _FBError(Exception):
            pass

        class _ExpiredIdTokenError(_FBError):
            def __init__(self, msg="", cause=None):
                super().__init__(msg)

        fake_auth = types.ModuleType("firebase_admin.auth")
        fake_auth.ExpiredIdTokenError = _ExpiredIdTokenError
        fake_auth.RevokedIdTokenError = type("RevokedIdTokenError", (_FBError,), {})
        fake_auth.UserDisabledError = type("UserDisabledError", (_FBError,), {})
        fake_auth.CertificateFetchError = type("CertificateFetchError", (_FBError,), {})
        fake_auth.InvalidIdTokenError = type("InvalidIdTokenError", (_FBError,), {})
        fake_auth.verify_id_token = lambda token, **kw: {"uid": token}
        fake_auth.revoke_refresh_tokens = lambda uid: None
        fake_auth.update_user = lambda uid, **kw: None

        fake_cred = types.ModuleType("firebase_admin.credentials")
        fake_cred.Base = object
        fake_cred.Certificate = lambda p: p
        fake_cred.ApplicationDefault = lambda: None

        fake_fb.auth = fake_auth
        fake_fb.credentials = fake_cred
        sys.modules["firebase_admin"] = fake_fb
        sys.modules["firebase_admin.auth"] = fake_auth
        sys.modules["firebase_admin.credentials"] = fake_cred

if "google.auth.credentials" not in sys.modules:
    try:
        from google.auth.credentials import AnonymousCredentials  # noqa: F401
    except ImportError:
        fake_google = types.ModuleType("google")
        fake_gauth = types.ModuleType("google.auth")
        fake_gcred = types.ModuleType("google.auth.credentials")
        fake_gcred.AnonymousCredentials = type("AnonymousCredentials", (), {})
        fake_google.auth = fake_gauth
        fake_gauth.credentials = fake_gcred
        sys.modules.setdefault("google", fake_google)
        sys.modules["google.auth"] = fake_gauth
        sys.modules["google.auth.credentials"] = fake_gcred

if "socketio" not in sys.modules:
    try:
        import socketio  # noqa: F401
    except ImportError:
        fake_sio = types.ModuleType("socketio")

        class _DummyAsyncServer:
            def __init__(self, *a, **k):
                pass
            def event(self, fn):
                return fn
            def on(self, *a, **k):
                return lambda fn: fn
            async def emit(self, *a, **k):
                pass
            async def enter_room(self, *a, **k):
                pass
            async def leave_room(self, *a, **k):
                pass

        async def _dummy_asgi_app(scope, receive, send):
            pass

        fake_sio.AsyncServer = _DummyAsyncServer
        fake_sio.ASGIApp = lambda *a, **k: _dummy_asgi_app
        sys.modules["socketio"] = fake_sio

from app.models.proposal import (  # noqa: E402
    ProposalStatus,
    ReviewRecommendation,
    DEFAULT_RUBRIC_CRITERIA,
    RUBRIC_MAX_TOTAL_SCORE,
)
from app.schemas.proposal_schema import (  # noqa: E402
    ProposalCreateRequest,
    ProposalUpdateRequest,
    ReviewUpsertRequest,
    CriterionScoreSchema,
    StatusTransitionRequest,
)
from app.services import proposal_service  # noqa: E402


# ==============================================================================
# IN-MEMORY MONGODB TEST DOUBLE (SUPPORTS $and, $or, $in, $nin, $ne, $gte, $lte, $regex, DOT PATHS)
# ==============================================================================

def _extract_values(doc, path):
    """Extract all values at a dot-notation path, supporting lists of dicts (MongoDB semantics)."""
    parts = path.split(".")
    current = [doc]
    for part in parts:
        nxt = []
        for item in current:
            if isinstance(item, dict):
                if part in item:
                    val = item[part]
                    if isinstance(val, list):
                        nxt.extend(val)
                    else:
                        nxt.append(val)
            elif isinstance(item, list):
                for sub in item:
                    if isinstance(sub, dict) and part in sub:
                        val = sub[part]
                        if isinstance(val, list):
                            nxt.extend(val)
                        else:
                            nxt.append(val)
        current = nxt
    return current


def _match_condition(doc, key, cond):
    values = _extract_values(doc, key)
    raw_val = doc.get(key) if "." not in key else (values[0] if len(values) == 1 else values)

    if isinstance(cond, dict):
        for op, target in cond.items():
            if op == "$ne":
                if isinstance(raw_val, list):
                    if target in raw_val:
                        return False
                elif raw_val == target or target in values:
                    return False
            elif op == "$in":
                if isinstance(raw_val, list):
                    if not any(v in target for v in raw_val):
                        return False
                else:
                    if raw_val not in target and not any(v in target for v in values):
                        return False
            elif op == "$nin":
                if isinstance(raw_val, list):
                    if any(v in target for v in raw_val):
                        return False
                else:
                    if raw_val in target or any(v in target for v in values):
                        return False
            elif op == "$gte":
                if raw_val is None or raw_val < target:
                    return False
            elif op == "$lte":
                if raw_val is None or raw_val > target:
                    return False
            elif op == "$regex":
                flags = re.IGNORECASE if "i" in cond.get("$options", "") else 0
                if not re.search(target, str(raw_val or ""), flags):
                    return False
            elif op == "$options":
                continue
        return True

    if isinstance(raw_val, list):
        return cond in raw_val
    return raw_val == cond or cond in values


def _matches_query(doc, query):
    if not query:
        return True
    for k, v in query.items():
        if k == "$and":
            if not all(_matches_query(doc, c) for c in v):
                return False
        elif k == "$or":
            if not any(_matches_query(doc, c) for c in v):
                return False
        else:
            if not _match_condition(doc, k, v):
                return False
    return True


class InMemoryCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, key_or_list, direction=None):
        specs = key_or_list if isinstance(key_or_list, list) else [(key_or_list, direction or 1)]
        for k, d in reversed(specs):
            def _key_fn(x, path=k):
                vals = _extract_values(x, path)
                v = vals[0] if vals else None
                if isinstance(v, datetime):
                    return (1, v.timestamp())
                if isinstance(v, (int, float)):
                    return (1, float(v))
                if v is None:
                    return (0, 0.0)
                return (2, str(v))
            self._docs.sort(key=_key_fn, reverse=(d == -1))
        return self

    def skip(self, n):
        self._docs = self._docs[n:]
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length=100):
        return self._docs[:length]

    def __aiter__(self):
        self._it = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._it)
        except StopIteration:
            raise StopAsyncIteration


class InMemoryCollection:
    def __init__(self):
        self.docs = []

    async def count_documents(self, query=None):
        return sum(1 for d in self.docs if _matches_query(d, query or {}))

    def find(self, query=None):
        matched = [dict(d) for d in self.docs if _matches_query(d, query or {})]
        return InMemoryCursor(matched)

    async def find_one(self, query):
        for d in self.docs:
            if _matches_query(d, query):
                return dict(d)
        return None

    async def insert_one(self, doc):
        new_doc = dict(doc)
        if "_id" not in new_doc:
            new_doc["_id"] = ObjectId()
        self.docs.append(new_doc)

        class Result:
            inserted_id = new_doc["_id"]

        return Result()

    async def insert_many(self, docs):
        for d in docs:
            await self.insert_one(d)

    async def update_one(self, query, update):
        for d in self.docs:
            if _matches_query(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                return

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            if _matches_query(d, query):
                self.docs.pop(i)
                return

    async def delete_many(self, query):
        self.docs = [d for d in self.docs if not _matches_query(d, query)]

    def aggregate(self, pipeline):
        matched = list(self.docs)
        grouped = {}
        for stage in pipeline:
            if "$match" in stage:
                matched = [d for d in matched if _matches_query(d, stage["$match"])]
            elif "$group" in stage:
                for d in matched:
                    status_val = d.get("status")
                    grouped[status_val] = grouped.get(status_val, 0) + 1
        result = [{"_id": k, "count": v} for k, v in grouped.items()]
        return InMemoryCursor(result)


class FakeDatabase:
    def __init__(self):
        self.users = InMemoryCollection()
        self.challenges = InMemoryCollection()
        self.teams = InMemoryCollection()
        self.proposals = InMemoryCollection()
        self.proposal_reviews = InMemoryCollection()
        self.proposal_status_history = InMemoryCollection()
        self.proposal_review_history = InMemoryCollection()
        self.proposal_documents = InMemoryCollection()
        self.notifications = InMemoryCollection()

    def __getattr__(self, name):
        col = InMemoryCollection()
        setattr(self, name, col)
        return col


def _complete_proposal_fields(challenge_id, **overrides):
    base = {
        "title": "HydroSense AI Water Quality Monitor",
        "challengeId": challenge_id,
        "problemUnderstanding": "Fluoride and arsenic contamination affects over 50 rural villages with no real-time alerts.",
        "proposedSolution": "Solar-powered IoT edge sensor nodes with TinyML anomaly detection and SMS alerts for panchayats.",
        "innovationUniqueness": "Self-calibrating low-cost optical + conductivity sensor array under Rs 3500.",
        "technicalApproach": "ESP32-S3 microcontroller, LoRaWAN mesh gateway, FastAPI backend, React dashboard.",
        "implementationPlan": "Phase 1 (Weeks 1-4): Lab calibration. Phase 2 (Weeks 5-8): 10-village pilot deployment.",
        "requiredResources": "Water testing lab access, 15 sensor kits, industry mentor in embedded systems.",
        "expectedImpact": "Provide safe drinking water early warnings to 50,000+ rural citizens.",
        "estimatedTimeline": "12 Weeks",
        "prototypeUrl": "https://figma.com/file/hydrosense-prototype",
        "githubUrl": "https://github.com/sociosolve/hydrosense-ai",
        "demoUrl": "https://demo.sociosolve.ai/hydrosense",
    }
    base.update(overrides)
    return base


def _valid_rubric_payload(score=8, *, submit_final=True, recommendation="accept", feedback="Solid technical architecture and strong measurable societal impact."):
    return {
        "criteriaScores": [
            {"key": c["key"], "label": c["label"], "score": score, "maxScore": 10, "comment": "Well done"}
            for c in DEFAULT_RUBRIC_CRITERIA
        ],
        "overallFeedback": feedback,
        "recommendation": recommendation,
        "submitFinal": submit_final,
    }


async def _seed_module2_and_3(fake_db, student, teammate, outsider, reviewer_uni, reviewer_ind, pending_uni, admin):
    now = datetime.now(timezone.utc)
    await fake_db.users.insert_many([student, teammate, outsider, reviewer_uni, reviewer_ind, pending_uni, admin])

    pub_res = await fake_db.challenges.insert_one({
        "title": "AI-Driven Clean Water Quality Monitoring",
        "category": "Environment & Water",
        "description": "Affordable water contamination detection for rural panchayats.",
        "location": "Gujarat",
        "status": "published",
        "isPublished": True,
        "deadline": "2026-12-15",
        "createdAt": now,
    })
    pub2_res = await fake_db.challenges.insert_one({
        "title": "Smart Campus Traffic Optimization",
        "category": "Smart Cities",
        "description": "Adaptive signal routing around hospitals and campuses.",
        "location": "Hyderabad",
        "status": "open",
        "isPublished": True,
        "deadline": "2026-12-20",
        "createdAt": now - timedelta(days=2),
    })
    draft_ch_res = await fake_db.challenges.insert_one({
        "title": "Internal Unpublished Challenge",
        "category": "Environment",
        "status": "draft",
        "isPublished": False,
        "createdAt": now,
    })

    # Module 3 canonical schema (ObjectId leader_id, members[].user_id, challenge_id)
    team_res = await fake_db.teams.insert_one({
        "name": "HydroGuardians",
        "description": "Water IoT innovation team",
        "challenge_id": pub_res.inserted_id,
        "leader_id": student["_id"],
        "members": [
            {"user_id": student["_id"], "role": "Team Leader", "joined_at": now},
            {"user_id": teammate["_id"], "role": "Member", "joined_at": now},
        ],
        "max_members": 6,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    })
    other_team_res = await fake_db.teams.insert_one({
        "name": "TrafficSquad",
        "description": "Other student's team on challenge 2",
        "challenge_id": pub2_res.inserted_id,
        "leader_id": outsider["_id"],
        "members": [
            {"user_id": outsider["_id"], "role": "Team Leader", "joined_at": now},
        ],
        "max_members": 6,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    })

    return {
        "pub_ch": str(pub_res.inserted_id),
        "pub_ch2": str(pub2_res.inserted_id),
        "draft_ch": str(draft_ch_res.inserted_id),
        "team_id": str(team_res.inserted_id),
        "other_team_id": str(other_team_res.inserted_id),
    }


def _make_users():
    return {
        "student": {
            "_id": ObjectId(),
            "firebase_uid": "fb_student",
            "name": "Gudiya Kumari",
            "email": "gudiya@university.edu",
            "role": "student",
            "approval_status": "approved",
            "is_active": True,
        },
        "teammate": {
            "_id": ObjectId(),
            "firebase_uid": "fb_teammate",
            "name": "Aakash Gupta",
            "email": "aakash@university.edu",
            "role": "university",  # Also has reviewer role to verify team-member self-review block!
            "approval_status": "approved",
            "is_active": True,
        },
        "outsider": {
            "_id": ObjectId(),
            "firebase_uid": "fb_outsider",
            "name": "Rahul Sharma",
            "email": "rahul@university.edu",
            "role": "student",
            "approval_status": "approved",
            "is_active": True,
        },
        "reviewer_uni": {
            "_id": ObjectId(),
            "firebase_uid": "fb_uni",
            "name": "Dr. Anita Verma",
            "email": "anita.verma@iit.ac.in",
            "role": "university",
            "approval_status": "approved",
            "is_active": True,
        },
        "reviewer_ind": {
            "_id": ObjectId(),
            "firebase_uid": "fb_ind",
            "name": "Vikram Mehta",
            "email": "vikram@techcorp.io",
            "role": "industry",
            "approval_status": "approved",
            "is_active": True,
        },
        "pending_uni": {
            "_id": ObjectId(),
            "firebase_uid": "fb_pending",
            "name": "Pending Faculty",
            "email": "pending@college.edu",
            "role": "university",
            "approval_status": "pending",
            "is_active": True,
        },
        "admin": {
            "_id": ObjectId(),
            "firebase_uid": "fb_admin",
            "name": "Platform Admin",
            "email": "admin@sociosolve.ai",
            "role": "admin",
            "approval_status": "approved",
            "is_active": True,
        },
    }


def test_module4_end_to_end_api_and_security():
    """Full HTTP + WebSocket test covering every Module 4 requirement and H1-H3, M1-M5, L1-L5."""
    from fastapi.testclient import TestClient
    from app.config import database as db_config
    from app.main import app
    from app.routes import dashboard_routes
    from app.utils import firebase_token, cloudinary_storage

    fake_db = FakeDatabase()
    users = _make_users()

    # Patch DB getter across modules and disable external cloud upload in unit tests
    orig_db = db_config.db
    orig_prop_get_db = proposal_service.get_database
    orig_dash_get_db = dashboard_routes.get_database
    orig_verify = firebase_token.verify_firebase_token
    orig_is_cloud = cloudinary_storage.is_cloudinary_configured

    db_config.db = fake_db
    proposal_service.get_database = lambda: fake_db
    dashboard_routes.get_database = lambda: fake_db
    cloudinary_storage.is_cloudinary_configured = lambda: False

    token_map = {
        f"tok_{k}": {"uid": u["firebase_uid"], "email": u["email"]}
        for k, u in users.items()
    }

    def fake_verify(tok: str):
        if tok not in token_map:
            raise HTTPException(status_code=401, detail="Invalid authentication token.")
        return token_map[tok]

    firebase_token.verify_firebase_token = fake_verify

    def hdr(role_key: str):
        return {"Authorization": f"Bearer tok_{role_key}"}

    try:
        client = TestClient(app)

        # ------------------------------------------------------------------
        # 1. L5: Empty db.challenges MUST NOT silently seed fake challenges
        # ------------------------------------------------------------------
        asyncio.run(fake_db.users.insert_one(users["student"]))
        r_empty = client.get("/api/proposals/challenges/published", headers=hdr("student"))
        assert r_empty.status_code == 200, r_empty.text
        assert r_empty.json()["challenges"] == []
        assert len(fake_db.challenges.docs) == 0, "Module 4 must NOT auto-seed fake challenges into MongoDB (L5)"
        fake_db.users.docs.clear()

        ids = asyncio.run(
            _seed_module2_and_3(
                fake_db,
                users["student"],
                users["teammate"],
                users["outsider"],
                users["reviewer_uni"],
                users["reviewer_ind"],
                users["pending_uni"],
                users["admin"],
            )
        )

        # ------------------------------------------------------------------
        # 2. Authentication & Rubric Criteria (1-10 scale, max 50)
        # ------------------------------------------------------------------
        assert client.get("/api/proposals").status_code == 401
        r_rubric = client.get("/api/proposals/rubric-criteria", headers=hdr("student"))
        assert r_rubric.status_code == 200
        rubric = r_rubric.json()
        assert rubric["maxTotalScore"] == 50
        assert rubric["minCriterionScore"] == 1
        assert rubric["maxCriterionScore"] == 10
        assert len(rubric["criteria"]) == 5
        assert [c["label"] for c in rubric["criteria"]] == [
            "Innovation and Originality",
            "Feasibility",
            "Technical Quality",
            "Societal Impact",
            "Sustainability and Scalability",
        ]

        # ------------------------------------------------------------------
        # 3. L5 & M2: Module 3 Team Lookup (ObjectId) & Membership Validation
        # ------------------------------------------------------------------
        r_teams = client.get("/api/proposals/teams/my-teams", headers=hdr("student"))
        assert r_teams.status_code == 200, r_teams.text
        my_teams = r_teams.json()["teams"]
        assert len(my_teams) == 1
        assert my_teams[0]["id"] == ids["team_id"]
        assert my_teams[0]["name"] == "HydroGuardians"
        assert len(my_teams[0]["members"]) == 2
        assert any(m["email"] == "aakash@university.edu" for m in my_teams[0]["members"])

        # Cannot link a Module 3 team you do NOT belong to (M2 -> 403)
        r_bad_team = client.post(
            "/api/proposals",
            headers=hdr("student"),
            json={"title": "Team Hijack Attempt", "challengeId": ids["pub_ch2"], "teamId": ids["other_team_id"]},
        )
        assert r_bad_team.status_code == 403, r_bad_team.text

        # Cannot link a team bound to a different challenge (400)
        r_wrong_ch_team = client.post(
            "/api/proposals",
            headers=hdr("student"),
            json={"title": "Wrong Challenge Team", "challengeId": ids["pub_ch2"], "teamId": ids["team_id"]},
        )
        assert r_wrong_ch_team.status_code == 400, r_wrong_ch_team.text

        # ------------------------------------------------------------------
        # 4. M5: Proposer Role & Pending Approval Validation
        # ------------------------------------------------------------------
        assert client.post(
            "/api/proposals",
            headers=hdr("reviewer_ind"),
            json={"title": "Industry Creating Proposal", "challengeId": ids["pub_ch"]},
        ).status_code == 403

        assert client.post(
            "/api/proposals",
            headers=hdr("pending_uni"),
            json={"title": "Pending Account Proposal", "challengeId": ids["pub_ch"]},
        ).status_code == 403

        # ------------------------------------------------------------------
        # 5. Unpublished Challenge Blocking & Invalid URL Rejection
        # ------------------------------------------------------------------
        assert client.post(
            "/api/proposals",
            headers=hdr("student"),
            json={"title": "Unpublished Challenge Test", "challengeId": ids["draft_ch"]},
        ).status_code == 400

        assert client.post(
            "/api/proposals",
            headers=hdr("student"),
            json={"title": "Bad URL Proposal", "challengeId": ids["pub_ch"], "prototypeUrl": "javascript:alert(1)"},
        ).status_code == 422

        # ------------------------------------------------------------------
        # 6. H2 + L1: Protected Supporting Document Upload & Access Control
        # ------------------------------------------------------------------
        # Reject bad extension
        r_bad_ext = client.post(
            "/api/proposals/upload-document",
            headers=hdr("student"),
            files={"file": ("malware.exe", b"MZ1234", "application/octet-stream")},
            data={"docType": "supporting_document"},
        )
        assert r_bad_ext.status_code == 400

        # Valid PDF upload -> returns absolute protected API URL (H2)
        pdf_bytes = b"%PDF-1.4 HydroSense technical architecture specification"
        r_up = client.post(
            "/api/proposals/upload-document",
            headers=hdr("student"),
            files={"file": ("../architecture plan.pdf", pdf_bytes, "application/pdf")},
            data={"docType": "architecture"},
        )
        assert r_up.status_code == 200, r_up.text
        uploaded_doc = r_up.json()
        assert uploaded_doc["docId"]
        assert uploaded_doc["url"].startswith("http://testserver/api/proposals/documents/")
        doc_path = f"/api/proposals/documents/{uploaded_doc['docId']}"

        # L1: Unauthenticated access blocked (401)
        assert client.get(doc_path).status_code == 401
        # L1: Public /uploads/proposals/* route is NOT exposed (404)
        stored_record = asyncio.run(fake_db.proposal_documents.find_one({"_id": ObjectId(uploaded_doc["docId"])}))
        assert client.get(f"/uploads/proposals/{stored_record['storedFilename']}").status_code == 404
        # L1: Unattached draft upload is private to uploader (outsider gets 403, uploader gets 200)
        assert client.get(doc_path, headers=hdr("outsider")).status_code == 403
        r_dl_owner = client.get(doc_path, headers=hdr("student"))
        assert r_dl_owner.status_code == 200
        assert r_dl_owner.content == pdf_bytes
        assert r_dl_owner.headers.get("x-content-type-options") == "nosniff"

        # ------------------------------------------------------------------
        # 7. Create Draft Proposal + M2 Email Consent Guard + Draft Privacy
        # ------------------------------------------------------------------
        r_draft = client.post(
            "/api/proposals",
            headers=hdr("student"),
            json={
                "title": "HydroSense Draft v1",
                "challengeId": ids["pub_ch"],
                "problemUnderstanding": "Short draft",
                "teamMembers": [
                    # Attempting to spoof outsider's email without Module 3 team membership (M2)
                    {"name": "Rahul Spoofed", "email": "rahul@university.edu", "roleInTeam": "Member"}
                ],
                "supportingDocuments": [uploaded_doc],
                "submitImmediately": False,
            },
        )
        assert r_draft.status_code == 201, r_draft.text
        draft_data = r_draft.json()
        proposal_id = draft_data["id"]
        assert draft_data["status"] == "draft"
        assert draft_data["proposalCode"].startswith("PROP-")

        # M2: Spoofed email MUST NOT give outsider draft view/edit/submit access or put it in /my
        assert client.get(f"/api/proposals/{proposal_id}", headers=hdr("outsider")).status_code == 403
        assert client.put(f"/api/proposals/{proposal_id}", headers=hdr("outsider"), json={"title": "Hijacked"}).status_code == 403
        assert client.get(doc_path, headers=hdr("outsider")).status_code == 403
        assert client.get("/api/proposals/my", headers=hdr("outsider")).json()["total"] == 0

        # Incomplete draft submission rejected (400)
        assert client.post(f"/api/proposals/{proposal_id}/submit", headers=hdr("student")).status_code == 400

        # Complete draft and link verified Module 3 team
        r_upd = client.put(
            f"/api/proposals/{proposal_id}",
            headers=hdr("student"),
            json=_complete_proposal_fields(
                ids["pub_ch"],
                teamId=ids["team_id"],
                supportingDocuments=[uploaded_doc],
            ),
        )
        assert r_upd.status_code == 200, r_upd.text
        assert r_upd.json()["teamId"] == ids["team_id"]
        assert str(users["teammate"]["_id"]) in r_upd.json()["verifiedMemberIds"]

        # Verified Module 3 teammate CAN view draft & download draft doc
        assert client.get(f"/api/proposals/{proposal_id}", headers=hdr("teammate")).status_code == 200
        assert client.get(doc_path, headers=hdr("teammate")).status_code == 200

        # ------------------------------------------------------------------
        # 8. Submit Draft -> L2 Notifications (Author + Teammate + Reviewers)
        # ------------------------------------------------------------------
        r_sub = client.post(f"/api/proposals/{proposal_id}/submit", headers=hdr("student"))
        assert r_sub.status_code == 200, r_sub.text
        assert r_sub.json()["status"] == "submitted"
        assert r_sub.json()["submittedAt"] is not None

        # L2: Author, verified teammate, AND approved reviewers all received notifications
        assert len(client.get("/api/proposals/notifications", headers=hdr("student")).json()["notifications"]) >= 1
        assert len(client.get("/api/proposals/notifications", headers=hdr("teammate")).json()["notifications"]) >= 1
        assert len(client.get("/api/proposals/notifications", headers=hdr("reviewer_uni")).json()["notifications"]) >= 1
        assert len(client.get("/api/proposals/notifications", headers=hdr("reviewer_ind")).json()["notifications"]) >= 1

        # Submitted proposal cannot be silently edited or deleted
        assert client.put(f"/api/proposals/{proposal_id}", headers=hdr("student"), json={"title": "Silent Edit"}).status_code == 400
        assert client.delete(f"/api/proposals/{proposal_id}", headers=hdr("student")).status_code == 400

        # ------------------------------------------------------------------
        # 9. M1: Withdraw -> Cannot Edit/Submit Directly -> Explicit Reopen -> Resubmit
        # ------------------------------------------------------------------
        r_with = client.post(
            f"/api/proposals/{proposal_id}/withdraw",
            headers=hdr("student"),
            json={"reason": "Revising field pilot budget."},
        )
        assert r_with.status_code == 200
        assert r_with.json()["status"] == "withdrawn"

        # M1: Direct edit or direct submit on withdrawn proposal is BLOCKED
        assert client.put(f"/api/proposals/{proposal_id}", headers=hdr("student"), json={"estimatedTimeline": "14 Weeks"}).status_code == 400
        assert client.post(f"/api/proposals/{proposal_id}/submit", headers=hdr("student")).status_code == 400

        # M1: Reopen withdrawn -> draft works, logs history, then edit & submit succeed
        r_reopen = client.post(
            f"/api/proposals/{proposal_id}/reopen",
            headers=hdr("student"),
            json={"reason": "Ready to revise and resubmit."},
        )
        assert r_reopen.status_code == 200, r_reopen.text
        assert r_reopen.json()["status"] == "draft"
        assert client.put(f"/api/proposals/{proposal_id}", headers=hdr("student"), json={"estimatedTimeline": "14 Weeks"}).status_code == 200
        assert client.post(f"/api/proposals/{proposal_id}/submit", headers=hdr("student")).status_code == 200

        # ------------------------------------------------------------------
        # 10. M4: Review Queue Protection & Team-Member Self-Review Exclusion
        # ------------------------------------------------------------------
        assert client.get("/api/proposals/review-queue", headers=hdr("student")).status_code == 403
        assert client.get("/api/proposals/review-queue", headers=hdr("pending_uni")).status_code == 403

        # Teammate has 'university' role, but MUST NOT see own team's proposal in review queue!
        q_teammate = client.get("/api/proposals/review-queue", headers=hdr("teammate"))
        assert q_teammate.status_code == 200
        assert all(item["id"] != proposal_id for item in q_teammate.json()["items"])

        # Approved independent reviewer DOES see it and can download attached document
        q_uni = client.get("/api/proposals/review-queue", headers=hdr("reviewer_uni"))
        assert q_uni.status_code == 200
        assert any(item["id"] == proposal_id for item in q_uni.json()["items"])
        assert client.get(doc_path, headers=hdr("reviewer_uni")).status_code == 200

        # ------------------------------------------------------------------
        # 11. H1 + M3 + Self-Review + Duplicate Review + H3 Decision Guard
        # ------------------------------------------------------------------
        # Self-review by verified team member blocked (403)
        assert client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("teammate"),
            json=_valid_rubric_payload(score=9, submit_final=True),
        ).status_code == 403

        # H1: Score > 10 rejected (422) and Score < 1 rejected (422)
        assert client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("reviewer_uni"),
            json=_valid_rubric_payload(score=15, submit_final=True),
        ).status_code == 422
        assert client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("reviewer_uni"),
            json=_valid_rubric_payload(score=0, submit_final=True),
        ).status_code == 422

        # H1: Missing criterion rejected (400)
        partial_payload = _valid_rubric_payload(score=8, submit_final=True)
        partial_payload["criteriaScores"] = partial_payload["criteriaScores"][:3]
        assert client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("reviewer_uni"),
            json=partial_payload,
        ).status_code == 400

        # H1: Unknown criterion key rejected (400)
        bad_key_payload = _valid_rubric_payload(score=8, submit_final=True)
        bad_key_payload["criteriaScores"][0]["key"] = "hacked_criterion"
        assert client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("reviewer_uni"),
            json=bad_key_payload,
        ).status_code == 400

        # M3: Saving review DRAFT must NOT change proposal status from 'submitted' -> 'under_review'!
        draft_rev_payload = _valid_rubric_payload(score=7, submit_final=False)
        # Try tampering maxScore & label (H1): backend MUST ignore them!
        for c in draft_rev_payload["criteriaScores"]:
            c["maxScore"] = 999
            c["label"] = "Tampered Label"

        r_rev_draft = client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("reviewer_uni"),
            json=draft_rev_payload,
        )
        assert r_rev_draft.status_code == 200, r_rev_draft.text
        assert r_rev_draft.json()["review"]["status"] == "draft"
        assert r_rev_draft.json()["review"]["maxTotalScore"] == RUBRIC_MAX_TOTAL_SCORE
        assert r_rev_draft.json()["review"]["totalScore"] == 35.0
        assert all(c["maxScore"] == 10 for c in r_rev_draft.json()["review"]["criteriaScores"])

        detail_after_draft_rev = client.get(f"/api/proposals/{proposal_id}", headers=hdr("student")).json()
        assert detail_after_draft_rev["status"] == "submitted", "M3: Draft review must NOT change proposal status!"
        assert len(detail_after_draft_rev["reviews"]) == 0, "Draft review must NOT be visible to author"
        assert len(detail_after_draft_rev["reviewHistory"]) == 0, "Draft review history must NOT leak to author"

        # H3: Move submitted -> under_review manually, then verify accept/reject fails with 0 submitted reviews!
        r_start_rev = client.post(
            f"/api/proposals/{proposal_id}/status",
            headers=hdr("reviewer_uni"),
            json={"toStatus": "under_review", "comment": "Starting formal evaluation."},
        )
        assert r_start_rev.status_code == 200
        assert r_start_rev.json()["status"] == "under_review"

        r_premature_accept = client.patch(
            f"/api/proposals/{proposal_id}/status",
            headers=hdr("reviewer_uni"),
            json={"toStatus": "accepted", "comment": "Trying to accept without submitted review."},
        )
        assert r_premature_accept.status_code == 400, "H3: Must require at least one submitted review before accept/reject"

        # Submit official review (converts draft -> submitted)
        r_rev_final = client.post(
            f"/api/proposals/{proposal_id}/review",
            headers=hdr("reviewer_uni"),
            json=_valid_rubric_payload(score=9, submit_final=True),
        )
        assert r_rev_final.status_code == 200, r_rev_final.text
        assert r_rev_final.json()["review"]["totalScore"] == 45.0
        assert r_rev_final.json()["review"]["averageScore"] == 9.0
        assert r_rev_final.json()["review"]["maxTotalScore"] == 50.0
        assert r_rev_final.json()["reviewSummary"]["totalScore"] == 45.0

        # Duplicate final review by same reviewer blocked (409 Conflict)
        r_dup_rev = client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("reviewer_uni"),
            json=_valid_rubric_payload(score=10, submit_final=True),
        )
        assert r_dup_rev.status_code == 409

        # Second independent reviewer (Industry) submits review -> summary averages 45 and 35 = 40.0
        r_rev_ind = client.post(
            f"/api/proposals/{proposal_id}/reviews",
            headers=hdr("reviewer_ind"),
            json=_valid_rubric_payload(score=7, submit_final=True, recommendation="accept"),
        )
        assert r_rev_ind.status_code == 200, r_rev_ind.text
        assert r_rev_ind.json()["reviewSummary"]["reviewCount"] == 2
        assert r_rev_ind.json()["reviewSummary"]["totalScore"] == 40.0
        assert r_rev_ind.json()["reviewSummary"]["averageScore"] == 8.0

        # Now accepting via PATCH /status succeeds (H3 satisfied)
        r_accept = client.patch(
            f"/api/proposals/{proposal_id}/status",
            headers=hdr("reviewer_uni"),
            json={"toStatus": "accepted", "comment": "Approved for pilot funding and incubation."},
        )
        assert r_accept.status_code == 200, r_accept.text
        accepted_detail = r_accept.json()
        assert accepted_detail["status"] == "accepted"
        assert accepted_detail["challenge"]["id"] == ids["pub_ch"]
        assert accepted_detail["team"]["id"] == ids["team_id"]
        assert len(accepted_detail["statusHistory"]) >= 5  # draft->submitted->withdrawn->draft->submitted->under_review->accepted

        # Cannot transition out of terminal 'accepted' state
        assert client.post(
            f"/api/proposals/{proposal_id}/status",
            headers=hdr("reviewer_uni"),
            json={"toStatus": "rejected", "comment": "Attempting invalid terminal reversal."},
        ).status_code == 400

        # ------------------------------------------------------------------
        # 12. L3 & L4: Dashboard Stats Consistency & Live Student Dashboard
        # ------------------------------------------------------------------
        # Create a second withdrawn proposal + a draft to verify L3 statusDistribution sums accurately
        r_p2 = client.post(
            "/api/proposals",
            headers=hdr("student"),
            json=_complete_proposal_fields(ids["pub_ch2"], title="Traffic AI Pilot", submitImmediately=True),
        )
        assert r_p2.status_code == 201
        p2_id = r_p2.json()["id"]
        assert client.post(f"/api/proposals/{p2_id}/withdraw", headers=hdr("student"), json={"reason": "Pausing"}).status_code == 200

        r_p3 = client.post(
            "/api/proposals",
            headers=hdr("student"),
            json={"title": "Draft Education Lab", "challengeId": ids["pub_ch2"], "submitImmediately": False},
        )
        assert r_p3.status_code == 201
        p3_id = r_p3.json()["id"]

        # L3: statusDistribution sums strictly to totalProposals including withdrawn
        stats_res = client.get("/api/proposals/dashboard-stats?scope=all", headers=hdr("student"))
        assert stats_res.status_code == 200
        stats = stats_res.json()
        assert stats["totalProposals"] == 3
        assert stats["acceptedProposals"] == 1
        assert stats["withdrawnProposals"] == 1
        assert stats["draftProposals"] == 1
        assert sum(item["count"] for item in stats["statusDistribution"]) == stats["totalProposals"]
        assert any(item["status"] == "withdrawn" and item["count"] == 1 for item in stats["statusDistribution"])
        assert stats["myProposalsStats"]["total"] == 3

        # Outsider MUST NOT see student's private draft or withdrawn proposal in dashboard stats!
        outsider_stats = client.get("/api/proposals/dashboard-stats?scope=all", headers=hdr("outsider")).json()
        assert outsider_stats["totalProposals"] == 1
        assert outsider_stats["acceptedProposals"] == 1
        assert outsider_stats["draftProposals"] == 0
        assert outsider_stats["withdrawnProposals"] == 0

        # L4: Student dashboard endpoint returns real MongoDB data (no hardcoded 3 / 2 / 7 / 340)
        stu_dash = client.get("/api/dashboard/student", headers=hdr("student"))
        assert stu_dash.status_code == 200, stu_dash.text
        dash_stats = stu_dash.json()["stats"]
        assert dash_stats["activeChallenges"] == 2
        assert dash_stats["teamProjects"] == 1
        assert dash_stats["proposalsSubmitted"] == 1
        assert dash_stats["totalMyProposals"] == 3
        assert dash_stats["acceptedProposals"] == 1
        assert dash_stats["pointsEarned"] == 40.0

        # ------------------------------------------------------------------
        # 13. Search, Filter, Date Range, Sort & Pagination
        # ------------------------------------------------------------------
        assert client.get("/api/proposals?search=HydroSense", headers=hdr("student")).json()["total"] == 1
        assert client.get(f"/api/proposals?search={draft_data['proposalCode']}", headers=hdr("student")).json()["total"] == 1
        assert client.get(f"/api/proposals?challengeId={ids['pub_ch2']}", headers=hdr("student")).json()["total"] == 2
        assert client.get("/api/proposals?status=accepted", headers=hdr("student")).json()["total"] == 1
        assert client.get("/api/proposals?dateFrom=not-a-date", headers=hdr("student")).status_code == 400
        r_page = client.get("/api/proposals?page=1&limit=1&sortBy=score_desc", headers=hdr("student")).json()
        assert r_page["total"] == 3
        assert r_page["totalPages"] == 3
        assert r_page["items"][0]["id"] == proposal_id

        # Delete draft p3
        assert client.delete(f"/api/proposals/{p3_id}", headers=hdr("student")).status_code == 200

        # ------------------------------------------------------------------
        # 14. Notifications Read + Real-Time WebSocket Channel
        # ------------------------------------------------------------------
        notifs = client.get("/api/proposals/notifications", headers=hdr("student")).json()["notifications"]
        assert len(notifs) >= 3
        nid = notifs[0]["id"]
        assert client.put(f"/api/proposals/notifications/{nid}/read", headers=hdr("outsider")).status_code == 404
        assert client.put(f"/api/proposals/notifications/{nid}/read", headers=hdr("student")).status_code == 200
        assert client.put("/api/proposals/notifications/read-all", headers=hdr("student")).status_code == 200

        # WebSocket authenticated connection + ping/pong + real-time notification push
        with client.websocket_connect("/api/proposals/ws/notifications?token=tok_student") as ws:
            hello = ws.receive_json()
            assert hello["event"] == "connected"
            ws.send_text("ping")
            assert ws.receive_json()["event"] == "pong"

        print("ALL MODULE 4 API, SECURITY, INTEGRATION & WEBSOCKET TESTS PASSED!")
    finally:
        db_config.db = orig_db
        proposal_service.get_database = orig_prop_get_db
        dashboard_routes.get_database = orig_dash_get_db
        firebase_token.verify_firebase_token = orig_verify
        cloudinary_storage.is_cloudinary_configured = orig_is_cloud
        # Clean up any local uploaded test files created during test
        for doc in fake_db.proposal_documents.docs:
            sp = doc.get("storagePath")
            if sp and os.path.isfile(sp):
                try:
                    os.remove(sp)
                except OSError:
                    pass


if __name__ == "__main__":
    test_module4_end_to_end_api_and_security()
