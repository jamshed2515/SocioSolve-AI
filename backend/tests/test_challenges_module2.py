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
