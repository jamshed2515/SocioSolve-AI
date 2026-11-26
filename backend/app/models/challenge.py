"""
Domain model, enums, workflow state transitions, and document builders for
Module 2: Societal Challenge Management.

Preserves complete compatibility with existing collections and Module 4:
`title`, `category`, `status`, and `isPublished` fields match Module 4 expectations.
"""
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


class ChallengeCategory(str, Enum):
    HEALTHCARE = "Healthcare"
    EDUCATION = "Education"
    AGRICULTURE = "Agriculture"
    ENVIRONMENT_WATER = "Environment & Water"
    WASTE_MANAGEMENT = "Waste Management"
    SMART_CITIES_MOBILITY = "Smart Cities & Mobility"
    RENEWABLE_ENERGY = "Renewable Energy"
    OTHER = "Other"


class ChallengeStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ChallengeDifficulty(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


# Status transitions state machine
VALID_CHALLENGE_STATUS_TRANSITIONS: Dict[ChallengeStatus, List[ChallengeStatus]] = {
    ChallengeStatus.DRAFT: [
        ChallengeStatus.SUBMITTED,
        ChallengeStatus.PUBLISHED,
        ChallengeStatus.CLOSED,
    ],
    ChallengeStatus.SUBMITTED: [
        ChallengeStatus.PUBLISHED,
        ChallengeStatus.DRAFT,
        ChallengeStatus.CLOSED,
    ],
    ChallengeStatus.PUBLISHED: [
        ChallengeStatus.IN_PROGRESS,
        ChallengeStatus.CLOSED,
    ],
    ChallengeStatus.IN_PROGRESS: [
        ChallengeStatus.RESOLVED,
        ChallengeStatus.CLOSED,
    ],
    ChallengeStatus.RESOLVED: [
        ChallengeStatus.CLOSED,
        ChallengeStatus.IN_PROGRESS,
    ],
    ChallengeStatus.CLOSED: [
        ChallengeStatus.PUBLISHED,
        ChallengeStatus.DRAFT,
    ],
}


def is_valid_status_transition(current: ChallengeStatus, target: ChallengeStatus) -> bool:
    """Validate whether transitioning from current status to target status is permitted."""
    if current == target:
        return True
    allowed = VALID_CHALLENGE_STATUS_TRANSITIONS.get(current, [])
    return target in allowed


def is_published_status(status: ChallengeStatus | str) -> bool:
    """
    Return True if status represents an active, published challenge eligible for
    student discovery, team formation, and solution proposals.
    """
    s = status.value if isinstance(status, ChallengeStatus) else str(status).lower()
    return s in {
        ChallengeStatus.PUBLISHED.value,
        ChallengeStatus.IN_PROGRESS.value,
        ChallengeStatus.RESOLVED.value,
        "open",
        "active",
    }


def generate_challenge_code() -> str:
    """Generate a human-readable challenge reference code, e.g. CHAL-2026-A1B2C3."""
    year = datetime.now(timezone.utc).year
    short_hex = uuid.uuid4().hex[:6].upper()
    return f"CHAL-{year}-{short_hex}"


def new_challenge_document(
    *,
    title: str,
    description: str,
    category: ChallengeCategory | str,
    location: str,
    author_id: str,
    author_name: str,
    author_email: Optional[str] = None,
    author_role: Optional[str] = None,
    difficulty: ChallengeDifficulty | str = ChallengeDifficulty.MEDIUM,
    status: ChallengeStatus | str = ChallengeStatus.DRAFT,
    expected_impact: Optional[str] = None,
    deadline: Optional[str] = None,
    tags: Optional[List[str]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
    challenge_code: Optional[str] = None,
    created_by: Optional[str] = None,
) -> dict:
    """
    Construct a canonical MongoDB challenge document.
    Maintains compatibility with existing seed documents and Module 4 validation.
    """
    category_val = category.value if isinstance(category, ChallengeCategory) else str(category).strip()
    status_val = status.value if isinstance(status, ChallengeStatus) else str(status).strip().lower()
    diff_val = difficulty.value if isinstance(difficulty, ChallengeDifficulty) else str(difficulty).strip()
    now = datetime.now(timezone.utc)

    # Clean tags
    cleaned_tags = [t.strip().lower() for t in (tags or []) if t and t.strip()]

    return {
        "challengeCode": challenge_code or generate_challenge_code(),
        "title": title.strip(),
        "description": description.strip(),
        "category": category_val,
        "location": location.strip(),
        "difficulty": diff_val,
        "status": status_val,
        # Critical compatibility field for Module 4 proposal service:
        "isPublished": is_published_status(status_val),
        "authorId": str(author_id),
        "authorName": author_name,
        "authorEmail": author_email,
        "authorRole": author_role,
        "createdBy": created_by or author_name,
        "expectedImpact": expected_impact.strip() if expected_impact else None,
        "deadline": deadline.strip() if deadline else None,
        "tags": cleaned_tags,
        "attachments": attachments or [],
        "proposalsCount": 0,
        "viewsCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
