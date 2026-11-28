"""
Unit tests for Module 2: Societal Challenge Management domain model & Pydantic schemas.
Ensures zero live database or network requirement for pure schema/model tests,
while confirming complete compatibility with Module 4 proposal service expectations.
"""
import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.models.challenge import (
    ChallengeCategory,
    ChallengeStatus,
    ChallengeDifficulty,
    VALID_CHALLENGE_STATUS_TRANSITIONS,
    is_valid_status_transition,
    is_published_status,
    generate_challenge_code,
    new_challenge_document,
)
from app.schemas.challenge_schema import (
    ChallengeAttachmentSchema,
    ChallengeCreateRequest,
    ChallengeUpdateRequest,
    ChallengeStatusUpdateRequest,
    ChallengeResponse,
    ChallengeListResponse,
    challenge_to_response,
)


# ── Task 1: Domain Model Tests ───────────────────────────────────────────────

def test_valid_challenge_model_creation():
    """Verify that new_challenge_document produces a valid, complete MongoDB document."""
    doc = new_challenge_document(
        title="AI-Driven Clean Water Quality Monitoring",
        description="Design an affordable IoT + AI water quality monitoring system for rural communities.",
        category=ChallengeCategory.ENVIRONMENT_WATER,
        location="Ahmedabad, Gujarat",
        author_id="65f1a2b3c4d5e6f7a8b9c0d1",
        author_name="Priya Sharma",
        author_email="priya@example.com",
        author_role="citizen",
        difficulty=ChallengeDifficulty.MEDIUM,
        status=ChallengeStatus.PUBLISHED,
        expected_impact="Safe drinking water access for 50,000+ rural residents.",
        deadline="2026-12-31",
        tags=["water", "iot", "clean-water"],
        attachments=[{"name": "survey.pdf", "url": "/uploads/challenges/survey.pdf", "fileType": "pdf"}],
    )

    assert doc["title"] == "AI-Driven Clean Water Quality Monitoring"
    assert doc["category"] == "Environment & Water"
    assert doc["location"] == "Ahmedabad, Gujarat"
    assert doc["difficulty"] == "Medium"
    assert doc["status"] == "published"
    assert doc["isPublished"] is True
    assert doc["authorId"] == "65f1a2b3c4d5e6f7a8b9c0d1"
    assert doc["authorName"] == "Priya Sharma"
    assert doc["createdBy"] == "Priya Sharma"
    assert doc["proposalsCount"] == 0
    assert doc["viewsCount"] == 0
    assert doc["challengeCode"].startswith("CHAL-")
    assert isinstance(doc["createdAt"], datetime)
    assert isinstance(doc["updatedAt"], datetime)


def test_draft_challenge_is_not_published():
    """Verify that draft/submitted challenges have isPublished=False."""
    draft_doc = new_challenge_document(
        title="Draft Community Challenge",
        description="Work in progress problem statement that should not be visible for proposals.",
        category=ChallengeCategory.HEALTHCARE,
        location="Pune, Maharashtra",
        author_id="user123",
        author_name="Dr. Anil",
        status=ChallengeStatus.DRAFT,
    )
    assert draft_doc["status"] == "draft"
    assert draft_doc["isPublished"] is False
    assert is_published_status(draft_doc["status"]) is False

    sub_doc = new_challenge_document(
        title="Submitted Community Challenge",
        description="Pending review problem statement that is not yet published.",
        category=ChallengeCategory.EDUCATION,
        location="Bhopal, Madhya Pradesh",
        author_id="user456",
        author_name="Sunita Rao",
        status=ChallengeStatus.SUBMITTED,
    )
    assert sub_doc["status"] == "submitted"
    assert sub_doc["isPublished"] is False


def test_valid_status_transitions():
    """Verify allowable status transitions across challenge lifecycle."""
    # Draft can be submitted, published, or closed
    assert is_valid_status_transition(ChallengeStatus.DRAFT, ChallengeStatus.SUBMITTED) is True
    assert is_valid_status_transition(ChallengeStatus.DRAFT, ChallengeStatus.PUBLISHED) is True
    assert is_valid_status_transition(ChallengeStatus.DRAFT, ChallengeStatus.CLOSED) is True

    # Submitted can be published or returned to draft or closed
    assert is_valid_status_transition(ChallengeStatus.SUBMITTED, ChallengeStatus.PUBLISHED) is True
    assert is_valid_status_transition(ChallengeStatus.SUBMITTED, ChallengeStatus.DRAFT) is True

    # Published can move to in_progress or closed
    assert is_valid_status_transition(ChallengeStatus.PUBLISHED, ChallengeStatus.IN_PROGRESS) is True
    assert is_valid_status_transition(ChallengeStatus.PUBLISHED, ChallengeStatus.CLOSED) is True

    # In progress can be resolved or closed
    assert is_valid_status_transition(ChallengeStatus.IN_PROGRESS, ChallengeStatus.RESOLVED) is True

    # Self-transitions are always valid
    assert is_valid_status_transition(ChallengeStatus.PUBLISHED, ChallengeStatus.PUBLISHED) is True


def test_invalid_status_transitions():
    """Verify forbidden status transitions."""
    # Cannot jump from draft straight to in_progress or resolved
    assert is_valid_status_transition(ChallengeStatus.DRAFT, ChallengeStatus.IN_PROGRESS) is False
    assert is_valid_status_transition(ChallengeStatus.DRAFT, ChallengeStatus.RESOLVED) is False

    # Cannot jump from submitted straight to resolved
    assert is_valid_status_transition(ChallengeStatus.SUBMITTED, ChallengeStatus.RESOLVED) is False

    # Resolved cannot directly revert to draft
    assert is_valid_status_transition(ChallengeStatus.RESOLVED, ChallengeStatus.DRAFT) is False


def test_generate_challenge_code():
    """Verify that challenge reference codes follow CHAL-YEAR-HEX format."""
    code1 = generate_challenge_code()
    code2 = generate_challenge_code()
    year = str(datetime.now(timezone.utc).year)

    assert code1.startswith(f"CHAL-{year}-")
    assert code2.startswith(f"CHAL-{year}-")
    assert code1 != code2


# ── Task 2: Pydantic Schema Tests ────────────────────────────────────────────

def test_valid_challenge_create_request():
    """Verify valid payload parsing and validation for ChallengeCreateRequest."""
    payload = {
        "title": "Decentralized Solid Waste Segregation & Circular Recycling",
        "description": "Municipalities struggle with unsegregated household waste. Build a tracking system.",
        "category": "Waste Management",
        "location": "Indore, Madhya Pradesh",
        "difficulty": "Medium",
        "status": "submitted",
        "expectedImpact": "Increase segregation compliance to 85%.",
        "deadline": "2026-12-15",
        "tags": ["waste", "recycling", "municipal"],
        "attachments": [
            {
                "name": "baseline_data.pdf",
                "url": "https://res.cloudinary.com/demo/image/upload/sample.pdf",
                "fileType": "pdf",
                "sizeBytes": 204800,
            }
        ],
    }
    req = ChallengeCreateRequest(**payload)
    assert req.title == "Decentralized Solid Waste Segregation & Circular Recycling"
    assert req.category == ChallengeCategory.WASTE_MANAGEMENT
    assert req.difficulty == ChallengeDifficulty.MEDIUM
    assert req.location == "Indore, Madhya Pradesh"
    assert len(req.attachments) == 1
    assert req.attachments[0].name == "baseline_data.pdf"


def test_missing_required_fields():
    """Verify validation errors when required fields are missing."""
    # Missing title
    with pytest.raises(ValidationError) as exc:
        ChallengeCreateRequest(
            description="A detailed description of the community problem requiring a solution.",
            category=ChallengeCategory.HEALTHCARE,
            location="Jaipur, Rajasthan",
        )
    assert "title" in str(exc.value)

    # Missing description
    with pytest.raises(ValidationError) as exc:
        ChallengeCreateRequest(
            title="Tele-diagnostic Triage Kit",
            category=ChallengeCategory.HEALTHCARE,
            location="Jaipur, Rajasthan",
        )
    assert "description" in str(exc.value)

    # Missing category
    with pytest.raises(ValidationError) as exc:
        ChallengeCreateRequest(
            title="Tele-diagnostic Triage Kit",
            description="A detailed description of the community problem requiring a solution.",
            location="Jaipur, Rajasthan",
        )
    assert "category" in str(exc.value)

    # Missing location
    with pytest.raises(ValidationError) as exc:
        ChallengeCreateRequest(
            title="Tele-diagnostic Triage Kit",
            description="A detailed description of the community problem requiring a solution.",
            category=ChallengeCategory.HEALTHCARE,
        )
    assert "location" in str(exc.value)


def test_short_field_lengths():
    """Verify string length bounds (title min 5 chars, description min 20 chars)."""
    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="Tiny",  # < 5 chars
            description="A sufficiently long description of the societal problem.",
            category=ChallengeCategory.HEALTHCARE,
            location="Jaipur, Rajasthan",
        )

    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="Adequate Title",
            description="Too short",  # < 20 chars
            category=ChallengeCategory.HEALTHCARE,
            location="Jaipur, Rajasthan",
        )


def test_whitespace_only_fields():
    """Verify whitespace-only strings fail validation."""
    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="     ",
            description="A sufficiently long description of the societal problem.",
            category=ChallengeCategory.HEALTHCARE,
            location="Jaipur, Rajasthan",
        )

    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="Adequate Title",
            description="A sufficiently long description of the societal problem.",
            category=ChallengeCategory.HEALTHCARE,
            location="   ",
        )


def test_invalid_category():
    """Verify rejection of unknown or invalid categories."""
    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="Valid Challenge Title",
            description="A sufficiently long description of the societal problem.",
            category="QuantumComputing",  # Invalid
            location="Bengaluru, Karnataka",
        )


def test_invalid_difficulty():
    """Verify rejection of invalid difficulty levels."""
    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="Valid Challenge Title",
            description="A sufficiently long description of the societal problem.",
            category=ChallengeCategory.EDUCATION,
            location="Bengaluru, Karnataka",
            difficulty="Extreme",  # Invalid
        )


def test_invalid_status_on_create():
    """Verify that initial creation status can only be draft, submitted, or published."""
    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="Valid Challenge Title",
            description="A sufficiently long description of the societal problem.",
            category=ChallengeCategory.EDUCATION,
            location="Bengaluru, Karnataka",
            status=ChallengeStatus.RESOLVED,  # Cannot create directly as resolved
        )


def test_attachment_url_validation():
    """Verify attachment URLs must begin with http://, https://, or /uploads/."""
    # Valid HTTPS
    att1 = ChallengeAttachmentSchema(name="doc.pdf", url="https://storage.googleapis.com/test.pdf")
    assert att1.url.startswith("https://")

    # Valid local upload
    att2 = ChallengeAttachmentSchema(name="photo.jpg", url="/uploads/challenges/abc.jpg")
    assert att2.url.startswith("/uploads/")

    # Invalid URL scheme
    with pytest.raises(ValidationError):
        ChallengeAttachmentSchema(name="bad.exe", url="ftp://malicious.site/payload.exe")

    # Empty name
    with pytest.raises(ValidationError):
        ChallengeAttachmentSchema(name="  ", url="https://example.com/file.pdf")


def test_forbid_extra_fields():
    """Verify extra/unexpected fields are rejected to prevent parameter pollution."""
    with pytest.raises(ValidationError):
        ChallengeCreateRequest(
            title="Valid Challenge Title",
            description="A sufficiently long description of the societal problem.",
            category=ChallengeCategory.EDUCATION,
            location="Bengaluru, Karnataka",
            isAdmin=True,  # Extra unexpected field
        )


def test_status_update_request():
    """Verify ChallengeStatusUpdateRequest parsing."""
    req = ChallengeStatusUpdateRequest(
        status=ChallengeStatus.IN_PROGRESS,
        reason="Solution proposal selected and team actively developing prototype.",
    )
    assert req.status == ChallengeStatus.IN_PROGRESS
    assert "prototype" in req.reason


# ── Module 4 Compatibility & Response Serialization Tests ───────────────────

def test_module4_seed_challenge_compatibility():
    """
    Verify that existing seed challenges created by Module 4's ensure_seed_challenges()
    can be serialized into ChallengeResponse and satisfy Module 4 validation.
    """
    now = datetime.now(timezone.utc)
    seed_challenge = {
        "_id": "6745f1a2b3c4d5e6f7a8b9c0",
        "title": "AI-Driven Clean Water Quality Monitoring for Rural Villages",
        "category": "Environment & Water",
        "description": (
            "Rural communities face severe contamination of groundwater and surface water supplies. "
            "Design an affordable IoT + AI water quality monitoring and early-warning system that "
            "local panchayats and university labs can deploy and maintain."
        ),
        "location": "Ahmedabad & Sabarkantha, Gujarat",
        "difficulty": "Medium",
        "status": "published",
        "isPublished": True,
        "deadline": "2026-12-15",
        "expectedImpact": "Safe drinking water access for 50,000+ rural residents.",
        "createdBy": "Civic Water Mission NGO",
        "createdAt": now,
        "updatedAt": now,
    }

    # Verify serialization into ChallengeResponse
    res = challenge_to_response(seed_challenge)
    assert res.id == "6745f1a2b3c4d5e6f7a8b9c0"
    assert res.title == seed_challenge["title"]
    assert res.category == "Environment & Water"
    assert res.status == "published"
    assert res.isPublished is True
    assert res.createdBy == "Civic Water Mission NGO"

    # Verify Module 4's exact validation logic passes on this response
    ch_status = str(res.status).lower()
    is_published = res.isPublished
    is_eligible_for_proposals = (
        ch_status not in {"draft", "closed", "archived", "inactive", "unpublished"}
        and is_published is True
    )
    assert is_eligible_for_proposals is True


# ── Phase 2: Service & API Integration Tests ─────────────────────────────────
import asyncio
from io import BytesIO
from bson import ObjectId
from fastapi import UploadFile, HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.config import database as db_config
from app.middleware.auth_middleware import get_current_user, require_active_user
from app.services import challenge_service, proposal_service


class InMemoryCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                self._docs.sort(
                    key=lambda x: str(self._get_nested(x, k) or ""),
                    reverse=(d == -1),
                )
        else:
            self._docs.sort(
                key=lambda x: str(self._get_nested(x, key_or_list) or ""),
                reverse=(direction == -1),
            )
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

    @staticmethod
    def _get_nested(doc, path):
        cur = doc
        for part in path.split("."):
            if isinstance(cur, dict):
                cur = cur.get(part)
            else:
                return None
        return cur


class InMemoryCollection:
    def __init__(self):
        self.docs = []

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                if not any(self._matches(doc, cond) for cond in v):
                    return False
            elif k == "$and":
                if not all(self._matches(doc, cond) for cond in v):
                    return False
            else:
                val = doc.get(k)
                if isinstance(v, dict):
                    if "$ne" in v and val == v["$ne"]:
                        return False
                    if "$regex" in v:
                        import re
                        flags = re.IGNORECASE if "i" in v.get("$options", "") else 0
                        if isinstance(val, list):
                            if not any(re.search(v["$regex"], str(item or ""), flags) for item in val):
                                return False
                        else:
                            if not re.search(v["$regex"], str(val or ""), flags):
                                return False
                else:
                    if val != v:
                        return False
        return True

    async def count_documents(self, query):
        return sum(1 for d in self.docs if self._matches(d, query))

    def find(self, query=None):
        matched = [dict(d) for d in self.docs if self._matches(d, query or {})]
        return InMemoryCursor(matched)

    async def find_one(self, query):
        for d in self.docs:
            if self._matches(d, query):
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
            if self._matches(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                if "$inc" in update:
                    for k, inc_val in update["$inc"].items():
                        d[k] = d.get(k, 0) + inc_val
                return

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            if self._matches(d, query):
                self.docs.pop(i)
                return

    def aggregate(self, pipeline):
        counts = {}
        match_stage = None
        for stage in pipeline:
            if "$match" in stage:
                match_stage = stage["$match"]
            elif "$group" in stage:
                field = stage["$group"]["_id"].lstrip("$")
                for d in self.docs:
                    if self._matches(d, match_stage or {}):
                        key = d.get(field)
                        counts[key] = counts.get(key, 0) + 1
        docs = [{"_id": k, "count": v} for k, v in counts.items()]
        return InMemoryCursor(docs)


class InMemoryDB:
    def __init__(self):
        self.challenges = InMemoryCollection()
        self.users = InMemoryCollection()
        self.proposals = InMemoryCollection()
        self.teams = InMemoryCollection()


def test_challenge_services_workflow():
    """Verify all Module 2 service operations in an end-to-end workflow."""
    async def _run():
        db = InMemoryDB()
        challenge_service.get_database = lambda: db
        db_config.get_database = lambda: db
        proposal_service.get_database = lambda: db

        citizen_user = {
            "_id": ObjectId("6745f1a2b3c4d5e6f7a8b901"),
            "name": "Citizen User",
            "email": "citizen@example.com",
            "role": "citizen",
            "is_active": True,
        }
        student_user = {
            "_id": ObjectId("6745f1a2b3c4d5e6f7a8b902"),
            "name": "Student User",
            "email": "student@example.com",
            "role": "student",
            "is_active": True,
        }
        admin_user = {
            "_id": ObjectId("6745f1a2b3c4d5e6f7a8b999"),
            "name": "Admin User",
            "email": "admin@example.com",
            "role": "admin",
            "is_active": True,
        }

        # 1. Create submitted challenge
        req_sub = ChallengeCreateRequest(
            title="Urban Flood Drainage Warning System",
            description="Low-lying areas face severe waterlogging during monsoons. Need sensors and alert system.",
            category=ChallengeCategory.ENVIRONMENT_WATER,
            location="Surat, Gujarat",
            difficulty=ChallengeDifficulty.MEDIUM,
            status=ChallengeStatus.SUBMITTED,
            expectedImpact="Reduce flood damage for 25,000 residents.",
            tags=["flood", "iot", "drainage"],
        )
        sub_res = await challenge_service.create_challenge(req_sub, citizen_user)
        assert sub_res.title == req_sub.title
        assert sub_res.authorId == str(citizen_user["_id"])
        assert sub_res.status == "submitted"
        assert sub_res.isPublished is False

        # 2. Create draft challenge
        req_draft = ChallengeCreateRequest(
            title="Draft Smart Waste Sorter Proposal",
            description="Preliminary notes on automated domestic waste sorting and recycling incentives.",
            category=ChallengeCategory.WASTE_MANAGEMENT,
            location="Indore, Madhya Pradesh",
            status=ChallengeStatus.DRAFT,
        )
        draft_res = await challenge_service.create_challenge(req_draft, citizen_user)
        assert draft_res.status == "draft"
        assert draft_res.isPublished is False

        # 3. Create published challenge
        req_pub = ChallengeCreateRequest(
            title="Primary Healthcare Tele-triage Station",
            description="Remotely connect rural health sub-centers to district hospital specialists.",
            category=ChallengeCategory.HEALTHCARE,
            location="Ranchi, Jharkhand",
            status=ChallengeStatus.PUBLISHED,
        )
        pub_res = await challenge_service.create_challenge(req_pub, citizen_user)
        assert pub_res.status == "published"
        assert pub_res.isPublished is True

        # 4. Public discovery excludes drafts
        public_list = await challenge_service.get_challenges(current_user=None)
        assert not any(c.status == "draft" for c in public_list.challenges)

        # 5. My challenges shows author drafts
        my_list = await challenge_service.get_my_challenges(citizen_user)
        assert any(c.status == "draft" for c in my_list.challenges)

        # 6. View details & view count increment
        view1 = await challenge_service.get_challenge_by_id(pub_res.id, student_user)
        assert view1.viewsCount == 1
        view2 = await challenge_service.get_challenge_by_id(pub_res.id, student_user)
        assert view2.viewsCount == 2

        # 7. Draft hidden from non-author
        try:
            await challenge_service.get_challenge_by_id(draft_res.id, student_user)
            assert False, "Should have raised 404 for stranger viewing draft"
        except HTTPException as exc:
            assert exc.status_code == 404

        # 8. Search and filter
        search_res = await challenge_service.get_challenges(search="Tele-triage")
        assert search_res.total == 1
        assert "Healthcare" in search_res.challenges[0].category

        cat_res = await challenge_service.get_challenges(category="Healthcare")
        assert cat_res.total == 1

        loc_res = await challenge_service.get_challenges(location="Ranchi")
        assert loc_res.total == 1

        # 9. Update permissions
        # Stranger updating fails (403)
        try:
            await challenge_service.update_challenge(
                pub_res.id,
                ChallengeUpdateRequest(title="Hacked Title By Stranger"),
                student_user,
            )
            assert False, "Stranger should not be allowed to update"
        except HTTPException as exc:
            assert exc.status_code == 403

        # Author update succeeds
        upd_res = await challenge_service.update_challenge(
            pub_res.id,
            ChallengeUpdateRequest(title="Primary Healthcare Tele-triage Station (Updated)"),
            citizen_user,
        )
        assert "Updated" in upd_res.title

        # 10. Status lifecycle transitions
        # Author withdraws submitted -> draft
        withdrawn = await challenge_service.update_challenge_status(
            sub_res.id,
            ChallengeStatusUpdateRequest(status=ChallengeStatus.DRAFT, reason="Need more data"),
            citizen_user,
        )
        assert withdrawn.status == "draft"

        # Author can publish directly
        author_pub = await challenge_service.update_challenge_status(
            sub_res.id,
            ChallengeStatusUpdateRequest(status=ChallengeStatus.PUBLISHED),
            citizen_user,
        )
        assert author_pub.status == "published"
        assert author_pub.isPublished is True

        # Admin can publish
        admin_pub = await challenge_service.update_challenge_status(
            sub_res.id,
            ChallengeStatusUpdateRequest(status=ChallengeStatus.PUBLISHED),
            admin_user,
        )
        assert admin_pub.status == "published"
        assert admin_pub.isPublished is True

        # 11. Delete dependency protection
        # Link proposal
        await db.proposals.insert_one({"challengeId": pub_res.id, "title": "Test Proposal"})
        try:
            await challenge_service.delete_challenge(pub_res.id, citizen_user)
            assert False, "Should have blocked deletion with proposal attached"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "proposal" in exc.detail.lower()

        # Clear proposal and delete succeeds
        await db.proposals.delete_one({"challengeId": pub_res.id})
        del_res = await challenge_service.delete_challenge(pub_res.id, citizen_user)
        assert del_res["message"] == "Challenge deleted successfully."

        # 12. Module 4 integration test
        val = await proposal_service.get_published_challenge_or_400(db, sub_res.id)
        assert val["id"] == sub_res.id
        assert val["isPublished"] is True

    asyncio.run(_run())


def test_challenge_fastapi_client_endpoints(monkeypatch):
    """Test all /api/challenges endpoints via FastAPI TestClient."""
    db = InMemoryDB()
    challenge_service.get_database = lambda: db
    db_config.get_database = lambda: db
    monkeypatch.setattr("app.utils.cloudinary_storage.is_cloudinary_configured", lambda: False)

    citizen_user = {
        "_id": ObjectId("6745f1a2b3c4d5e6f7a8b901"),
        "name": "Citizen User",
        "email": "citizen@example.com",
        "role": "citizen",
        "is_active": True,
    }

    app.dependency_overrides[require_active_user] = lambda: citizen_user
    app.dependency_overrides[get_current_user] = lambda: citizen_user

    client = TestClient(app)

    # 1. POST /api/challenges (Create)
    res_create = client.post(
        "/api/challenges",
        json={
            "title": "Clean Water IoT Sorter",
            "description": "Sensors and analytics for village water filtration units across the district.",
            "category": "Environment & Water",
            "location": "Ahmedabad, Gujarat",
            "difficulty": "Medium",
            "status": "published",
        },
    )
    assert res_create.status_code == 201, res_create.text
    ch_data = res_create.json()
    assert ch_data["title"] == "Clean Water IoT Sorter"
    ch_id = ch_data["id"]

    # 2. GET /api/challenges (Discovery)
    res_list = client.get("/api/challenges?page=1&limit=10")
    assert res_list.status_code == 200
    assert res_list.json()["total"] >= 1

    # 3. GET /api/challenges/my
    res_my = client.get("/api/challenges/my?page=1&limit=10")
    assert res_my.status_code == 200
    assert res_my.json()["total"] >= 1

    # 4. GET /api/challenges/categories
    res_cats = client.get("/api/challenges/categories")
    assert res_cats.status_code == 200
    assert res_cats.json()["totalCategories"] >= 1

    # 5. GET /api/challenges/{id}
    res_details = client.get(f"/api/challenges/{ch_id}")
    assert res_details.status_code == 200
    assert res_details.json()["id"] == ch_id

    # 6. PUT /api/challenges/{id}
    res_upd = client.put(f"/api/challenges/{ch_id}", json={"location": "Surat, Gujarat"})
    assert res_upd.status_code == 200
    assert res_upd.json()["location"] == "Surat, Gujarat"

    # 7. POST /api/challenges/upload-attachment
    file_bytes = b"%PDF-1.4 Mock challenge survey document"
    res_upload = client.post(
        "/api/challenges/upload-attachment",
        files={"file": ("survey.pdf", file_bytes, "application/pdf")},
    )
    assert res_upload.status_code == 200
    assert res_upload.json()["name"] == "survey.pdf"

    # 8. DELETE /api/challenges/{id}
    res_del = client.delete(f"/api/challenges/{ch_id}")
    assert res_del.status_code == 200

    app.dependency_overrides.clear()


def test_challenge_security_and_error_handling():
    """Verify security boundaries, role permissions, and HTTP error handling."""
    db = InMemoryDB()
    challenge_service.get_database = lambda: db
    db_config.get_database = lambda: db

    citizen_user = {
        "_id": ObjectId("6745f1a2b3c4d5e6f7a8b901"),
        "name": "Citizen User",
        "email": "citizen@example.com",
        "role": "citizen",
        "is_active": True,
    }
    stranger_user = {
        "_id": ObjectId("6745f1a2b3c4d5e6f7a8b902"),
        "name": "Stranger User",
        "email": "stranger@example.com",
        "role": "student",
        "is_active": True,
    }
    admin_user = {
        "_id": ObjectId("6745f1a2b3c4d5e6f7a8b999"),
        "name": "Admin User",
        "email": "admin@example.com",
        "role": "admin",
        "is_active": True,
    }

    client = TestClient(app)

    # 1. 401 Unauthorized: Calling POST without authentication
    res_unauth_post = client.post(
        "/api/challenges",
        json={
            "title": "Unauthenticated Challenge",
            "description": "Should fail with 401 or 403 because no Bearer token provided.",
            "category": "Healthcare",
            "location": "Delhi",
        },
    )
    assert res_unauth_post.status_code in {401, 403}

    # 2. 401 Unauthorized: Calling GET /api/challenges/my without authentication
    res_unauth_my = client.get("/api/challenges/my")
    assert res_unauth_my.status_code in {401, 403}

    # Authenticate as citizen
    app.dependency_overrides[require_active_user] = lambda: citizen_user
    app.dependency_overrides[get_current_user] = lambda: citizen_user

    # 3. 422 Validation Error: Title too short (<5 chars)
    res_short_title = client.post(
        "/api/challenges",
        json={
            "title": "Hi",
            "description": "Description long enough to satisfy constraint but title too short.",
            "category": "Healthcare",
            "location": "Mumbai",
        },
    )
    assert res_short_title.status_code == 422

    # 4. 422 Validation Error: Description too short (<20 chars)
    res_short_desc = client.post(
        "/api/challenges",
        json={
            "title": "Valid Challenge Title Here",
            "description": "Too short",
            "category": "Healthcare",
            "location": "Mumbai",
        },
    )
    assert res_short_desc.status_code == 422

    # Create valid challenge
    res_created = client.post(
        "/api/challenges",
        json={
            "title": "Solar Powered Cold Storage Units",
            "description": "Prevent post-harvest crop spoilage for smallholder tomato farmers.",
            "category": "Agriculture",
            "location": "Nashik, Maharashtra",
            "status": "submitted",
        },
    )
    assert res_created.status_code == 201
    ch_id = res_created.json()["id"]

    # 5. 404 Not Found on invalid ID
    res_not_found = client.get("/api/challenges/6745f1a2b3c4d5e6f7a8b999")
    assert res_not_found.status_code == 404

    # Switch identity to Stranger
    app.dependency_overrides[require_active_user] = lambda: stranger_user
    app.dependency_overrides[get_current_user] = lambda: stranger_user

    # 6. 403 Forbidden: Stranger tries to update citizen's challenge
    res_forbidden_put = client.put(
        f"/api/challenges/{ch_id}",
        json={"title": "Hacked Title Attempt"},
    )
    assert res_forbidden_put.status_code == 403

    # 7. 403 Forbidden: Stranger tries to delete citizen's challenge
    res_forbidden_del = client.delete(f"/api/challenges/{ch_id}")
    assert res_forbidden_del.status_code == 403

    # Switch identity to Admin
    app.dependency_overrides[require_active_user] = lambda: admin_user
    app.dependency_overrides[get_current_user] = lambda: admin_user

    # 8. Admin can transition status to published
    res_admin_status = client.patch(
        f"/api/challenges/{ch_id}/status",
        json={"status": "published", "reason": "Verified community submission"},
    )
    assert res_admin_status.status_code == 200
    assert res_admin_status.json()["status"] == "published"
    assert res_admin_status.json()["isPublished"] is True

    # 9. Anonymous public user can discover the published challenge
    app.dependency_overrides.clear()
    res_public = client.get(f"/api/challenges/{ch_id}")
    assert res_public.status_code == 200
    assert res_public.json()["id"] == ch_id


