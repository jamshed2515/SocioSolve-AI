"""
Role-protected dashboard endpoints - /api/dashboard/*
Backend enforcement for the five role dashboards backed by real MongoDB data (fixes L4).
"""
from typing import Any, Dict, List
from bson import ObjectId
from fastapi import APIRouter, Depends

from app.config.database import get_database
from app.middleware.auth_middleware import require_role
from app.models.proposal import ProposalStatus, ReviewStatus
from app.models.user import UserRole, ApprovalStatus
from app.services import proposal_service

router = APIRouter()


async def _safe_count(col: Any, query: Dict[str, Any]) -> int:
    if col is None:
        return 0
    if hasattr(col, "count_documents"):
        return int(await col.count_documents(query))
    # Fallback for minimal FakeCollection in unit tests
    count = 0
    async for _ in col.find(query):
        count += 1
    return count


async def _get_student_metrics(db: Any, user: dict) -> Dict[str, Any]:
    uid = str(user["_id"])
    id_candidates: List[Any] = [uid]
    if ObjectId.is_valid(uid):
        id_candidates.append(ObjectId(uid))

    proposals_col = getattr(db, "proposals", None)
    teams_col = getattr(db, "teams", None)
    challenges_col = getattr(db, "challenges", None)

    mine_filter = {"$or": [{"authorId": uid}, {"verifiedMemberIds": uid}]}
    my_proposals_total = await _safe_count(proposals_col, mine_filter)
    my_submitted = await _safe_count(
        proposals_col,
        {
            "$and": [
                mine_filter,
                {"status": {"$in": [
                    ProposalStatus.SUBMITTED.value,
                    ProposalStatus.UNDER_REVIEW.value,
                    ProposalStatus.ACCEPTED.value,
                    ProposalStatus.REJECTED.value,
                ]}},
            ]
        },
    )
    my_accepted = await _safe_count(
        proposals_col,
        {"$and": [mine_filter, {"status": ProposalStatus.ACCEPTED.value}]},
    )

    team_projects = await _safe_count(
        teams_col,
        {"$or": [{"leader_id": {"$in": id_candidates}}, {"members.user_id": {"$in": id_candidates}}]},
    )

    published_challenges: List[dict] = []
    if challenges_col is not None and hasattr(challenges_col, "find"):
        published_challenges = await proposal_service.get_published_challenges(db)

    # Compute earned points from accepted/reviewed proposals instead of hardcoded numbers
    points_earned = 0.0
    if proposals_col is not None and hasattr(proposals_col, "find"):
        cursor = proposals_col.find(mine_filter)
        if hasattr(cursor, "to_list"):
            my_docs = await cursor.to_list(length=100)
            for p in my_docs:
                points_earned += float((p.get("reviewSummary") or {}).get("totalScore") or 0.0)

    return {
        "stats": {
            "activeChallenges": len(published_challenges),
            "teamProjects": team_projects,
            "proposalsSubmitted": my_submitted,
            "totalMyProposals": my_proposals_total,
            "acceptedProposals": my_accepted,
            "pointsEarned": round(points_earned, 1),
        },
        "activeChallenges": published_challenges[:5],
    }


async def _get_reviewer_metrics(db: Any, user: dict) -> Dict[str, Any]:
    uid = str(user["_id"])
    proposals_col = getattr(db, "proposals", None)
    reviews_col = getattr(db, "proposal_reviews", None)

    pending_review_queue = await _safe_count(
        proposals_col,
        {
            "status": {"$in": [ProposalStatus.SUBMITTED.value, ProposalStatus.UNDER_REVIEW.value]},
            "authorId": {"$ne": uid},
            "verifiedMemberIds": {"$ne": uid},
        },
    )
    completed_reviews = await _safe_count(
        reviews_col,
        {"reviewerId": uid, "status": ReviewStatus.SUBMITTED.value},
    )
    accepted_proposals = await _safe_count(
        proposals_col,
        {"status": ProposalStatus.ACCEPTED.value},
    )
    total_proposals = await _safe_count(
        proposals_col,
        {"status": {"$nin": [ProposalStatus.DRAFT.value, ProposalStatus.WITHDRAWN.value]}},
    )

    return {
        "stats": {
            "pendingReviewQueue": pending_review_queue,
            "completedReviews": completed_reviews,
            "acceptedProposals": accepted_proposals,
            "totalEvaluatableProposals": total_proposals,
        }
    }


async def _get_citizen_metrics(db: Any, user: dict) -> Dict[str, Any]:
    uid = str(user["_id"])
    proposals_col = getattr(db, "proposals", None)
    challenges_col = getattr(db, "challenges", None)
    mine_filter = {"$or": [{"authorId": uid}, {"verifiedMemberIds": uid}]}

    my_proposals = await _safe_count(proposals_col, mine_filter)
    under_review = await _safe_count(
        proposals_col,
        {"$and": [mine_filter, {"status": ProposalStatus.UNDER_REVIEW.value}]},
    )
    accepted = await _safe_count(
        proposals_col,
        {"$and": [mine_filter, {"status": ProposalStatus.ACCEPTED.value}]},
    )
    active_challenges = await _safe_count(
        challenges_col,
        {"$or": [{"status": "published"}, {"isPublished": True}]},
    )

    return {
        "stats": {
            "myProposals": my_proposals,
            "underReview": under_review,
            "accepted": accepted,
            "activeChallenges": active_challenges,
        }
    }


async def _get_admin_metrics(db: Any) -> Dict[str, Any]:
    users_col = getattr(db, "users", None)
    proposals_col = getattr(db, "proposals", None)
    reviews_col = getattr(db, "proposal_reviews", None)

    total_users = await _safe_count(users_col, {})
    pending_approvals = await _safe_count(users_col, {"approval_status": ApprovalStatus.PENDING.value})
    total_proposals = await _safe_count(proposals_col, {})
    submitted_reviews = await _safe_count(reviews_col, {"status": ReviewStatus.SUBMITTED.value})

    return {
        "stats": {
            "totalUsers": total_users,
            "pendingApprovals": pending_approvals,
            "totalProposals": total_proposals,
            "submittedReviews": submitted_reviews,
        }
    }


def _base_payload(user: dict, role: str) -> dict:
    return {"dashboard": role, "user": {"id": str(user["_id"]), "name": user.get("name")}}


@router.get("/citizen")
async def citizen(user: dict = Depends(require_role(UserRole.CITIZEN))):
    db = get_database()
    payload = _base_payload(user, "citizen")
    payload.update(await _get_citizen_metrics(db, user))
    return payload


@router.get("/student")
async def student(user: dict = Depends(require_role(UserRole.STUDENT))):
    db = get_database()
    payload = _base_payload(user, "student")
    payload.update(await _get_student_metrics(db, user))
    return payload


@router.get("/university")
async def university(user: dict = Depends(require_role(UserRole.UNIVERSITY))):
    db = get_database()
    payload = _base_payload(user, "university")
    payload.update(await _get_reviewer_metrics(db, user))
    return payload


@router.get("/industry")
async def industry(user: dict = Depends(require_role(UserRole.INDUSTRY))):
    db = get_database()
    payload = _base_payload(user, "industry")
    payload.update(await _get_reviewer_metrics(db, user))
    return payload


@router.get("/admin")
async def admin(user: dict = Depends(require_role(UserRole.ADMIN))):
    db = get_database()
    payload = _base_payload(user, "admin")
    payload.update(await _get_admin_metrics(db))
    return payload
