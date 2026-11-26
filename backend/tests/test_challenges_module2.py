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

from io import BytesIO
from bson import ObjectId
from fastapi import UploadFile
from app.services import challenge_service
from app.services import proposal_service


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
                        # support regex matching over string or list of strings (tags)
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
        # basic group by for categories
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


@pytest.fixture
def mock_db(monkeypatch):
    db = InMemoryDB()
    monkeypatch.setattr(challenge_service, "get_database", lambda: db)
    monkeypatch.setattr(proposal_service, "get_database", lambda: db)
    return db


@pytest.fixture
def citizen_user():
    return {
        "_id": ObjectId("6745f1a2b3c4d5e6f7a8b901"),
        "name": "Citizen User",
        "email": "citizen@example.com",
        "role": "citizen",
        "is_active": True,
    }


@pytest.fixture
def student_user():
    return {
        "_id": ObjectId("6745f1a2b3c4d5e6f7a8b902"),
        "name": "Student User",
        "email": "student@example.com",
        "role": "student",
        "is_active": True,
    }


@pytest.fixture
def admin_user():
    return {
        "_id": ObjectId("6745f1a2b3c4d5e6f7a8b999"),
        "name": "Admin User",
        "email": "admin@example.com",
        "role": "admin",
        "is_active": True,
    }


@pytest.mark.anyio
async def test_service_create_challenge_submitted(mock_db, citizen_user):
    """Test creating a submitted challenge via service."""
    req = ChallengeCreateRequest(
        title="Urban Flood Drainage Warning System",
        description="Low-lying areas face severe waterlogging during monsoons. Need sensors and alert system.",
        category=ChallengeCategory.ENVIRONMENT_WATER,
        location="Surat, Gujarat",
        difficulty=ChallengeDifficulty.MEDIUM,
        status=ChallengeStatus.SUBMITTED,
        expectedImpact="Reduce flood damage for 25,000 residents.",
        tags=["flood", "iot", "drainage"],
    )

    res = await challenge_service.create_challenge(req, citizen_user)
    assert res.id is not None
    assert res.title == req.title
    assert res.authorId == str(citizen_user["_id"])
    assert res.authorName == citizen_user["name"]
    assert res.authorEmail == citizen_user["email"]
    assert res.status == "submitted"
    assert res.isPublished is False

    # Check stored document
    stored = await mock_db.challenges.find_one({"_id": ObjectId(res.id)})
    assert stored is not None
    assert stored["authorId"] == str(citizen_user["_id"])


@pytest.mark.anyio
async def test_service_create_challenge_draft(mock_db, citizen_user):
    """Test saving a challenge as a draft."""
    req = ChallengeCreateRequest(
        title="Draft Smart Waste Sorter Proposal",
        description="Preliminary notes on automated domestic waste sorting and recycling incentives.",
        category=ChallengeCategory.WASTE_MANAGEMENT,
        location="Indore, Madhya Pradesh",
        status=ChallengeStatus.DRAFT,
    )
    res = await challenge_service.create_challenge(req, citizen_user)
    assert res.status == "draft"
    assert res.isPublished is False


@pytest.mark.anyio
async def test_service_create_challenge_published(mock_db, citizen_user):
    """Test creating a published challenge directly."""
    req = ChallengeCreateRequest(
        title="Primary Healthcare Tele-triage Station",
        description="Remotely connect rural health sub-centers to district hospital specialists.",
        category=ChallengeCategory.HEALTHCARE,
        location="Ranchi, Jharkhand",
        status=ChallengeStatus.PUBLISHED,
    )
    res = await challenge_service.create_challenge(req, citizen_user)
    assert res.status == "published"
    assert res.isPublished is True


@pytest.mark.anyio
async def test_service_discovery_hides_drafts_from_public(mock_db, citizen_user, student_user):
    """Verify that public challenge discovery excludes draft challenges."""
    # 1. Create a published challenge
    req1 = ChallengeCreateRequest(
        title="Clean Energy Microgrid for Remote Hamlets",
        description="Provide hybrid solar-battery power to tribal villages with zero grid connectivity.",
        category=ChallengeCategory.RENEWABLE_ENERGY,
        location="Leh, Ladakh",
        status=ChallengeStatus.PUBLISHED,
    )
    await challenge_service.create_challenge(req1, citizen_user)

    # 2. Create a draft challenge
    req2 = ChallengeCreateRequest(
        title="Unpublished Draft Healthcare Study",
        description="Private draft document that is not ready for student proposals or public view.",
        category=ChallengeCategory.HEALTHCARE,
        location="Pune, Maharashtra",
        status=ChallengeStatus.DRAFT,
    )
    await challenge_service.create_challenge(req2, citizen_user)

    # Public visitor (current_user=None)
    public_list = await challenge_service.get_challenges(current_user=None)
    assert public_list.total == 1
    assert public_list.challenges[0].title == req1.title

    # Student user (current_user=student_user)
    student_list = await challenge_service.get_challenges(current_user=student_user)
    assert student_list.total == 1
    assert student_list.challenges[0].title == req1.title


@pytest.mark.anyio
async def test_service_my_challenges_shows_author_drafts(mock_db, citizen_user):
    """Verify authors can see their own drafts via get_my_challenges."""
    req_draft = ChallengeCreateRequest(
        title="Author's Private Draft Challenge",
        description="Confidential notes on agricultural crop disease detection using phone cameras.",
        category=ChallengeCategory.AGRICULTURE,
        location="Nagpur, Maharashtra",
        status=ChallengeStatus.DRAFT,
    )
    await challenge_service.create_challenge(req_draft, citizen_user)

    my_list = await challenge_service.get_my_challenges(citizen_user)
    assert my_list.total == 1
    assert my_list.challenges[0].status == "draft"


@pytest.mark.anyio
async def test_service_get_challenge_details_and_view_count(mock_db, citizen_user, student_user):
    """Verify get_challenge_by_id returns complete details and increments view count."""
    req = ChallengeCreateRequest(
        title="Adaptive Traffic Signal Optimization",
        description="Use edge cameras and AI models to adjust traffic light durations dynamically.",
        category=ChallengeCategory.SMART_CITIES_MOBILITY,
        location="Hyderabad, Telangana",
        status=ChallengeStatus.PUBLISHED,
    )
    created = await challenge_service.create_challenge(req, citizen_user)

    # First view
    details1 = await challenge_service.get_challenge_by_id(created.id, student_user)
    assert details1.id == created.id
    assert details1.viewsCount == 1

    # Second view
    details2 = await challenge_service.get_challenge_by_id(created.id, student_user)
    assert details2.viewsCount == 2


@pytest.mark.anyio
async def test_service_draft_hidden_from_non_author_details(mock_db, citizen_user, student_user):
    """Verify attempting to view a draft challenge directly raises 404 for non-author."""
    req = ChallengeCreateRequest(
        title="Classified Draft Problem Statement",
        description="Internal proposal notes for testing privacy boundaries on draft documents.",
        category=ChallengeCategory.OTHER,
        location="Delhi, NCR",
        status=ChallengeStatus.DRAFT,
    )
    draft = await challenge_service.create_challenge(req, citizen_user)

    # Stranger (student) gets 404
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await challenge_service.get_challenge_by_id(draft.id, student_user)
    assert exc.value.status_code == 404

    # Author can view it
    author_view = await challenge_service.get_challenge_by_id(draft.id, citizen_user)
    assert author_view.id == draft.id


@pytest.mark.anyio
async def test_service_search_filtering_sorting_pagination(mock_db, citizen_user):
    """Test search, category, location, difficulty filters, sorting, and pagination."""
    items = [
        ("AI Clean Water Filter", "Environment & Water", "Ahmedabad", "Easy", 10),
        ("Rural School STEM Kit", "Education", "Patna", "Medium", 25),
        ("Smart Agriculture Sensor", "Agriculture", "Nagpur", "Hard", 50),
        ("City Solid Waste Tracker", "Waste Management", "Indore", "Medium", 5),
    ]
    for title, cat, loc, diff, views in items:
        doc = new_challenge_document(
            title=title,
            description="A detailed description for " + title + " solving real community problems.",
            category=cat,
            location=loc,
            author_id=str(citizen_user["_id"]),
            author_name=citizen_user["name"],
            difficulty=diff,
            status=ChallengeStatus.PUBLISHED,
        )
        doc["viewsCount"] = views
        await mock_db.challenges.insert_one(doc)

    # 1. Search filter
    res_search = await challenge_service.get_challenges(search="STEM")
    assert res_search.total == 1
    assert "STEM" in res_search.challenges[0].title

    # 2. Category filter
    res_cat = await challenge_service.get_challenges(category="Agriculture")
    assert res_cat.total == 1
    assert res_cat.challenges[0].category == "Agriculture"

    # 3. Location filter
    res_loc = await challenge_service.get_challenges(location="Indore")
    assert res_loc.total == 1
    assert "Indore" in res_loc.challenges[0].location

    # 4. Difficulty filter
    res_diff = await challenge_service.get_challenges(difficulty="Hard")
    assert res_diff.total == 1
    assert res_diff.challenges[0].difficulty == "Hard"

    # 5. Sorting by views
    res_sort = await challenge_service.get_challenges(sort_by="views")
    assert res_sort.challenges[0].title == "Smart Agriculture Sensor"  # 50 views

    # 6. Pagination
    res_page = await challenge_service.get_challenges(page=1, limit=2)
    assert len(res_page.challenges) == 2
    assert res_page.pages == 2
    assert res_page.total == 4


@pytest.mark.anyio
async def test_service_update_challenge_permissions(mock_db, citizen_user, student_user, admin_user):
    """Test challenge updating by author, admin, and rejection for strangers."""
    req = ChallengeCreateRequest(
        title="Initial Community Problem Statement",
        description="Initial description of municipal water leakage across residential wards.",
        category=ChallengeCategory.ENVIRONMENT_WATER,
        location="Jaipur, Rajasthan",
        status=ChallengeStatus.SUBMITTED,
    )
    created = await challenge_service.create_challenge(req, citizen_user)

    # Stranger tries to update -> 403
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await challenge_service.update_challenge(
            created.id,
            ChallengeUpdateRequest(title="Hacked Title By Stranger"),
            student_user,
        )
    assert exc.value.status_code == 403

    # Author updates successfully
    upd = await challenge_service.update_challenge(
        created.id,
        ChallengeUpdateRequest(title="Updated Community Problem Statement"),
        citizen_user,
    )
    assert upd.title == "Updated Community Problem Statement"

    # Admin updates successfully
    admin_upd = await challenge_service.update_challenge(
        created.id,
        ChallengeUpdateRequest(location="Jaipur & Ajmer, Rajasthan"),
        admin_user,
    )
    assert admin_upd.location == "Jaipur & Ajmer, Rajasthan"


@pytest.mark.anyio
async def test_service_delete_challenge_dependency_block(mock_db, citizen_user, student_user):
    """Verify challenge cannot be deleted when proposals are linked."""
    req = ChallengeCreateRequest(
        title="Challenge With Proposals Attached",
        description="Societal problem statement that students have already written proposals for.",
        category=ChallengeCategory.HEALTHCARE,
        location="Chennai, Tamil Nadu",
        status=ChallengeStatus.PUBLISHED,
    )
    created = await challenge_service.create_challenge(req, citizen_user)

    # Simulate proposal linked to this challenge in db.proposals
    await mock_db.proposals.insert_one(
        {
            "challengeId": created.id,
            "title": "Proposed Solution for Healthcare Challenge",
            "authorId": str(student_user["_id"]),
            "status": "submitted",
        }
    )

    # Attempt delete -> 400 Bad Request
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await challenge_service.delete_challenge(created.id, citizen_user)
    assert exc.value.status_code == 400
    assert "associated proposal" in exc.value.detail

    # Remove proposal -> now delete succeeds
    await mock_db.proposals.delete_one({"challengeId": created.id})
    res_del = await challenge_service.delete_challenge(created.id, citizen_user)
    assert res_del["message"] == "Challenge deleted successfully."

    # Verify document no longer exists
    assert await mock_db.challenges.find_one({"_id": ObjectId(created.id)}) is None


@pytest.mark.anyio
async def test_service_status_transition_rules(mock_db, citizen_user, admin_user):
    """Verify status transition enforcement between author and administrator."""
    req = ChallengeCreateRequest(
        title="Status Lifecycle Testing Challenge",
        description="Validating state machine transition pathways and role permission bounds.",
        category=ChallengeCategory.EDUCATION,
        location="Kolkata, West Bengal",
        status=ChallengeStatus.SUBMITTED,
    )
    created = await challenge_service.create_challenge(req, citizen_user)

    # Author withdraws submitted -> draft: Allowed
    w_res = await challenge_service.update_challenge_status(
        created.id,
        ChallengeStatusUpdateRequest(status=ChallengeStatus.DRAFT, reason="Withdrawing for revisions"),
        citizen_user,
    )
    assert w_res.status == "draft"
    assert w_res.isPublished is False

    # Author cannot publish directly without admin: Forbidden 403
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await challenge_service.update_challenge_status(
            created.id,
            ChallengeStatusUpdateRequest(status=ChallengeStatus.PUBLISHED),
            citizen_user,
        )
    assert exc.value.status_code == 403

    # Admin publishes: Allowed
    pub_res = await challenge_service.update_challenge_status(
        created.id,
        ChallengeStatusUpdateRequest(status=ChallengeStatus.PUBLISHED),
        admin_user,
    )
    assert pub_res.status == "published"
    assert pub_res.isPublished is True


@pytest.mark.anyio
async def test_attachment_upload_service(citizen_user, monkeypatch):
    """Test attachment upload with allowed and forbidden file extensions."""
    # Mock cloudinary configuration to False to test local file fallback
    monkeypatch.setattr("app.utils.cloudinary_storage.is_cloudinary_configured", lambda: False)

    # 1. Valid PDF upload
    valid_file = UploadFile(
        filename="field_report.pdf",
        file=BytesIO(b"%PDF-1.4 test content for challenge attachment"),
    )
    res_att = await challenge_service.upload_challenge_attachment(valid_file, citizen_user)
    assert res_att["name"] == "field_report.pdf"
    assert res_att["url"].startswith("/uploads/challenges/")
    assert res_att["fileType"] == "pdf"
    assert res_att["sizeBytes"] > 0

    # 2. Forbidden extension (e.g. .exe)
    from fastapi import HTTPException
    bad_file = UploadFile(
        filename="malicious_script.exe",
        file=BytesIO(b"binary content"),
    )
    with pytest.raises(HTTPException) as exc:
        await challenge_service.upload_challenge_attachment(bad_file, citizen_user)
    assert exc.value.status_code == 400
    assert "Unsupported file type" in exc.value.detail


@pytest.mark.anyio
async def test_categories_aggregation(mock_db, citizen_user):
    """Test get_challenge_categories returns distribution counts."""
    doc1 = new_challenge_document(
        title="Water Project 1",
        description="A sufficiently detailed description of the community water challenge.",
        category=ChallengeCategory.ENVIRONMENT_WATER,
        location="City A",
        author_id=str(citizen_user["_id"]),
        author_name=citizen_user["name"],
        status=ChallengeStatus.PUBLISHED,
    )
    doc2 = new_challenge_document(
        title="Water Project 2",
        description="A sufficiently detailed description of another water challenge.",
        category=ChallengeCategory.ENVIRONMENT_WATER,
        location="City B",
        author_id=str(citizen_user["_id"]),
        author_name=citizen_user["name"],
        status=ChallengeStatus.PUBLISHED,
    )
    doc3 = new_challenge_document(
        title="Healthcare Clinic Project",
        description="A sufficiently detailed description of the rural health challenge.",
        category=ChallengeCategory.HEALTHCARE,
        location="City C",
        author_id=str(citizen_user["_id"]),
        author_name=citizen_user["name"],
        status=ChallengeStatus.PUBLISHED,
    )
    await mock_db.challenges.insert_one(doc1)
    await mock_db.challenges.insert_one(doc2)
    await mock_db.challenges.insert_one(doc3)

    cats = await challenge_service.get_challenge_categories()
    assert cats["totalCategories"] == len(ChallengeCategory)
    counts = {c["category"]: c["count"] for c in cats["categories"]}
    assert counts.get("Environment & Water") == 2
    assert counts.get("Healthcare") == 1
    assert counts.get("Agriculture") == 0


@pytest.mark.anyio
async def test_module4_proposal_service_consumes_module2_challenge(mock_db, citizen_user):
    """
    CRITICAL INTEGRATION TEST:
    Verify that a challenge created by Module 2 satisfies Module 4's
    proposal_service.get_published_challenge_or_400() without any errors.
    """
    req = ChallengeCreateRequest(
        title="AI-Powered Agricultural Soil Health Scanner",
        description="Empower farmers with low-cost spectroscopic analysis of soil nitrogen and phosphorus.",
        category=ChallengeCategory.AGRICULTURE,
        location="Nashik, Maharashtra",
        status=ChallengeStatus.PUBLISHED,
        expectedImpact="Reduce fertilizer waste by 20% across 500 farms.",
    )
    created = await challenge_service.create_challenge(req, citizen_user)

    # Call Module 4's exact validation function
    validated_for_proposal = await proposal_service.get_published_challenge_or_400(
        mock_db,
        created.id,
    )
    assert validated_for_proposal is not None
    assert validated_for_proposal["title"] == req.title
    assert validated_for_proposal["category"] == "Agriculture"
    assert validated_for_proposal["status"] == "published"
    assert validated_for_proposal["isPublished"] is True
