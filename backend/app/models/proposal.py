"""
Proposal, Review, and Status History document models for MongoDB (Module 4).
Defines enums, controlled workflow transitions, rubric criteria, and document builders.
"""
from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid


class ProposalStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ReviewStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


class ReviewRecommendation(str, Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    REVISE = "revise"


# Controlled status workflow state machine
VALID_STATUS_TRANSITIONS: Dict[ProposalStatus, List[ProposalStatus]] = {
    ProposalStatus.DRAFT: [ProposalStatus.SUBMITTED],
    ProposalStatus.SUBMITTED: [ProposalStatus.UNDER_REVIEW, ProposalStatus.WITHDRAWN],
    ProposalStatus.UNDER_REVIEW: [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED],
    ProposalStatus.ACCEPTED: [],
    ProposalStatus.REJECTED: [],
    ProposalStatus.WITHDRAWN: [ProposalStatus.DRAFT],
}


# Structured evaluation rubric criteria (5 criteria x 20 points = 100 points maximum)
DEFAULT_RUBRIC_CRITERIA = [
    {
        "key": "innovation",
        "label": "Innovation and Originality",
        "description": "Uniqueness of the proposed approach and creative use of technology or methodology.",
        "maxScore": 20,
    },
    {
        "key": "feasibility",
        "label": "Technical Feasibility",
        "description": "Practicality of the implementation plan, engineering soundness, and resource requirements.",
        "maxScore": 20,
    },
    {
        "key": "societal_impact",
        "label": "Societal Impact",
        "description": "Measurable benefit to target communities, civic value, and alignment with the challenge.",
        "maxScore": 20,
    },
    {
        "key": "implementation_strategy",
        "label": "Implementation Strategy",
        "description": "Milestones, deployment roadmap, prototype readiness, and risk management.",
        "maxScore": 20,
    },
    {
        "key": "scalability",
        "label": "Scalability and Sustainability",
        "description": "Long-term viability, maintainability, financial model, and multi-region scalability.",
        "maxScore": 20,
    },
]


def generate_proposal_code() -> str:
    """Generate a human-readable proposal reference code, e.g. PROP-2026-A1B2C3."""
    year = datetime.now(timezone.utc).year
    short_hex = uuid.uuid4().hex[:6].upper()
    return f"PROP-{year}-{short_hex}"


def new_proposal_document(
    *,
    title: str,
    challenge_id: str,
    challenge_title: str,
    challenge_category: str,
    author_id: str,
    author_name: str,
    author_email: str,
    author_role: str,
    problem_understanding: str,
    proposed_solution: str,
    innovation_uniqueness: str,
    technical_approach: str,
    implementation_plan: str,
    required_resources: str,
    expected_impact: str,
    estimated_timeline: str,
    team_id: Optional[str] = None,
    team_name: Optional[str] = None,
    team_members: Optional[List[Dict[str, Any]]] = None,
    prototype_url: Optional[str] = None,
    github_url: Optional[str] = None,
    demo_url: Optional[str] = None,
    supporting_documents: Optional[List[Dict[str, Any]]] = None,
    additional_notes: Optional[str] = None,
    status: ProposalStatus = ProposalStatus.DRAFT,
) -> dict:
    """Build a fresh proposal document ready for insertion into MongoDB."""
    now = datetime.now(timezone.utc)
    is_submitted = status == ProposalStatus.SUBMITTED
    return {
        "proposalCode": generate_proposal_code(),
        "title": title.strip(),
        "challengeId": challenge_id,
        "challengeTitle": challenge_title,
        "challengeCategory": challenge_category,
        "authorId": author_id,
        "authorName": author_name,
        "authorEmail": author_email,
        "authorRole": author_role,
        "teamId": team_id,
        "teamName": team_name or "",
        "teamMembers": team_members or [],
        "problemUnderstanding": problem_understanding.strip(),
        "proposedSolution": proposed_solution.strip(),
        "innovationUniqueness": innovation_uniqueness.strip(),
        "technicalApproach": technical_approach.strip(),
        "implementationPlan": implementation_plan.strip(),
        "requiredResources": required_resources.strip(),
        "expectedImpact": expected_impact.strip(),
        "estimatedTimeline": estimated_timeline.strip(),
        "prototypeUrl": (prototype_url or "").strip() or None,
        "githubUrl": (github_url or "").strip() or None,
        "demoUrl": (demo_url or "").strip() or None,
        "supportingDocuments": supporting_documents or [],
        "additionalNotes": (additional_notes or "").strip() or None,
        "status": status.value,
        "reviewSummary": {
            "reviewCount": 0,
            "totalScore": 0.0,
            "maxTotalScore": 100.0,
            "averageScore": 0.0,
            "percentageScore": 0.0,
            "latestFeedback": None,
            "decisionBy": None,
            "decisionByName": None,
            "decisionReason": None,
            "decisionAt": None,
        },
        "submittedAt": now if is_submitted else None,
        "createdAt": now,
        "updatedAt": now,
    }


def new_review_document(
    *,
    proposal_id: str,
    reviewer_id: str,
    reviewer_name: str,
    reviewer_role: str,
    criteria_scores: List[Dict[str, Any]],
    overall_feedback: str,
    recommendation: ReviewRecommendation,
    status: ReviewStatus = ReviewStatus.DRAFT,
) -> dict:
    """Build a structured evaluation review document for a proposal."""
    now = datetime.now(timezone.utc)
    total_score = round(sum(float(item.get("score", 0)) for item in criteria_scores), 2)
    count = len(criteria_scores) or 1
    average_score = round(total_score / count, 2)
    max_total = round(sum(float(item.get("maxScore", 20)) for item in criteria_scores), 2) or 100.0
    percentage_score = round((total_score / max_total) * 100, 1)

    return {
        "proposalId": proposal_id,
        "reviewerId": reviewer_id,
        "reviewerName": reviewer_name,
        "reviewerRole": reviewer_role,
        "criteriaScores": criteria_scores,
        "totalScore": total_score,
        "maxTotalScore": max_total,
        "averageScore": average_score,
        "percentageScore": percentage_score,
        "overallFeedback": overall_feedback.strip(),
        "recommendation": recommendation.value,
        "status": status.value,
        "submittedAt": now if status == ReviewStatus.SUBMITTED else None,
        "createdAt": now,
        "updatedAt": now,
    }


def new_review_history_document(
    *,
    proposal_id: str,
    review_id: str,
    reviewer_id: str,
    reviewer_name: str,
    reviewer_role: str,
    criteria_scores: List[Dict[str, Any]],
    total_score: float,
    max_total_score: float,
    average_score: float,
    percentage_score: float,
    overall_feedback: str,
    recommendation: str,
    action: str = "evaluation_submitted",
) -> dict:
    """Build an immutable evaluation review history record for audit trail."""
    return {
        "proposalId": proposal_id,
        "reviewId": review_id,
        "reviewerId": reviewer_id,
        "reviewerName": reviewer_name,
        "reviewerRole": reviewer_role,
        "criteriaScores": criteria_scores,
        "totalScore": total_score,
        "maxTotalScore": max_total_score,
        "averageScore": average_score,
        "percentageScore": percentage_score,
        "overallFeedback": overall_feedback.strip(),
        "recommendation": recommendation,
        "action": action,
        "timestamp": datetime.now(timezone.utc),
    }


def new_status_history_document(
    *,
    proposal_id: str,
    from_status: Optional[str],
    to_status: str,
    changed_by_id: str,
    changed_by_name: str,
    changed_by_role: str,
    comment: Optional[str] = None,
    score_snapshot: Optional[float] = None,
) -> dict:
    """Build a status transition audit log entry for a proposal."""
    return {
        "proposalId": proposal_id,
        "fromStatus": from_status,
        "toStatus": to_status,
        "changedById": changed_by_id,
        "changedByName": changed_by_name,
        "changedByRole": changed_by_role,
        "comment": (comment or "").strip() or None,
        "scoreSnapshot": score_snapshot,
        "timestamp": datetime.now(timezone.utc),
    }
