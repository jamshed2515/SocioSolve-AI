"""
Business logic service for Module 4: Solution Proposals & Evaluation.
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from bson import ObjectId
from fastapi import HTTPException, status, UploadFile
import os
import re
import uuid
import logging

from app.config.database import get_database
from app.models.user import UserRole
from app.models.proposal import (
    ProposalStatus,
    ReviewStatus,
    ReviewRecommendation,
    VALID_STATUS_TRANSITIONS,
    DEFAULT_RUBRIC_CRITERIA,
    new_proposal_document,
    new_review_document,
    new_status_history_document,
)
from app.schemas.proposal_schema import (
    ProposalCreateRequest,
    ProposalUpdateRequest,
    ReviewUpsertRequest,
    StatusTransitionRequest,
)

logger = logging.getLogger(__name__)

# Roles permitted to evaluate proposals and manage review workflow
REVIEWER_ROLES = {
    UserRole.ADMIN.value,
    UserRole.UNIVERSITY.value,
    UserRole.INDUSTRY.value,
    "reviewer",
}

# Roles permitted to create & submit solution proposals
PROPOSER_ROLES = {
    UserRole.STUDENT.value,
    UserRole.UNIVERSITY.value,
    UserRole.CITIZEN.value,
    UserRole.INDUSTRY.value,
    UserRole.ADMIN.value,
}

# Allowed file extensions and max size (10 MB) for supporting documents
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".zip"}
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

REQUIRED_SUBMISSION_FIELDS = [
    ("title", "Proposal title"),
    ("challengeId", "Related challenge"),
    ("problemUnderstanding", "Problem understanding"),
    ("proposedSolution", "Proposed solution"),
    ("innovationUniqueness", "Innovation / uniqueness"),
    ("technicalApproach", "Technical approach"),
    ("implementationPlan", "Implementation plan"),
    ("requiredResources", "Required resources"),
    ("expectedImpact", "Expected impact"),
    ("estimatedTimeline", "Estimated implementation timeline"),
]


def _serialize_doc(doc: Optional[ dict ]) -> Optional[dict]:
    """Convert MongoDB ObjectIds and datetimes into JSON-friendly values."""
    if not doc:
        return None
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    for k, v in list(out.items()):
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = _serialize_doc(v)
        elif isinstance(v, list):
            out[k] = [
                _serialize_doc(item) if isinstance(item, dict)
                else (str(item) if isinstance(item, ObjectId) else item)
                for item in v
            ]
    return out


async def _create_notification(
    db,
    *,
    recipient_id: str,
    title: str,
    message: str,
    event_type: str,
    proposal_id: str,
    proposal_title: str,
):
    """Store notification in MongoDB notifications collection (and emit via Socket.IO if present)."""
    now = datetime.now(timezone.utc)
    notif = {
        "userId": recipient_id,
        "title": title,
        "message": message,
        "type": event_type,
        "module": "proposals",
        "referenceId": proposal_id,
        "proposalTitle": proposal_title,
        "isRead": False,
        "createdAt": now,
    }
    try:
        await db.notifications.insert_one(notif)
    except Exception as exc:
        logger.warning(f"Notification insert warning: {exc}")


async def ensure_seed_challenges(db) -> List[dict]:
    """
    Ensure published societal challenges exist in `db.challenges` so Module 4 works
    seamlessly even before Module 2 is merged. Does not overwrite existing challenges.
    """
    count = await db.challenges.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc)
        seed_challenges = [
            {
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
            },
            {
                "title": "Smart Campus & Urban Corridor Traffic Decongestion System",
                "category": "Smart Cities & Mobility",
                "description": (
                    "Peak-hour traffic congestion around university corridors and hospital zones delays emergency "
                    "vehicles and increases emissions. Propose an adaptive signal and commuter routing solution."
                ),
                "location": "Hyderabad, Telangana",
                "difficulty": "Hard",
                "status": "published",
                "isPublished": True,
                "deadline": "2026-12-20",
                "expectedImpact": "Reduce average commute delay by 30% during peak hours.",
                "createdBy": "Urban Mobility Authority",
                "createdAt": now,
                "updatedAt": now,
            },
            {
                "title": "Decentralized Solid Waste Segregation & Circular Recycling Tracker",
                "category": "Waste Management",
                "description": (
                    "Municipalities struggle with unsegregated household waste and lack visibility into dry-waste "
                    "recovery chains. Build a citizen-to-recycler incentive and tracking platform."
                ),
                "location": "Indore & Bhopal, Madhya Pradesh",
                "difficulty": "Medium",
                "status": "published",
                "isPublished": True,
                "deadline": "2026-12-10",
                "expectedImpact": "Increase ward-level waste segregation compliance above 85%.",
                "createdBy": "Clean City Initiative",
                "createdAt": now,
                "updatedAt": now,
            },
            {
                "title": "Low-Bandwidth Tele-Diagnostic Triage Kit for Primary Health Centers",
                "category": "Healthcare",
                "description": (
                    "Primary Health Centers (PHCs) in remote blocks lack specialist doctors. Create an offline-capable "
                    "clinical decision support and tele-referral workflow for frontline health workers."
                ),
                "location": "Ranchi, Jharkhand",
                "difficulty": "Hard",
                "status": "published",
                "isPublished": True,
                "deadline": "2026-12-28",
                "expectedImpact": "Cut specialist triage turnaround time from 7 days to under 4 hours.",
                "createdBy": "Rural Health Foundation",
                "createdAt": now,
                "updatedAt": now,
            },
            {
                "title": "Multilingual STEM Micro-Learning Lab for Government Schools",
                "category": "Education",
                "description": (
                    "Students in rural secondary schools lack interactive laboratory simulations in regional languages. "
                    "Build a lightweight web/mobile virtual lab curriculum aligned with state boards."
                ),
                "location": "Patna, Bihar",
                "difficulty": "Easy",
                "status": "published",
                "isPublished": True,
                "deadline": "2026-11-30",
                "expectedImpact": "Enable hands-on virtual science experiments for 200+ schools.",
                "createdBy": "State Education Innovation Cell",
                "createdAt": now,
                "updatedAt": now,
            },
            {
                "title": "[Internal Draft] Unverified Industrial Effluent Sensor Network",
                "category": "Environment & Water",
                "description": "Unpublished challenge awaiting administrative verification.",
                "location": "Kanpur, UP",
                "difficulty": "Hard",
                "status": "draft",
                "isPublished": False,
                "deadline": "2027-01-15",
                "expectedImpact": "Pending review.",
                "createdBy": "System",
                "createdAt": now,
                "updatedAt": now,
            },
        ]
        await db.challenges.insert_many(seed_challenges)

    cursor = db.challenges.find(
        {"$or": [{"status": "published"}, {"status": "open"}, {"status": "active"}, {"isPublished": True}]}
    ).sort("createdAt", -1)
    docs = await cursor.to_list(length=100)
    return [_serialize_doc(d) for d in docs]


async def get_published_challenge_or_400(db, challenge_id: str) -> dict:
    """
    Validate that the referenced challenge exists and is published/active.
    Prevents proposals for unpublished, inactive, or unavailable challenges.
    """
    await ensure_seed_challenges(db)

    challenge = None
    if ObjectId.is_valid(challenge_id):
        challenge = await db.challenges.find_one({"_id": ObjectId(challenge_id)})
    if not challenge:
        challenge = await db.challenges.find_one({"id": challenge_id})

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected societal challenge does not exist.",
        )

    ch_status = str(challenge.get("status", "")).lower()
    is_published = challenge.get("isPublished", ch_status in {"published", "open", "active"})
    if ch_status in {"draft", "closed", "archived", "inactive", "unpublished"} or not is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposals can only be created or submitted for published, active challenges.",
        )

    return _serialize_doc(challenge)


def _validate_complete_for_submission(data: dict):
    """Ensure all required proposal fields are non-empty before final submission."""
    missing = []
    for field_key, label in REQUIRED_SUBMISSION_FIELDS:
        val = data.get(field_key)
        if not val or not str(val).strip():
            missing.append(label)
        elif field_key in {"problemUnderstanding", "proposedSolution", "technicalApproach", "implementationPlan"} and len(str(val).strip()) < 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{label}' must be at least 20 characters long before submitting.",
            )

    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit incomplete proposal. Missing required fields: {', '.join(missing)}.",
        )


def _is_author_or_team_member(proposal: dict, user: dict) -> bool:
    """Check if the current user is the proposal author or listed in teamMembers."""
    uid = str(user["_id"])
    uemail = (user.get("email") or "").lower().strip()
    if str(proposal.get("authorId")) == uid:
        return True
    for member in proposal.get("teamMembers", []):
        if member.get("userId") and str(member.get("userId")) == uid:
            return True
        if uemail and (member.get("email") or "").lower().strip() == uemail:
            return True
    return False


def _can_review_proposal(proposal: dict, user: dict) -> bool:
    """Check if user has reviewer/admin role and is NOT the author or team member."""
    if user.get("role") not in REVIEWER_ROLES:
        return False
    if _is_author_or_team_member(proposal, user):
        return False
    return True


async def create_proposal(data: ProposalCreateRequest, current_user: dict) -> dict:
    """Create a new proposal (either saved as Draft or submitted immediately)."""
    db = get_database()
    challenge = await get_published_challenge_or_400(db, data.challengeId)

    target_status = (
        ProposalStatus.SUBMITTED if data.submitImmediately else ProposalStatus.DRAFT
    )

    payload_dict = data.model_dump()
    if target_status == ProposalStatus.SUBMITTED:
        _validate_complete_for_submission(payload_dict)

    # If teamId is provided and Module 3 teams collection exists, enrich team info
    team_name = data.teamName
    team_members = [m.model_dump() for m in data.teamMembers]
    if data.teamId and ObjectId.is_valid(data.teamId):
        team_doc = await db.teams.find_one({"_id": ObjectId(data.teamId)})
        if team_doc:
            team_name = team_name or team_doc.get("name", "")
            if not team_members and team_doc.get("members"):
                team_members = team_doc.get("members", [])

    doc = new_proposal_document(
        title=data.title,
        challenge_id=challenge["id"],
        challenge_title=challenge.get("title", "Societal Challenge"),
        challenge_category=challenge.get("category", "General"),
        author_id=str(current_user["_id"]),
        author_name=current_user.get("name", "User"),
        author_email=current_user.get("email", ""),
        author_role=current_user.get("role", "student"),
        problem_understanding=data.problemUnderstanding,
        proposed_solution=data.proposedSolution,
        innovation_uniqueness=data.innovationUniqueness,
        technical_approach=data.technicalApproach,
        implementation_plan=data.implementationPlan,
        required_resources=data.requiredResources,
        expected_impact=data.expectedImpact,
        estimated_timeline=data.estimatedTimeline,
        team_id=data.teamId,
        team_name=team_name,
        team_members=team_members,
        prototype_url=data.prototypeUrl,
        github_url=data.githubUrl,
        demo_url=data.demoUrl,
        supporting_documents=[d.model_dump() for d in data.supportingDocuments],
        additional_notes=data.additionalNotes,
        status=target_status,
    )

    result = await db.proposals.insert_one(doc)
    proposal_id = str(result.inserted_id)
    doc["_id"] = result.inserted_id

    # Record initial status history
    history_entry = new_status_history_document(
        proposal_id=proposal_id,
        from_status=None,
        to_status=target_status.value,
        changed_by_id=str(current_user["_id"]),
        changed_by_name=current_user.get("name", "User"),
        changed_by_role=current_user.get("role", "student"),
        comment="Proposal created and submitted for evaluation."
        if target_status == ProposalStatus.SUBMITTED
        else "Proposal saved as draft.",
    )
    await db.proposal_status_history.insert_one(history_entry)

    if target_status == ProposalStatus.SUBMITTED:
        await _create_notification(
            db,
            recipient_id=str(current_user["_id"]),
            title="Proposal Submitted Successfully",
            message=f"Your proposal '{doc['title']}' ({doc['proposalCode']}) has been submitted for evaluation.",
            event_type="proposal_submitted",
            proposal_id=proposal_id,
            proposal_title=doc["title"],
        )

    return _serialize_doc(doc)


async def update_proposal(proposal_id: str, data: ProposalUpdateRequest, current_user: dict) -> dict:
    """
    Update an existing proposal.
    Only drafts can be edited; submitted or reviewed proposals cannot be silently modified.
    """
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if not _is_author_or_team_member(proposal, current_user) and current_user.get("role") != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this proposal.",
        )

    if proposal.get("status") != ProposalStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposals with status '{proposal.get('status')}' cannot be edited. Only draft proposals are editable.",
        )

    updates: Dict[str, Any] = {}
    raw = data.model_dump(exclude_unset=True)

    if "challengeId" in raw and raw["challengeId"]:
        challenge = await get_published_challenge_or_400(db, raw["challengeId"])
        updates["challengeId"] = challenge["id"]
        updates["challengeTitle"] = challenge.get("title", "Societal Challenge")
        updates["challengeCategory"] = challenge.get("category", "General")

    string_fields = [
        "title",
        "problemUnderstanding",
        "proposedSolution",
        "innovationUniqueness",
        "technicalApproach",
        "implementationPlan",
        "requiredResources",
        "expectedImpact",
        "estimatedTimeline",
        "teamId",
        "teamName",
        "prototypeUrl",
        "githubUrl",
        "demoUrl",
        "additionalNotes",
    ]
    for field in string_fields:
        if field in raw:
            val = raw[field]
            updates[field] = val.strip() if isinstance(val, str) else val

    if "teamMembers" in raw and raw["teamMembers"] is not None:
        updates["teamMembers"] = raw["teamMembers"]

    if "supportingDocuments" in raw and raw["supportingDocuments"] is not None:
        updates["supportingDocuments"] = raw["supportingDocuments"]

    updates["updatedAt"] = datetime.now(timezone.utc)

    await db.proposals.update_one({"_id": ObjectId(proposal_id)}, {"$set": updates})
    updated = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    return _serialize_doc(updated)


async def delete_draft_proposal(proposal_id: str, current_user: dict) -> dict:
    """Delete a proposal. Strictly restricted to DRAFT status only."""
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if str(proposal.get("authorId")) != str(current_user["_id"]) and current_user.get("role") != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the proposal author can delete this draft.",
        )

    if proposal.get("status") != ProposalStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft proposals can be deleted. Submitted or reviewed proposals cannot be deleted.",
        )

    await db.proposals.delete_one({"_id": ObjectId(proposal_id)})
    await db.proposal_status_history.delete_many({"proposalId": proposal_id})
    return {"message": "Draft proposal deleted successfully.", "id": proposal_id}


async def submit_draft_proposal(proposal_id: str, current_user: dict) -> dict:
    """Validate and transition a proposal from DRAFT to SUBMITTED."""
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if not _is_author_or_team_member(proposal, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the proposal author or team members can submit this proposal.",
        )

    current_status = proposal.get("status")
    if current_status != ProposalStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit a proposal that is currently '{current_status}'. Only drafts can be submitted.",
        )

    # Verify the challenge is still published
    await get_published_challenge_or_400(db, proposal.get("challengeId", ""))

    # Verify all required fields are complete
    _validate_complete_for_submission(proposal)

    now = datetime.now(timezone.utc)
    await db.proposals.update_one(
        {"_id": ObjectId(proposal_id)},
        {
            "$set": {
                "status": ProposalStatus.SUBMITTED.value,
                "submittedAt": now,
                "updatedAt": now,
            }
        },
    )

    history_entry = new_status_history_document(
        proposal_id=proposal_id,
        from_status=ProposalStatus.DRAFT.value,
        to_status=ProposalStatus.SUBMITTED.value,
        changed_by_id=str(current_user["_id"]),
        changed_by_name=current_user.get("name", "User"),
        changed_by_role=current_user.get("role", "student"),
        comment="Proposal officially submitted for evaluation.",
    )
    await db.proposal_status_history.insert_one(history_entry)

    await _create_notification(
        db,
        recipient_id=str(proposal.get("authorId")),
        title="Proposal Submitted",
        message=f"Your proposal '{proposal['title']}' ({proposal.get('proposalCode')}) is now Submitted and queued for review.",
        event_type="proposal_submitted",
        proposal_id=proposal_id,
        proposal_title=proposal["title"],
    )

    updated = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    return _serialize_doc(updated)


async def withdraw_proposal(proposal_id: str, reason: Optional[str], current_user: dict) -> dict:
    """
    Allow author to withdraw a SUBMITTED proposal (before it enters or finishes official review).
    """
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if str(proposal.get("authorId")) != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the proposal author can withdraw this proposal.",
        )

    current_status = ProposalStatus(proposal.get("status"))
    if ProposalStatus.WITHDRAWN not in VALID_STATUS_TRANSITIONS.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot withdraw proposal in '{current_status.value}' status. Only 'submitted' proposals not yet under active review can be withdrawn.",
        )

    now = datetime.now(timezone.utc)
    await db.proposals.update_one(
        {"_id": ObjectId(proposal_id)},
        {
            "$set": {
                "status": ProposalStatus.WITHDRAWN.value,
                "updatedAt": now,
            }
        },
    )

    history_entry = new_status_history_document(
        proposal_id=proposal_id,
        from_status=current_status.value,
        to_status=ProposalStatus.WITHDRAWN.value,
        changed_by_id=str(current_user["_id"]),
        changed_by_name=current_user.get("name", "User"),
        changed_by_role=current_user.get("role", "student"),
        comment=reason or "Withdrawn by author.",
    )
    await db.proposal_status_history.insert_one(history_entry)

    updated = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    return _serialize_doc(updated)


async def get_proposal_by_id(proposal_id: str, current_user: dict) -> dict:
    """
    Fetch full proposal details, status history, and authorized reviews.
    Draft proposals are private to their author/team and admins.
    """
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    is_owner = _is_author_or_team_member(proposal, current_user)
    is_reviewer_or_admin = current_user.get("role") in REVIEWER_ROLES

    if proposal.get("status") == ProposalStatus.DRAFT.value and not is_owner and current_user.get("role") != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Draft proposals are private to the author and team.",
        )

    # Fetch status history sorted chronologically
    history_cursor = db.proposal_status_history.find({"proposalId": proposal_id}).sort("timestamp", 1)
    history_docs = await history_cursor.to_list(length=100)

    # Fetch reviews
    review_query: Dict[str, Any] = {"proposalId": proposal_id}
    if not is_reviewer_or_admin:
        # Authors and regular users only see officially submitted reviews
        review_query["status"] = ReviewStatus.SUBMITTED.value
    else:
        # Reviewers see all submitted reviews plus their own draft review
        review_query = {
            "proposalId": proposal_id,
            "$or": [
                {"status": ReviewStatus.SUBMITTED.value},
                {"reviewerId": str(current_user["_id"])},
            ],
        }

    reviews_cursor = db.proposal_reviews.find(review_query).sort("updatedAt", -1)
    review_docs = await reviews_cursor.to_list(length=50)

    serialized = _serialize_doc(proposal)
    serialized["statusHistory"] = [_serialize_doc(h) for h in history_docs]
    serialized["reviews"] = [_serialize_doc(r) for r in review_docs]
    serialized["permissions"] = {
        "isOwner": is_owner,
        "canEdit": is_owner and proposal.get("status") == ProposalStatus.DRAFT.value,
        "canDelete": str(proposal.get("authorId")) == str(current_user["_id"])
        and proposal.get("status") == ProposalStatus.DRAFT.value,
        "canSubmit": is_owner and proposal.get("status") == ProposalStatus.DRAFT.value,
        "canWithdraw": str(proposal.get("authorId")) == str(current_user["_id"])
        and proposal.get("status") == ProposalStatus.SUBMITTED.value,
        "canReview": _can_review_proposal(proposal, current_user)
        and proposal.get("status") in {
            ProposalStatus.SUBMITTED.value,
            ProposalStatus.UNDER_REVIEW.value,
        },
        "canChangeStatus": _can_review_proposal(proposal, current_user)
        and proposal.get("status") in {
            ProposalStatus.SUBMITTED.value,
            ProposalStatus.UNDER_REVIEW.value,
        },
    }
    return serialized


async def list_proposals(
    current_user: dict,
    *,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    challenge_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "newest",
    mine_only: bool = False,
    review_queue: bool = False,
    page: int = 1,
    limit: int = 10,
) -> dict:
    """
    Search, filter, sort, and paginate proposals from MongoDB.
    """
    db = get_database()
    uid = str(current_user["_id"])
    uemail = (current_user.get("email") or "").lower().strip()
    user_role = current_user.get("role")

    and_conditions: List[Dict[str, Any]] = []

    if mine_only:
        and_conditions.append(
            {
                "$or": [
                    {"authorId": uid},
                    {"teamMembers.userId": uid},
                    {"teamMembers.email": uemail},
                ]
            }
        )
    elif review_queue:
        if user_role not in REVIEWER_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only authorized reviewers and administrators can access the review queue.",
            )
        # Reviewers see non-draft proposals that they did NOT author themselves
        and_conditions.append({"status": {"$ne": ProposalStatus.DRAFT.value}})
        and_conditions.append({"authorId": {"$ne": uid}})
    else:
        # General dashboard visibility:
        # Users see their own drafts + all non-draft proposals
        and_conditions.append(
            {
                "$or": [
                    {"status": {"$ne": ProposalStatus.DRAFT.value}},
                    {"authorId": uid},
                    {"teamMembers.userId": uid},
                ]
            }
        )

    if status_filter and status_filter != "all":
        and_conditions.append({"status": status_filter})

    if challenge_id and challenge_id != "all":
        and_conditions.append({"challengeId": challenge_id})

    if search and search.strip():
        escaped = re.escape(search.strip())
        search_or: List[Dict[str, Any]] = [
            {"title": {"$regex": escaped, "$options": "i"}},
            {"proposalCode": {"$regex": escaped, "$options": "i"}},
            {"challengeTitle": {"$regex": escaped, "$options": "i"}},
            {"authorName": {"$regex": escaped, "$options": "i"}},
        ]
        if ObjectId.is_valid(search.strip()):
            search_or.append({"_id": ObjectId(search.strip())})
        and_conditions.append({"$or": search_or})

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            if dt_from.tzinfo is None:
                dt_from = dt_from.replace(tzinfo=timezone.utc)
            and_conditions.append({"createdAt": {"$gte": dt_from}})
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            if dt_to.tzinfo is None:
                dt_to = dt_to.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            and_conditions.append({"createdAt": {"$lte": dt_to}})
        except ValueError:
            pass

    query = {"$and": and_conditions} if and_conditions else {}

    # Sorting
    sort_spec = [("createdAt", -1)]
    if sort_by == "oldest":
        sort_spec = [("createdAt", 1)]
    elif sort_by == "score_desc":
        sort_spec = [("reviewSummary.averageScore", -1), ("createdAt", -1)]
    elif sort_by == "score_asc":
        sort_spec = [("reviewSummary.averageScore", 1), ("createdAt", -1)]
    elif sort_by == "updated":
        sort_spec = [("updatedAt", -1)]

    page = max(1, page)
    limit = max(1, min(50, limit))
    skip = (page - 1) * limit

    total = await db.proposals.count_documents(query)
    cursor = db.proposals.find(query).sort(sort_spec).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    total_pages = max(1, (total + limit - 1) // limit)

    return {
        "items": [_serialize_doc(d) for d in docs],
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
    }


async def get_dashboard_stats(current_user: dict, scope: str = "all") -> dict:
    """
    Calculate proposal KPI metrics, status distribution, and recent proposals.
    """
    db = get_database()
    await ensure_seed_challenges(db)

    uid = str(current_user["_id"])
    uemail = (current_user.get("email") or "").lower().strip()

    if scope == "mine":
        base_filter: Dict[str, Any] = {
            "$or": [
                {"authorId": uid},
                {"teamMembers.userId": uid},
                {"teamMembers.email": uemail},
            ]
        }
    else:
        base_filter = {
            "$or": [
                {"status": {"$ne": ProposalStatus.DRAFT.value}},
                {"authorId": uid},
                {"teamMembers.userId": uid},
            ]
        }

    pipeline = [
        {"$match": base_filter},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    grouped = await db.proposals.aggregate(pipeline).to_list(length=20)
    counts_by_status = {item["_id"]: item["count"] for item in grouped}

    draft_count = counts_by_status.get(ProposalStatus.DRAFT.value, 0)
    submitted_count = counts_by_status.get(ProposalStatus.SUBMITTED.value, 0)
    under_review_count = counts_by_status.get(ProposalStatus.UNDER_REVIEW.value, 0)
    accepted_count = counts_by_status.get(ProposalStatus.ACCEPTED.value, 0)
    rejected_count = counts_by_status.get(ProposalStatus.REJECTED.value, 0)
    withdrawn_count = counts_by_status.get(ProposalStatus.WITHDRAWN.value, 0)
    total_count = (
        draft_count
        + submitted_count
        + under_review_count
        + accepted_count
        + rejected_count
        + withdrawn_count
    )

    def _pct(val: int) -> float:
        return round((val / total_count) * 100, 1) if total_count > 0 else 0.0

    distribution = [
        {"status": "draft", "label": "Draft", "count": draft_count, "percentage": _pct(draft_count)},
        {"status": "submitted", "label": "Submitted", "count": submitted_count, "percentage": _pct(submitted_count)},
        {"status": "under_review", "label": "Under Review", "count": under_review_count, "percentage": _pct(under_review_count)},
        {"status": "accepted", "label": "Accepted", "count": accepted_count, "percentage": _pct(accepted_count)},
        {"status": "rejected", "label": "Rejected", "count": rejected_count, "percentage": _pct(rejected_count)},
    ]

    recent_cursor = db.proposals.find(base_filter).sort("updatedAt", -1).limit(5)
    recent_docs = await recent_cursor.to_list(length=5)

    # Count user's own proposals as well for quick badge display
    my_count = await db.proposals.count_documents(
        {
            "$or": [
                {"authorId": uid},
                {"teamMembers.userId": uid},
                {"teamMembers.email": uemail},
            ]
        }
    )

    return {
        "totalProposals": total_count,
        "draftProposals": draft_count,
        "submittedProposals": submitted_count,
        "underReviewProposals": under_review_count,
        "acceptedProposals": accepted_count,
        "rejectedProposals": rejected_count,
        "withdrawnProposals": withdrawn_count,
        "myProposalsCount": my_count,
        "statusDistribution": distribution,
        "recentProposals": [_serialize_doc(d) for d in recent_docs],
    }


async def _recompute_proposal_review_summary(db, proposal_id: str):
    """Recalculate aggregate total/average score and latest feedback from submitted reviews."""
    cursor = db.proposal_reviews.find(
        {"proposalId": proposal_id, "status": ReviewStatus.SUBMITTED.value}
    ).sort("submittedAt", -1)
    submitted_reviews = await cursor.to_list(length=100)

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    existing_summary = (proposal or {}).get("reviewSummary", {})

    if not submitted_reviews:
        summary = {
            "reviewCount": 0,
            "totalScore": 0.0,
            "maxTotalScore": 50.0,
            "averageScore": 0.0,
            "percentageScore": 0.0,
            "latestFeedback": existing_summary.get("latestFeedback"),
            "decisionBy": existing_summary.get("decisionBy"),
            "decisionByName": existing_summary.get("decisionByName"),
            "decisionReason": existing_summary.get("decisionReason"),
            "decisionAt": existing_summary.get("decisionAt"),
        }
    else:
        count = len(submitted_reviews)
        avg_total = round(sum(r.get("totalScore", 0.0) for r in submitted_reviews) / count, 2)
        avg_criterion = round(sum(r.get("averageScore", 0.0) for r in submitted_reviews) / count, 2)
        max_total = submitted_reviews[0].get("maxTotalScore", 50.0)
        pct = round((avg_total / max_total) * 100, 1) if max_total else 0.0
        latest = submitted_reviews[0]
        summary = {
            "reviewCount": count,
            "totalScore": avg_total,
            "maxTotalScore": max_total,
            "averageScore": avg_criterion,
            "percentageScore": pct,
            "latestFeedback": latest.get("overallFeedback"),
            "latestRecommendation": latest.get("recommendation"),
            "latestReviewerName": latest.get("reviewerName"),
            "decisionBy": existing_summary.get("decisionBy"),
            "decisionByName": existing_summary.get("decisionByName"),
            "decisionReason": existing_summary.get("decisionReason"),
            "decisionAt": existing_summary.get("decisionAt"),
        }

    await db.proposals.update_one(
        {"_id": ObjectId(proposal_id)},
        {"$set": {"reviewSummary": summary, "updatedAt": datetime.now(timezone.utc)}},
    )
    return summary


async def upsert_review(
    proposal_id: str,
    data: ReviewUpsertRequest,
    current_user: dict,
) -> dict:
    """
    Create or update a reviewer's evaluation (either as a draft review or submitted review).
    Prevents self-review and automatically moves 'submitted' proposals to 'under_review'.
    """
    db = get_database()
    if current_user.get("role") not in REVIEWER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized reviewers (University, Industry, or Admin) can evaluate proposals.",
        )

    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if _is_author_or_team_member(proposal, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-review is strictly prohibited. You cannot evaluate your own or your team's proposal.",
        )

    prop_status = proposal.get("status")
    if prop_status not in {ProposalStatus.SUBMITTED.value, ProposalStatus.UNDER_REVIEW.value}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit or edit a review when proposal status is '{prop_status}'. Proposal must be 'submitted' or 'under_review'.",
        )

    reviewer_id = str(current_user["_id"])
    target_review_status = ReviewStatus.SUBMITTED if data.submitFinal else ReviewStatus.DRAFT
    criteria_list = [c.model_dump() for c in data.criteriaScores]

    review_doc = new_review_document(
        proposal_id=proposal_id,
        reviewer_id=reviewer_id,
        reviewer_name=current_user.get("name", "Reviewer"),
        reviewer_role=current_user.get("role", "reviewer"),
        criteria_scores=criteria_list,
        overall_feedback=data.overallFeedback,
        recommendation=data.recommendation,
        status=target_review_status,
    )

    existing = await db.proposal_reviews.find_one(
        {"proposalId": proposal_id, "reviewerId": reviewer_id}
    )

    now = datetime.now(timezone.utc)
    if existing:
        review_doc["createdAt"] = existing.get("createdAt", now)
        await db.proposal_reviews.update_one(
            {"_id": existing["_id"]},
            {"$set": review_doc},
        )
        saved_review = await db.proposal_reviews.find_one({"_id": existing["_id"]})
    else:
        ins = await db.proposal_reviews.insert_one(review_doc)
        saved_review = await db.proposal_reviews.find_one({"_id": ins.inserted_id})

    # Automatically transition proposal from 'submitted' -> 'under_review' when review starts/submits
    if prop_status == ProposalStatus.SUBMITTED.value:
        await db.proposals.update_one(
            {"_id": ObjectId(proposal_id)},
            {"$set": {"status": ProposalStatus.UNDER_REVIEW.value, "updatedAt": now}},
        )
        history_entry = new_status_history_document(
            proposal_id=proposal_id,
            from_status=ProposalStatus.SUBMITTED.value,
            to_status=ProposalStatus.UNDER_REVIEW.value,
            changed_by_id=reviewer_id,
            changed_by_name=current_user.get("name", "Reviewer"),
            changed_by_role=current_user.get("role", "reviewer"),
            comment="Proposal entered evaluation by reviewer.",
        )
        await db.proposal_status_history.insert_one(history_entry)

        await _create_notification(
            db,
            recipient_id=str(proposal.get("authorId")),
            title="Proposal Under Review",
            message=f"Your proposal '{proposal['title']}' is now Under Review by {current_user.get('name', 'a reviewer')}.",
            event_type="proposal_under_review",
            proposal_id=proposal_id,
            proposal_title=proposal["title"],
        )

    summary = await _recompute_proposal_review_summary(db, proposal_id)

    if target_review_status == ReviewStatus.SUBMITTED:
        await _create_notification(
            db,
            recipient_id=str(proposal.get("authorId")),
            title="New Evaluation & Feedback Added",
            message=(
                f"{current_user.get('name', 'A reviewer')} completed a review on '{proposal['title']}' "
                f"(Score: {review_doc['totalScore']}/{review_doc['maxTotalScore']})."
            ),
            event_type="review_completed",
            proposal_id=proposal_id,
            proposal_title=proposal["title"],
        )

    return {
        "review": _serialize_doc(saved_review),
        "reviewSummary": _serialize_doc(summary),
    }


async def transition_proposal_status(
    proposal_id: str,
    data: StatusTransitionRequest,
    current_user: dict,
) -> dict:
    """
    Execute a controlled backend-validated status transition:
    Submitted -> Under Review -> Accepted / Rejected
    """
    db = get_database()
    if current_user.get("role") not in REVIEWER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized reviewers and administrators can change proposal review statuses.",
        )

    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if _is_author_or_team_member(proposal, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change the review status or approve/reject your own proposal.",
        )

    current_status = ProposalStatus(proposal.get("status"))
    target_status = data.toStatus

    allowed_targets = VALID_STATUS_TRANSITIONS.get(current_status, [])
    if target_status not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition from '{current_status.value}' to '{target_status.value}'. "
                f"Allowed transitions from '{current_status.value}': {[s.value for s in allowed_targets]}."
            ),
        )

    now = datetime.now(timezone.utc)
    update_fields: Dict[str, Any] = {
        "status": target_status.value,
        "updatedAt": now,
    }

    review_summary = dict(proposal.get("reviewSummary") or {})
    if target_status in {ProposalStatus.ACCEPTED, ProposalStatus.REJECTED}:
        if not data.comment or len(data.comment.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A written decision feedback/reason (at least 5 characters) is required when accepting or rejecting a proposal.",
            )
        review_summary["decisionBy"] = str(current_user["_id"])
        review_summary["decisionByName"] = current_user.get("name", "Reviewer")
        review_summary["decisionReason"] = data.comment.strip()
        review_summary["decisionAt"] = now
        if not review_summary.get("latestFeedback"):
            review_summary["latestFeedback"] = data.comment.strip()
        update_fields["reviewSummary"] = review_summary

    await db.proposals.update_one({"_id": ObjectId(proposal_id)}, {"$set": update_fields})

    history_entry = new_status_history_document(
        proposal_id=proposal_id,
        from_status=current_status.value,
        to_status=target_status.value,
        changed_by_id=str(current_user["_id"]),
        changed_by_name=current_user.get("name", "Reviewer"),
        changed_by_role=current_user.get("role", "reviewer"),
        comment=data.comment or f"Status changed to {target_status.value}.",
        score_snapshot=review_summary.get("totalScore"),
    )
    await db.proposal_status_history.insert_one(history_entry)

    # Notify proposal author
    event_map = {
        ProposalStatus.UNDER_REVIEW: (
            "Proposal Entered Review",
            f"Your proposal '{proposal['title']}' is now Under Review.",
            "proposal_under_review",
        ),
        ProposalStatus.ACCEPTED: (
            "Proposal Accepted!",
            f"Congratulations! Your proposal '{proposal['title']}' has been ACCEPTED. Feedback: {data.comment}",
            "proposal_accepted",
        ),
        ProposalStatus.REJECTED: (
            "Proposal Decision Update",
            f"Your proposal '{proposal['title']}' was not selected in this round. Feedback: {data.comment}",
            "proposal_rejected",
        ),
    }
    if target_status in event_map:
        ntitle, nmsg, ntype = event_map[target_status]
        await _create_notification(
            db,
            recipient_id=str(proposal.get("authorId")),
            title=ntitle,
            message=nmsg,
            event_type=ntype,
            proposal_id=proposal_id,
            proposal_title=proposal["title"],
        )

    return await get_proposal_by_id(proposal_id, current_user)


async def upload_proposal_document(file: UploadFile, doc_type: str, current_user: dict) -> dict:
    """
    Validate and safely store a supporting document for a proposal in `uploads/proposals/`.
    """
    filename = file.filename or "document.pdf"
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    size_bytes = len(content)
    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if size_bytes > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10 MB maximum limit.",
        )

    safe_dir = os.path.join("uploads", "proposals")
    os.makedirs(safe_dir, exist_ok=True)

    clean_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", os.path.splitext(filename)[0])[:40]
    unique_filename = f"{uuid.uuid4().hex[:10]}_{clean_stem}{ext}"
    file_path = os.path.join(safe_dir, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "name": filename,
        "url": f"/uploads/proposals/{unique_filename}",
        "docType": doc_type or "supporting_document",
        "sizeBytes": size_bytes,
    }


async def get_user_notifications(current_user: dict) -> List[dict]:
    """Fetch recent notifications for the authenticated user."""
    db = get_database()
    uid = str(current_user["_id"])
    cursor = db.notifications.find({"userId": uid}).sort("createdAt", -1).limit(25)
    docs = await cursor.to_list(length=25)
    return [_serialize_doc(d) for d in docs]


async def mark_notification_read(notification_id: str, current_user: dict) -> dict:
    """Mark a notification as read."""
    db = get_database()
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID.")
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": str(current_user["_id"])},
        {"$set": {"isRead": True}},
    )
    return {"message": "Notification marked as read."}
