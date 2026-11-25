"""
Business logic service for Module 4: Solution Proposals & Evaluation.
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set, Tuple
from bson import ObjectId
from fastapi import HTTPException, status, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
import os
import re
import uuid
import logging

from app.config.database import get_database
from app.models.user import UserRole, ApprovalStatus, approval_status
from app.models.proposal import (
    ProposalStatus,
    ReviewStatus,
    ReviewRecommendation,
    VALID_STATUS_TRANSITIONS,
    DEFAULT_RUBRIC_CRITERIA,
    RUBRIC_CRITERIA_BY_KEY,
    RUBRIC_KEY_ALIASES,
    RUBRIC_MIN_SCORE,
    RUBRIC_MAX_SCORE,
    RUBRIC_MAX_TOTAL_SCORE,
    new_proposal_document,
    new_review_document,
    new_review_history_document,
    new_status_history_document,
    new_proposal_document_record,
)
from app.schemas.proposal_schema import (
    ProposalCreateRequest,
    ProposalUpdateRequest,
    ReviewUpsertRequest,
    StatusTransitionRequest,
)
from app.services.proposal_ws import proposal_ws_manager

logger = logging.getLogger(__name__)

# Roles permitted to evaluate proposals and manage review workflow (approved accounts only)
REVIEWER_ROLES = {
    UserRole.ADMIN.value,
    UserRole.UNIVERSITY.value,
    UserRole.INDUSTRY.value,
}

# Roles permitted to create & manage solution proposals (Industry is reviewer/partner role)
PROPOSER_ROLES = {
    UserRole.STUDENT.value,
    UserRole.CITIZEN.value,
    UserRole.UNIVERSITY.value,
    UserRole.ADMIN.value,
}

# Allowed reviewer-initiated workflow transitions via POST/PATCH /{id}/status
REVIEWER_WORKFLOW_TRANSITIONS = {
    ProposalStatus.SUBMITTED: [ProposalStatus.UNDER_REVIEW],
    ProposalStatus.UNDER_REVIEW: [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED],
}

# Allowed file extensions and max size (10 MB) for supporting documents
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx",
    ".txt", ".md", ".png", ".jpg", ".jpeg", ".zip",
}
ALLOWED_MIME_PREFIXES = (
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.",
    "application/vnd.ms-powerpoint",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
    "text/plain",
    "text/markdown",
    "image/png",
    "image/jpeg",
)
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

REQUIRED_SUBMISSION_FIELDS = [
    ("title", "Proposal title", 3),
    ("challengeId", "Related challenge", 1),
    ("problemUnderstanding", "Problem understanding", 20),
    ("proposedSolution", "Proposed solution", 20),
    ("innovationUniqueness", "Innovation / uniqueness", 10),
    ("technicalApproach", "Technical approach", 20),
    ("implementationPlan", "Implementation plan", 20),
    ("requiredResources", "Required resources", 5),
    ("expectedImpact", "Expected impact", 10),
    ("estimatedTimeline", "Estimated implementation timeline", 5),
]

PUBLISHED_CHALLENGE_STATUSES = {"published", "open", "active"}
UNPUBLISHED_CHALLENGE_STATUSES = {"draft", "closed", "archived", "inactive", "unpublished", "rejected"}
SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9._-]+$")


def _serialize_doc(doc: Optional[dict]) -> Optional[dict]:
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


def _ensure_approved_account(user: dict) -> None:
    """Block unapproved (pending/rejected) accounts from protected proposal operations."""
    if approval_status(user) != ApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account approval is {approval_status(user)}. An administrator must approve it.",
        )


def _ensure_proposer_role(user: dict) -> None:
    """Enforce proposer role and account approval on backend (M5)."""
    _ensure_approved_account(user)
    if user.get("role") not in PROPOSER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role is not permitted to create or manage proposals.",
        )


def _ensure_reviewer_role(user: dict) -> None:
    """Enforce reviewer/admin role and account approval on backend (M4)."""
    _ensure_approved_account(user)
    if user.get("role") not in REVIEWER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only approved reviewers (University, Industry, or Admin) can perform evaluation actions.",
        )


async def _create_notification(
    db,
    *,
    recipient_id: str,
    title: str,
    message: str,
    event_type: str,
    proposal_id: str,
    proposal_title: str,
) -> Optional[dict]:
    """Store notification in MongoDB notifications collection and push over WebSocket if connected."""
    if not recipient_id:
        return None
    now = datetime.now(timezone.utc)
    notif = {
        "userId": str(recipient_id),
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
        res = await db.notifications.insert_one(notif)
        notif["_id"] = res.inserted_id
        serialized = _serialize_doc(notif)
        await proposal_ws_manager.send_to_user(
            str(recipient_id),
            {"event": "notification", "data": serialized},
        )
        return serialized
    except Exception as exc:
        logger.warning("Notification insert/push warning: %s", exc)
        return None


async def _notify_users(
    db,
    *,
    recipient_ids: Set[str],
    title: str,
    message: str,
    event_type: str,
    proposal_id: str,
    proposal_title: str,
) -> None:
    """Send a notification to a deduplicated set of user IDs."""
    for uid in sorted({str(r) for r in recipient_ids if r}):
        await _create_notification(
            db,
            recipient_id=uid,
            title=title,
            message=message,
            event_type=event_type,
            proposal_id=proposal_id,
            proposal_title=proposal_title,
        )


def _get_proposal_stakeholder_ids(proposal: dict) -> Set[str]:
    """Return author + verified Module 3 team member IDs for notifications."""
    ids: Set[str] = set()
    if proposal.get("authorId"):
        ids.add(str(proposal["authorId"]))
    for uid in proposal.get("verifiedMemberIds") or []:
        if uid:
            ids.add(str(uid))
    return ids


async def _get_approved_reviewer_ids(db, *, exclude_ids: Set[str]) -> Set[str]:
    """Fetch active, approved University/Industry/Admin user IDs to notify on proposal submission."""
    users_col = getattr(db, "users", None)
    if users_col is None:
        return set()
    try:
        cursor = users_col.find(
            {
                "role": {"$in": list(REVIEWER_ROLES)},
                "is_active": {"$ne": False},
                "approval_status": {"$in": [ApprovalStatus.APPROVED.value, None]},
            }
        ).limit(200)
        docs = await cursor.to_list(length=200)
    except Exception as exc:
        logger.warning("Reviewer lookup warning for notification fanout: %s", exc)
        return set()

    result: Set[str] = set()
    for u in docs:
        uid = str(u.get("_id", ""))
        if not uid or uid in exclude_ids:
            continue
        if approval_status(u) == ApprovalStatus.APPROVED.value:
            result.add(uid)
    return result


# ==============================================================================
# MODULE 2 INTEGRATION: PUBLISHED CHALLENGES
# ==============================================================================

def _is_challenge_published(challenge: dict) -> bool:
    """Determine if a Module 2 challenge document is published and open for proposals."""
    ch_status = str(challenge.get("status", "")).lower().strip()
    if ch_status in UNPUBLISHED_CHALLENGE_STATUSES:
        return False
    if challenge.get("isPublished") is False:
        return False
    return bool(challenge.get("isPublished") is True or ch_status in PUBLISHED_CHALLENGE_STATUSES)


async def get_published_challenges(db=None) -> List[dict]:
    """
    Read published challenges from Module 2's `db.challenges` collection.
    Does NOT insert fake/sample data into MongoDB (fixes L5).
    """
    if db is None:
        db = get_database()
    cursor = db.challenges.find(
        {
            "$and": [
                {
                    "$or": [
                        {"status": {"$in": list(PUBLISHED_CHALLENGE_STATUSES)}},
                        {"isPublished": True},
                    ]
                },
                {"status": {"$nin": list(UNPUBLISHED_CHALLENGE_STATUSES)}},
                {"isPublished": {"$ne": False}},
            ]
        }
    ).sort("createdAt", -1)
    docs = await cursor.to_list(length=100)
    return [_serialize_doc(d) for d in docs if _is_challenge_published(d)]


# Backward-compatible alias for any caller importing the old name
async def ensure_seed_challenges(db=None) -> List[dict]:
    """Deprecated alias kept for compatibility; reads Module 2 challenges without inserting seed data."""
    return await get_published_challenges(db)


async def get_published_challenge_or_400(db, challenge_id: str) -> dict:
    """
    Validate that the referenced Module 2 challenge exists and is published/active.
    Prevents creating or submitting proposals for unpublished, closed, or non-existent challenges.
    """
    if not challenge_id or not str(challenge_id).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid published challenge ID is required.",
        )

    cid = str(challenge_id).strip()
    challenge = None
    if ObjectId.is_valid(cid):
        challenge = await db.challenges.find_one({"_id": ObjectId(cid)})
    if not challenge:
        challenge = await db.challenges.find_one({"id": cid})

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected societal challenge does not exist.",
        )

    if not _is_challenge_published(challenge):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposals can only be created or submitted for published, active challenges.",
        )

    return _serialize_doc(challenge)


# ==============================================================================
# MODULE 3 INTEGRATION: TEAMS & VERIFIED MEMBERSHIP
# ==============================================================================

def _extract_team_member_ids(team_doc: dict) -> Set[str]:
    """Extract all member user IDs (leader + members) from a Module 3 team document."""
    member_ids: Set[str] = set()
    for key in ("leader_id", "leaderId"):
        val = team_doc.get(key)
        if val is not None:
            member_ids.add(str(val))
    for m in team_doc.get("members") or []:
        if isinstance(m, dict):
            uid = m.get("user_id") or m.get("userId")
            if uid is not None:
                member_ids.add(str(uid))
        elif m is not None:
            member_ids.add(str(m))
    for uid in team_doc.get("memberIds") or []:
        if uid is not None:
            member_ids.add(str(uid))
    return member_ids


async def _enrich_team_members_from_users(db, team_doc: dict) -> List[Dict[str, Any]]:
    """Build normalized ProposalForm-compatible member list from Module 3 team + users collection."""
    raw_members = team_doc.get("members") or []
    oids: List[ObjectId] = []
    str_ids: Set[str] = set()

    leader_str = str(team_doc.get("leader_id") or team_doc.get("leaderId") or "")
    if leader_str:
        str_ids.add(leader_str)
        if ObjectId.is_valid(leader_str):
            oids.append(ObjectId(leader_str))

    for m in raw_members:
        if isinstance(m, dict):
            uid = str(m.get("user_id") or m.get("userId") or "")
            if uid:
                str_ids.add(uid)
                if ObjectId.is_valid(uid):
                    oids.append(ObjectId(uid))

    user_map: Dict[str, dict] = {}
    users_col = getattr(db, "users", None)
    if users_col is not None and oids:
        try:
            u_cursor = users_col.find({"_id": {"$in": oids}}).limit(100)
            for u in await u_cursor.to_list(length=100):
                user_map[str(u["_id"])] = u
        except Exception as exc:
            logger.warning("User enrichment warning for team members: %s", exc)

    normalized: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for m in raw_members:
        if not isinstance(m, dict):
            continue
        uid = str(m.get("user_id") or m.get("userId") or "")
        if uid and uid in seen:
            continue
        if uid:
            seen.add(uid)
        u = user_map.get(uid)
        normalized.append(
            {
                "userId": uid or None,
                "name": (u.get("name") if u else None) or m.get("name") or "Team Member",
                "email": (u.get("email") if u else None) or m.get("email"),
                "roleInTeam": m.get("role") or m.get("roleInTeam") or "Member",
                "verified": bool(uid),
            }
        )

    # Ensure leader is always represented if missing from raw_members
    if leader_str and leader_str not in seen:
        u = user_map.get(leader_str)
        normalized.insert(
            0,
            {
                "userId": leader_str,
                "name": (u.get("name") if u else None) or "Team Leader",
                "email": u.get("email") if u else None,
                "roleInTeam": "Team Leader",
                "verified": True,
            },
        )
    return normalized


async def get_user_teams(current_user: dict, db=None) -> dict:
    """
    Fetch current user's teams from Module 3 `db.teams` collection.
    Correctly matches both MongoDB ObjectId (Module 3 canonical schema) and string IDs (fixes L5).
    """
    if db is None:
        db = get_database()
    uid_str = str(current_user["_id"])
    id_candidates: List[Any] = [uid_str]
    if ObjectId.is_valid(uid_str):
        id_candidates.append(ObjectId(uid_str))

    query = {
        "$or": [
            {"leader_id": {"$in": id_candidates}},
            {"members.user_id": {"$in": id_candidates}},
            {"leaderId": {"$in": id_candidates}},
            {"members.userId": {"$in": id_candidates}},
            {"memberIds": {"$in": id_candidates}},
        ]
    }
    cursor = db.teams.find(query).limit(25)
    docs = await cursor.to_list(length=25)

    teams_out: List[dict] = []
    for t in docs:
        serialized = _serialize_doc(t)
        serialized["members"] = await _enrich_team_members_from_users(db, t)
        serialized["challengeId"] = str(t.get("challenge_id") or t.get("challengeId") or "")
        teams_out.append(serialized)
    return {"teams": teams_out, "source": "module3_teams_collection"}


async def _resolve_and_validate_team(
    db,
    *,
    team_id: Optional[str],
    team_name: Optional[str],
    manual_members: List[Dict[str, Any]],
    challenge_id: str,
    current_user: dict,
) -> Tuple[Optional[str], str, List[Dict[str, Any]], List[str]]:
    """
    Validate Module 3 team link & membership (M2 + Section 11).
    Returns: (resolved_team_id, resolved_team_name, display_members, verified_member_ids).
    Unverified manually typed emails NEVER gain ownership or edit permissions.
    """
    uid = str(current_user["_id"])
    is_admin = current_user.get("role") == UserRole.ADMIN.value

    verified_ids: Set[str] = {uid}
    resolved_team_id: Optional[str] = None
    resolved_team_name = (team_name or "").strip()

    if team_id and str(team_id).strip():
        tid = str(team_id).strip()
        if not ObjectId.is_valid(tid):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid team ID format.",
            )
        team_doc = await db.teams.find_one({"_id": ObjectId(tid)})
        if not team_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected Module 3 team does not exist.",
            )

        team_member_ids = _extract_team_member_ids(team_doc)
        if not is_admin and uid not in team_member_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a verified member of the selected team to link it to a proposal.",
            )

        # If the Module 3 team is bound to a specific challenge, ensure consistency
        team_ch_id = team_doc.get("challenge_id") or team_doc.get("challengeId")
        if team_ch_id is not None and str(team_ch_id) != str(challenge_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected team is associated with a different challenge.",
            )

        resolved_team_id = str(team_doc["_id"])
        resolved_team_name = resolved_team_name or str(team_doc.get("name", ""))
        verified_ids.update(team_member_ids)
        enriched_members = await _enrich_team_members_from_users(db, team_doc)
        return resolved_team_id, resolved_team_name, enriched_members, sorted(verified_ids)

    # Without a linked Module 3 team: validate any explicitly referenced userIds exist,
    # and mark manually entered members as verified=False so unverified emails cannot grant access (M2).
    users_col = getattr(db, "users", None)
    sanitized_members: List[Dict[str, Any]] = []
    for m in manual_members:
        member_uid = (m.get("userId") or "").strip() or None
        if member_uid:
            if not ObjectId.is_valid(member_uid):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid team member userId '{member_uid}'.",
                )
            if users_col is not None:
                found_user = await users_col.find_one({"_id": ObjectId(member_uid)})
                if not found_user:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Referenced team member userId '{member_uid}' does not exist.",
                    )
        sanitized_members.append(
            {
                "userId": member_uid,
                "name": m["name"],
                "email": m.get("email"),
                "roleInTeam": m.get("roleInTeam") or "Member",
                "verified": False,
            }
        )

    return None, resolved_team_name, sanitized_members, sorted(verified_ids)


# ==============================================================================
# AUTHORIZATION & VALIDATION HELPERS
# ==============================================================================

def _validate_complete_for_submission(data: dict) -> None:
    """Ensure all required proposal fields meet completeness rules before final submission."""
    missing: List[str] = []
    for field_key, label, min_len in REQUIRED_SUBMISSION_FIELDS:
        val = data.get(field_key)
        if not val or not str(val).strip():
            missing.append(label)
        elif len(str(val).strip()) < min_len:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{label}' must be at least {min_len} characters long before submitting.",
            )

    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit incomplete proposal. Missing required fields: {', '.join(missing)}.",
        )


def _is_author_or_verified_member(proposal: dict, user: dict) -> bool:
    """
    Check if user is the proposal author or a VERIFIED Module 3 team member (fixes M2).
    Never trusts unverified free-text email addresses for authorization.
    """
    uid = str(user["_id"])
    if str(proposal.get("authorId")) == uid:
        return True
    verified_ids = {str(x) for x in (proposal.get("verifiedMemberIds") or []) if x}
    if uid in verified_ids:
        return True
    # Backward compatibility for legacy proposals that stored verified teamMembers.userId with a teamId
    if proposal.get("teamId"):
        for member in proposal.get("teamMembers") or []:
            if member.get("userId") and str(member.get("userId")) == uid and member.get("verified", True):
                return True
    return False


async def _is_team_member_live(db, proposal: dict, user: dict) -> bool:
    """Check both stored verified membership and live Module 3 team membership (for self-review block)."""
    if _is_author_or_verified_member(proposal, user):
        return True
    team_id = proposal.get("teamId")
    if team_id and ObjectId.is_valid(str(team_id)):
        team_doc = await db.teams.find_one({"_id": ObjectId(str(team_id))})
        if team_doc and str(user["_id"]) in _extract_team_member_ids(team_doc):
            return True
    return False


def _can_review_proposal(proposal: dict, user: dict) -> bool:
    """Check if user is an approved reviewer/admin and is NOT the author or verified team member."""
    if approval_status(user) != ApprovalStatus.APPROVED.value:
        return False
    if user.get("role") not in REVIEWER_ROLES:
        return False
    if _is_author_or_verified_member(proposal, user):
        return False
    return True


def _validate_and_normalize_criteria_scores(raw_criteria: list) -> List[Dict[str, Any]]:
    """
    Strictly validate criteria scores against backend-defined rubric criteria (fixes H1).
    - Requires all 5 canonical criteria with no missing, unknown, or duplicate keys.
    - Enforces score strictly in [1, 10].
    - Completely ignores client-submitted maxScore and label, replacing with backend values.
    """
    seen_keys: Dict[str, Dict[str, Any]] = {}

    for item in raw_criteria:
        item_dict = item.model_dump() if hasattr(item, "model_dump") else dict(item)
        raw_key = str(item_dict.get("key", "")).strip()
        canonical_key = RUBRIC_KEY_ALIASES.get(raw_key, raw_key)

        if canonical_key not in RUBRIC_CRITERIA_BY_KEY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid evaluation criterion key '{raw_key}'. "
                    f"Allowed criteria: {list(RUBRIC_CRITERIA_BY_KEY.keys())}."
                ),
            )
        if canonical_key in seen_keys:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate evaluation criterion '{canonical_key}' is not allowed.",
            )

        try:
            score_val = float(item_dict.get("score"))
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Score for '{canonical_key}' must be a valid number.",
            )

        if score_val < RUBRIC_MIN_SCORE or score_val > RUBRIC_MAX_SCORE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Score for '{RUBRIC_CRITERIA_BY_KEY[canonical_key]['label']}' must be "
                    f"between {int(RUBRIC_MIN_SCORE)} and {int(RUBRIC_MAX_SCORE)}."
                ),
            )

        backend_def = RUBRIC_CRITERIA_BY_KEY[canonical_key]
        seen_keys[canonical_key] = {
            "key": backend_def["key"],
            "label": backend_def["label"],
            "score": round(score_val, 2),
            "minScore": backend_def["minScore"],
            "maxScore": backend_def["maxScore"],
            "comment": str(item_dict.get("comment") or "").strip(),
        }

    missing = [c["key"] for c in DEFAULT_RUBRIC_CRITERIA if c["key"] not in seen_keys]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"All 5 evaluation criteria are required. Missing: {', '.join(missing)}.",
        )

    # Return strictly in canonical backend order
    return [seen_keys[c["key"]] for c in DEFAULT_RUBRIC_CRITERIA]


def _extract_doc_id_from_url(url: str) -> Optional[str]:
    """Extract document ObjectId from `/api/proposals/documents/<doc_id>` URLs."""
    m = re.search(r"/api/proposals/documents/([a-fA-F0-9]{24})(?:\?|$)", url or "")
    return m.group(1) if m else None


async def _link_uploaded_documents(
    db,
    *,
    documents: List[Dict[str, Any]],
    proposal_id: str,
    current_user: dict,
) -> None:
    """Associate uploaded document records in `db.proposal_documents` with their proposal."""
    uid = str(current_user["_id"])
    is_admin = current_user.get("role") == UserRole.ADMIN.value

    for doc in documents:
        doc_id = doc.get("docId") or _extract_doc_id_from_url(doc.get("url", ""))
        if not doc_id or not ObjectId.is_valid(str(doc_id)):
            continue
        record = await db.proposal_documents.find_one({"_id": ObjectId(str(doc_id))})
        if not record:
            continue
        existing_pid = record.get("proposalId")
        if existing_pid and existing_pid != proposal_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot attach a private document belonging to another proposal.",
            )
        if str(record.get("uploadedBy")) != uid and not is_admin and existing_pid != proposal_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot attach a private document uploaded by another user.",
            )
        await db.proposal_documents.update_one(
            {"_id": ObjectId(str(doc_id))},
            {"$set": {"proposalId": proposal_id}},
        )


# ==============================================================================
# PROPOSAL CRUD & LIFECYCLE
# ==============================================================================

async def create_proposal(data: ProposalCreateRequest, current_user: dict) -> dict:
    """Create a new proposal (either saved as Draft or submitted immediately)."""
    _ensure_proposer_role(current_user)
    db = get_database()
    challenge = await get_published_challenge_or_400(db, data.challengeId)

    target_status = (
        ProposalStatus.SUBMITTED if data.submitImmediately else ProposalStatus.DRAFT
    )

    payload_dict = data.model_dump()
    if target_status == ProposalStatus.SUBMITTED:
        _validate_complete_for_submission(payload_dict)

    team_id, team_name, team_members, verified_member_ids = await _resolve_and_validate_team(
        db,
        team_id=data.teamId,
        team_name=data.teamName,
        manual_members=[m.model_dump() for m in data.teamMembers],
        challenge_id=challenge["id"],
        current_user=current_user,
    )

    supporting_docs = [d.model_dump() for d in data.supportingDocuments]

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
        team_id=team_id,
        team_name=team_name,
        team_members=team_members,
        verified_member_ids=verified_member_ids,
        prototype_url=data.prototypeUrl,
        github_url=data.githubUrl,
        demo_url=data.demoUrl,
        supporting_documents=supporting_docs,
        additional_notes=data.additionalNotes,
        status=target_status,
    )

    result = await db.proposals.insert_one(doc)
    proposal_id = str(result.inserted_id)
    doc["_id"] = result.inserted_id

    if supporting_docs:
        await _link_uploaded_documents(
            db,
            documents=supporting_docs,
            proposal_id=proposal_id,
            current_user=current_user,
        )

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
        stakeholders = _get_proposal_stakeholder_ids(doc)
        await _notify_users(
            db,
            recipient_ids=stakeholders,
            title="Proposal Submitted Successfully",
            message=f"Proposal '{doc['title']}' ({doc['proposalCode']}) has been submitted for evaluation.",
            event_type="proposal_submitted",
            proposal_id=proposal_id,
            proposal_title=doc["title"],
        )
        reviewer_ids = await _get_approved_reviewer_ids(db, exclude_ids=stakeholders)
        await _notify_users(
            db,
            recipient_ids=reviewer_ids,
            title="New Proposal Ready for Review",
            message=f"{doc['authorName']} submitted '{doc['title']}' ({doc['proposalCode']}) for evaluation.",
            event_type="proposal_submitted_for_review",
            proposal_id=proposal_id,
            proposal_title=doc["title"],
        )

    return _serialize_doc(doc)


async def update_proposal(proposal_id: str, data: ProposalUpdateRequest, current_user: dict) -> dict:
    """
    Update an existing proposal.
    Strictly restricted to DRAFT status only (fixes M1 — withdrawn proposals must be reopened to draft first).
    """
    _ensure_proposer_role(current_user)
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if not _is_author_or_verified_member(proposal, current_user) and current_user.get("role") != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this proposal.",
        )

    if proposal.get("status") != ProposalStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Proposals with status '{proposal.get('status')}' cannot be edited. "
                "Only draft proposals can be edited (reopen withdrawn proposals to draft first)."
            ),
        )

    updates: Dict[str, Any] = {}
    raw = data.model_dump(exclude_unset=True)

    target_challenge_id = proposal.get("challengeId", "")
    if "challengeId" in raw and raw["challengeId"]:
        challenge = await get_published_challenge_or_400(db, raw["challengeId"])
        target_challenge_id = challenge["id"]
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
        "prototypeUrl",
        "githubUrl",
        "demoUrl",
        "additionalNotes",
    ]
    for field in string_fields:
        if field in raw:
            val = raw[field]
            if isinstance(val, str):
                cleaned = val.strip()
                updates[field] = cleaned or (None if field in {"prototypeUrl", "githubUrl", "demoUrl", "additionalNotes"} else "")
            else:
                updates[field] = val

    if any(k in raw for k in ("teamId", "teamName", "teamMembers", "challengeId")):
        next_team_id = raw.get("teamId", proposal.get("teamId"))
        next_team_name = raw.get("teamName", proposal.get("teamName"))
        next_members = raw.get("teamMembers")
        if next_members is None:
            next_members = proposal.get("teamMembers", [])
        t_id, t_name, t_members, verified_ids = await _resolve_and_validate_team(
            db,
            team_id=next_team_id,
            team_name=next_team_name,
            manual_members=next_members,
            challenge_id=target_challenge_id,
            current_user=current_user,
        )
        updates["teamId"] = t_id
        updates["teamName"] = t_name
        updates["teamMembers"] = t_members
        updates["verifiedMemberIds"] = verified_ids

    if "supportingDocuments" in raw and raw["supportingDocuments"] is not None:
        await _link_uploaded_documents(
            db,
            documents=raw["supportingDocuments"],
            proposal_id=proposal_id,
            current_user=current_user,
        )
        updates["supportingDocuments"] = raw["supportingDocuments"]

    updates["updatedAt"] = datetime.now(timezone.utc)

    await db.proposals.update_one({"_id": ObjectId(proposal_id)}, {"$set": updates})
    updated = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    return _serialize_doc(updated)


async def delete_draft_proposal(proposal_id: str, current_user: dict) -> dict:
    """Delete a proposal. Strictly restricted to DRAFT status and author/admin."""
    _ensure_proposer_role(current_user)
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if str(proposal.get("authorId")) != str(current_user["_id"]) and current_user.get("role") != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the proposal author or an admin can delete this draft.",
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
    """Validate and transition a proposal strictly from DRAFT -> SUBMITTED."""
    _ensure_proposer_role(current_user)
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if not _is_author_or_verified_member(proposal, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the proposal author or verified team members can submit this proposal.",
        )

    current_status = ProposalStatus(proposal.get("status"))
    if ProposalStatus.SUBMITTED not in VALID_STATUS_TRANSITIONS.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot submit a proposal that is currently '{current_status.value}'. "
                "Only draft proposals can be submitted (reopen withdrawn proposals to draft first)."
            ),
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
        from_status=current_status.value,
        to_status=ProposalStatus.SUBMITTED.value,
        changed_by_id=str(current_user["_id"]),
        changed_by_name=current_user.get("name", "User"),
        changed_by_role=current_user.get("role", "student"),
        comment="Proposal officially submitted for evaluation.",
    )
    await db.proposal_status_history.insert_one(history_entry)

    stakeholders = _get_proposal_stakeholder_ids(proposal)
    await _notify_users(
        db,
        recipient_ids=stakeholders,
        title="Proposal Submitted",
        message=f"Your proposal '{proposal['title']}' ({proposal.get('proposalCode')}) is now Submitted and queued for review.",
        event_type="proposal_submitted",
        proposal_id=proposal_id,
        proposal_title=proposal["title"],
    )
    reviewer_ids = await _get_approved_reviewer_ids(db, exclude_ids=stakeholders)
    await _notify_users(
        db,
        recipient_ids=reviewer_ids,
        title="New Proposal Ready for Review",
        message=f"{proposal.get('authorName', 'A proposer')} submitted '{proposal['title']}' ({proposal.get('proposalCode')}) for evaluation.",
        event_type="proposal_submitted_for_review",
        proposal_id=proposal_id,
        proposal_title=proposal["title"],
    )

    updated = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    return _serialize_doc(updated)


async def withdraw_proposal(proposal_id: str, reason: Optional[str], current_user: dict) -> dict:
    """Allow author to withdraw a SUBMITTED proposal before it enters review."""
    _ensure_proposer_role(current_user)
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
            detail=(
                f"Cannot withdraw proposal in '{current_status.value}' status. "
                "Only 'submitted' proposals not yet under active review can be withdrawn."
            ),
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
        comment=(reason or "").strip() or "Withdrawn by author.",
    )
    await db.proposal_status_history.insert_one(history_entry)

    updated = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    return _serialize_doc(updated)


async def reopen_withdrawn_proposal(proposal_id: str, reason: Optional[str], current_user: dict) -> dict:
    """
    Explicitly reopen a WITHDRAWN proposal back to DRAFT status (fixes M1).
    Follows VALID_STATUS_TRANSITIONS: WITHDRAWN -> DRAFT.
    """
    _ensure_proposer_role(current_user)
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if str(proposal.get("authorId")) != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the proposal author can reopen a withdrawn proposal.",
        )

    current_status = ProposalStatus(proposal.get("status"))
    if ProposalStatus.DRAFT not in VALID_STATUS_TRANSITIONS.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reopen proposal in '{current_status.value}' status. Only withdrawn proposals can be reopened to draft.",
        )

    now = datetime.now(timezone.utc)
    await db.proposals.update_one(
        {"_id": ObjectId(proposal_id)},
        {
            "$set": {
                "status": ProposalStatus.DRAFT.value,
                "updatedAt": now,
            }
        },
    )

    history_entry = new_status_history_document(
        proposal_id=proposal_id,
        from_status=current_status.value,
        to_status=ProposalStatus.DRAFT.value,
        changed_by_id=str(current_user["_id"]),
        changed_by_name=current_user.get("name", "User"),
        changed_by_role=current_user.get("role", "student"),
        comment=(reason or "").strip() or "Reopened withdrawn proposal as draft for revision.",
    )
    await db.proposal_status_history.insert_one(history_entry)

    updated = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    return _serialize_doc(updated)


# ==============================================================================
# PROPOSAL DETAILS & LISTING
# ==============================================================================

async def get_proposal_by_id(proposal_id: str, current_user: dict) -> dict:
    """
    Fetch full proposal details, enriched challenge & team info, status history, and permission-filtered reviews.
    Draft and withdrawn proposals are private to their author, verified team members, and admins.
    """
    _ensure_approved_account(current_user)
    db = get_database()
    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    uid = str(current_user["_id"])
    is_admin = current_user.get("role") == UserRole.ADMIN.value
    is_owner = await _is_team_member_live(db, proposal, current_user)
    is_reviewer_or_admin = current_user.get("role") in REVIEWER_ROLES

    if proposal.get("status") in {ProposalStatus.DRAFT.value, ProposalStatus.WITHDRAWN.value} and not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Draft and withdrawn proposals are private to the author, team, and administrators.",
        )

    # Fetch status history sorted chronologically
    history_cursor = db.proposal_status_history.find({"proposalId": proposal_id}).sort("timestamp", 1)
    history_docs = await history_cursor.to_list(length=100)

    # Fetch permission-filtered reviews (never expose other reviewers' draft reviews)
    if not is_reviewer_or_admin:
        review_query: Dict[str, Any] = {
            "proposalId": proposal_id,
            "status": ReviewStatus.SUBMITTED.value,
        }
        rev_history_query: Dict[str, Any] = {
            "proposalId": proposal_id,
            "action": {"$ne": "draft_saved"},
        }
    else:
        review_query = {
            "proposalId": proposal_id,
            "$or": [
                {"status": ReviewStatus.SUBMITTED.value},
                {"reviewerId": uid},
            ],
        }
        rev_history_query = {
            "proposalId": proposal_id,
            "$or": [
                {"action": {"$ne": "draft_saved"}},
                {"reviewerId": uid},
            ],
        }

    reviews_cursor = db.proposal_reviews.find(review_query).sort("updatedAt", -1)
    review_docs = await reviews_cursor.to_list(length=50)

    rev_history_cursor = db.proposal_review_history.find(rev_history_query).sort("timestamp", 1)
    rev_history_docs = await rev_history_cursor.to_list(length=100)

    # Enrich with challenge details (Module 2) and team details (Module 3)
    challenge_detail = None
    ch_id = proposal.get("challengeId")
    if ch_id:
        ch_doc = None
        if ObjectId.is_valid(str(ch_id)):
            ch_doc = await db.challenges.find_one({"_id": ObjectId(str(ch_id))})
        if not ch_doc:
            ch_doc = await db.challenges.find_one({"id": str(ch_id)})
        if ch_doc:
            challenge_detail = _serialize_doc(ch_doc)

    team_detail = None
    t_id = proposal.get("teamId")
    if t_id and ObjectId.is_valid(str(t_id)):
        t_doc = await db.teams.find_one({"_id": ObjectId(str(t_id))})
        if t_doc:
            team_detail = _serialize_doc(t_doc)
            team_detail["members"] = await _enrich_team_members_from_users(db, t_doc)

    can_review_flag = (
        is_reviewer_or_admin
        and not is_owner
        and proposal.get("status") in {ProposalStatus.SUBMITTED.value, ProposalStatus.UNDER_REVIEW.value}
    )

    serialized = _serialize_doc(proposal)
    serialized["challenge"] = challenge_detail
    serialized["team"] = team_detail
    serialized["statusHistory"] = [_serialize_doc(h) for h in history_docs]
    serialized["reviews"] = [_serialize_doc(r) for r in review_docs]
    serialized["reviewHistory"] = [_serialize_doc(rh) for rh in rev_history_docs]
    serialized["permissions"] = {
        "isOwner": is_owner,
        "canEdit": is_owner and proposal.get("status") == ProposalStatus.DRAFT.value,
        "canDelete": (str(proposal.get("authorId")) == uid or is_admin)
        and proposal.get("status") == ProposalStatus.DRAFT.value,
        "canSubmit": is_owner and proposal.get("status") == ProposalStatus.DRAFT.value,
        "canWithdraw": str(proposal.get("authorId")) == uid
        and proposal.get("status") == ProposalStatus.SUBMITTED.value,
        "canReopen": str(proposal.get("authorId")) == uid
        and proposal.get("status") == ProposalStatus.WITHDRAWN.value,
        "canReview": can_review_flag,
        "canChangeStatus": can_review_flag,
    }
    return serialized


def _parse_iso_date(raw: str, *, end_of_day: bool = False) -> datetime:
    """Parse ISO date or datetime string, raising 400 on invalid input."""
    text = raw.strip()
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ISO date format: '{raw}'. Expected YYYY-MM-DD or ISO-8601 datetime.",
        )
    if dt.tzinfo is None:
        if end_of_day and len(text) <= 10:
            dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
        else:
            dt = dt.replace(tzinfo=timezone.utc)
    return dt


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
    Search, filter, sort, and paginate proposals from MongoDB while respecting RBAC & ownership.
    """
    _ensure_approved_account(current_user)
    db = get_database()
    uid = str(current_user["_id"])
    user_role = current_user.get("role")

    and_conditions: List[Dict[str, Any]] = []

    if mine_only:
        and_conditions.append(
            {
                "$or": [
                    {"authorId": uid},
                    {"verifiedMemberIds": uid},
                ]
            }
        )
    elif review_queue:
        _ensure_reviewer_role(current_user)
        # Reviewers only see reviewable/decided proposals (never drafts or withdrawn)
        # and NEVER proposals they authored or are verified team members of (M4).
        and_conditions.append(
            {
                "status": {
                    "$nin": [ProposalStatus.DRAFT.value, ProposalStatus.WITHDRAWN.value]
                }
            }
        )
        and_conditions.append({"authorId": {"$ne": uid}})
        and_conditions.append({"verifiedMemberIds": {"$ne": uid}})
    else:
        if user_role == UserRole.ADMIN.value:
            pass  # Admins can see all proposals
        elif user_role in REVIEWER_ROLES:
            # Reviewers see non-draft/non-withdrawn proposals + their own/team drafts & withdrawn
            and_conditions.append(
                {
                    "$or": [
                        {
                            "status": {
                                "$nin": [ProposalStatus.DRAFT.value, ProposalStatus.WITHDRAWN.value]
                            }
                        },
                        {"authorId": uid},
                        {"verifiedMemberIds": uid},
                    ]
                }
            )
        else:
            # Students/Citizens see all public submitted/reviewed/decided proposals + their own drafts/withdrawn
            and_conditions.append(
                {
                    "$or": [
                        {
                            "status": {
                                "$nin": [ProposalStatus.DRAFT.value, ProposalStatus.WITHDRAWN.value]
                            }
                        },
                        {"authorId": uid},
                        {"verifiedMemberIds": uid},
                    ]
                }
            )

    if status_filter and status_filter != "all":
        valid_statuses = {s.value for s in ProposalStatus}
        if status_filter not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter '{status_filter}'. Allowed: {sorted(valid_statuses)}.",
            )
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
        dt_from = _parse_iso_date(date_from, end_of_day=False)
        and_conditions.append({"createdAt": {"$gte": dt_from}})

    if date_to:
        dt_to = _parse_iso_date(date_to, end_of_day=True)
        and_conditions.append({"createdAt": {"$lte": dt_to}})

    query = {"$and": and_conditions} if and_conditions else {}

    # Sorting
    sort_spec = [("createdAt", -1)]
    if sort_by == "oldest":
        sort_spec = [("createdAt", 1)]
    elif sort_by in {"score_desc", "score"}:
        sort_spec = [("reviewSummary.totalScore", -1), ("createdAt", -1)]
    elif sort_by == "score_asc":
        sort_spec = [("reviewSummary.totalScore", 1), ("createdAt", -1)]
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


# ==============================================================================
# DASHBOARD STATISTICS (L3 FIX)
# ==============================================================================

async def get_dashboard_stats(current_user: dict, scope: str = "all") -> dict:
    """
    Calculate real MongoDB proposal KPI metrics, consistent status distribution (including withdrawn),
    my-proposals breakdown, and recent proposals respecting permissions and ownership (fixes L3).
    """
    _ensure_approved_account(current_user)
    db = get_database()

    uid = str(current_user["_id"])
    user_role = current_user.get("role")

    mine_filter: Dict[str, Any] = {
        "$or": [
            {"authorId": uid},
            {"verifiedMemberIds": uid},
        ]
    }

    if scope == "mine":
        base_filter: Dict[str, Any] = mine_filter
    elif user_role == UserRole.ADMIN.value:
        base_filter = {}
    else:
        base_filter = {
            "$or": [
                {
                    "status": {
                        "$nin": [ProposalStatus.DRAFT.value, ProposalStatus.WITHDRAWN.value]
                    }
                },
                {"authorId": uid},
                {"verifiedMemberIds": uid},
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

    # Complete status distribution matching totalProposals (fixes L3)
    distribution = [
        {"status": "draft", "label": "Draft", "count": draft_count, "percentage": _pct(draft_count)},
        {"status": "submitted", "label": "Submitted", "count": submitted_count, "percentage": _pct(submitted_count)},
        {"status": "under_review", "label": "Under Review", "count": under_review_count, "percentage": _pct(under_review_count)},
        {"status": "accepted", "label": "Accepted", "count": accepted_count, "percentage": _pct(accepted_count)},
        {"status": "rejected", "label": "Rejected", "count": rejected_count, "percentage": _pct(rejected_count)},
        {"status": "withdrawn", "label": "Withdrawn", "count": withdrawn_count, "percentage": _pct(withdrawn_count)},
    ]

    recent_cursor = db.proposals.find(base_filter).sort("updatedAt", -1).limit(5)
    recent_docs = await recent_cursor.to_list(length=5)

    # Personal proposal statistics breakdown
    my_pipeline = [
        {"$match": mine_filter},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    my_grouped = await db.proposals.aggregate(my_pipeline).to_list(length=20)
    my_by_status = {item["_id"]: item["count"] for item in my_grouped}
    my_total = sum(my_by_status.values())

    return {
        "totalProposals": total_count,
        "draftProposals": draft_count,
        "submittedProposals": submitted_count,
        "underReviewProposals": under_review_count,
        "acceptedProposals": accepted_count,
        "rejectedProposals": rejected_count,
        "withdrawnProposals": withdrawn_count,
        "myProposalsCount": my_total,
        "myProposalsStats": {
            "total": my_total,
            "draft": my_by_status.get(ProposalStatus.DRAFT.value, 0),
            "submitted": my_by_status.get(ProposalStatus.SUBMITTED.value, 0),
            "underReview": my_by_status.get(ProposalStatus.UNDER_REVIEW.value, 0),
            "accepted": my_by_status.get(ProposalStatus.ACCEPTED.value, 0),
            "rejected": my_by_status.get(ProposalStatus.REJECTED.value, 0),
            "withdrawn": my_by_status.get(ProposalStatus.WITHDRAWN.value, 0),
        },
        "statusDistribution": distribution,
        "recentProposals": [_serialize_doc(d) for d in recent_docs],
    }


# ==============================================================================
# EVALUATION & REVIEW WORKFLOW (H1, H3, M3, M4 FIXES)
# ==============================================================================

async def _recompute_proposal_review_summary(db, proposal_id: str) -> dict:
    """Recalculate aggregate total/average score and latest feedback from submitted reviews only."""
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
            "maxTotalScore": RUBRIC_MAX_TOTAL_SCORE,
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
        avg_total = round(sum(float(r.get("totalScore", 0.0)) for r in submitted_reviews) / count, 2)
        avg_criterion = round(sum(float(r.get("averageScore", 0.0)) for r in submitted_reviews) / count, 2)
        max_total = RUBRIC_MAX_TOTAL_SCORE
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
    Save a private review draft OR submit an official final review.
    - Enforces approved reviewer role (M4) and blocks self-review / team-member review.
    - Strictly validates criteria against backend-defined rubric 1-10 (H1).
    - Prevents duplicate final reviews by the same reviewer.
    - Draft reviews do NOT transition proposal status (M3).
    - Final reviews automatically transition 'submitted' -> 'under_review' and notify stakeholders (L2).
    """
    _ensure_reviewer_role(current_user)
    db = get_database()

    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if await _is_team_member_live(db, proposal, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-review is strictly prohibited. You cannot evaluate your own or your team's proposal.",
        )

    prop_status = proposal.get("status")
    if prop_status not in {ProposalStatus.SUBMITTED.value, ProposalStatus.UNDER_REVIEW.value}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot review a proposal with status '{prop_status}'. "
                "Proposal must be 'submitted' or 'under_review'."
            ),
        )

    # Strictly validate criteria scores against backend rubric (H1)
    normalized_criteria = _validate_and_normalize_criteria_scores(data.criteriaScores)

    reviewer_id = str(current_user["_id"])
    target_review_status = ReviewStatus.SUBMITTED if data.submitFinal else ReviewStatus.DRAFT

    existing = await db.proposal_reviews.find_one(
        {"proposalId": proposal_id, "reviewerId": reviewer_id}
    )

    # Prevent duplicate submitted reviews from the same reviewer
    if existing and existing.get("status") == ReviewStatus.SUBMITTED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already submitted an official review for this proposal. Duplicate reviews are not permitted.",
        )

    review_doc = new_review_document(
        proposal_id=proposal_id,
        reviewer_id=reviewer_id,
        reviewer_name=current_user.get("name", "Reviewer"),
        reviewer_role=current_user.get("role", "university"),
        criteria_scores=normalized_criteria,
        overall_feedback=data.overallFeedback,
        recommendation=data.recommendation,
        status=target_review_status,
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

    action_type = (
        "evaluation_submitted"
        if target_review_status == ReviewStatus.SUBMITTED
        else "draft_saved"
    )
    history_log = new_review_history_document(
        proposal_id=proposal_id,
        review_id=str(saved_review["_id"]),
        reviewer_id=reviewer_id,
        reviewer_name=current_user.get("name", "Reviewer"),
        reviewer_role=current_user.get("role", "university"),
        criteria_scores=normalized_criteria,
        total_score=review_doc["totalScore"],
        max_total_score=review_doc["maxTotalScore"],
        average_score=review_doc["averageScore"],
        percentage_score=review_doc["percentageScore"],
        overall_feedback=data.overallFeedback,
        recommendation=data.recommendation.value,
        action=action_type,
    )
    await db.proposal_review_history.insert_one(history_log)

    stakeholders = _get_proposal_stakeholder_ids(proposal)

    # M3 FIX: Only transition 'submitted' -> 'under_review' on FINAL review submission, NOT on draft save!
    if target_review_status == ReviewStatus.SUBMITTED and prop_status == ProposalStatus.SUBMITTED.value:
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
            changed_by_role=current_user.get("role", "university"),
            comment="Proposal entered evaluation upon official review submission.",
            score_snapshot=review_doc["totalScore"],
        )
        await db.proposal_status_history.insert_one(history_entry)

        await _notify_users(
            db,
            recipient_ids=stakeholders,
            title="Proposal Under Review",
            message=f"Your proposal '{proposal['title']}' is now Under Review by {current_user.get('name', 'a reviewer')}.",
            event_type="proposal_under_review",
            proposal_id=proposal_id,
            proposal_title=proposal["title"],
        )

    summary = await _recompute_proposal_review_summary(db, proposal_id)

    if target_review_status == ReviewStatus.SUBMITTED:
        await _notify_users(
            db,
            recipient_ids=stakeholders,
            title="New Evaluation & Feedback Added",
            message=(
                f"{current_user.get('name', 'A reviewer')} submitted an evaluation on '{proposal['title']}' "
                f"(Score: {review_doc['totalScore']}/{review_doc['maxTotalScore']}, Avg: {review_doc['averageScore']}/10)."
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
    Execute a controlled backend-validated reviewer status transition:
    Submitted -> Under Review -> Accepted / Rejected.
    Enforces at least one submitted review before Accepted / Rejected (fixes H3).
    """
    _ensure_reviewer_role(current_user)
    db = get_database()

    if not ObjectId.is_valid(proposal_id):
        raise HTTPException(status_code=400, detail="Invalid proposal ID.")

    proposal = await db.proposals.find_one({"_id": ObjectId(proposal_id)})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    if await _is_team_member_live(db, proposal, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change the review status or approve/reject your own or your team's proposal.",
        )

    current_status = ProposalStatus(proposal.get("status"))
    target_status = data.toStatus

    allowed_targets = REVIEWER_WORKFLOW_TRANSITIONS.get(current_status, [])
    if target_status not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition from '{current_status.value}' to '{target_status.value}'. "
                f"Allowed reviewer transitions from '{current_status.value}': {[s.value for s in allowed_targets]}."
            ),
        )

    now = datetime.now(timezone.utc)
    update_fields: Dict[str, Any] = {
        "status": target_status.value,
        "updatedAt": now,
    }

    review_summary = dict(proposal.get("reviewSummary") or {})
    if target_status in {ProposalStatus.ACCEPTED, ProposalStatus.REJECTED}:
        # H3 FIX: Require at least one officially submitted review before accepting or rejecting
        submitted_review_count = await db.proposal_reviews.count_documents(
            {"proposalId": proposal_id, "status": ReviewStatus.SUBMITTED.value}
        )
        if submitted_review_count < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one submitted evaluation review is required before accepting or rejecting a proposal.",
            )

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
        changed_by_role=current_user.get("role", "university"),
        comment=(data.comment or "").strip() or f"Status changed to {target_status.value}.",
        score_snapshot=review_summary.get("totalScore"),
    )
    await db.proposal_status_history.insert_one(history_entry)

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
        stakeholders = _get_proposal_stakeholder_ids(proposal)
        await _notify_users(
            db,
            recipient_ids=stakeholders,
            title=ntitle,
            message=nmsg,
            event_type=ntype,
            proposal_id=proposal_id,
            proposal_title=proposal["title"],
        )

    return await get_proposal_by_id(proposal_id, current_user)


# ==============================================================================
# SUPPORTING DOCUMENTS UPLOAD & PROTECTED ACCESS (H2 + L1 FIXES)
# ==============================================================================

async def upload_proposal_document(
    file: UploadFile,
    doc_type: str,
    current_user: dict,
    *,
    base_url: str = "",
) -> dict:
    """
    Validate and securely store a supporting document for a proposal.
    Stores metadata in `db.proposal_documents` and returns an authenticated absolute API URL
    (fixes H2 broken ReviewQueue URL and L1 public unauthenticated file access).
    """
    _ensure_proposer_role(current_user)
    db = get_database()

    raw_filename = os.path.basename(file.filename or "document.pdf")
    _, ext = os.path.splitext(raw_filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content_type = (file.content_type or "application/octet-stream").lower()
    if content_type and not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file MIME type '{content_type}'.",
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

    clean_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", os.path.splitext(raw_filename)[0]).strip("_")[:40] or "document"
    public_stem = f"{uuid.uuid4().hex[:12]}_{clean_stem}"
    unique_filename = f"{public_stem}{ext}"

    from app.utils.cloudinary_storage import is_cloudinary_configured, upload_bytes_to_cloudinary

    storage_provider = "local"
    storage_path = None
    cloudinary_url = None

    if is_cloudinary_configured():
        storage_provider = "cloudinary"
        cloudinary_url = await upload_bytes_to_cloudinary(
            content,
            folder="sociosolve/proposals",
            public_id=public_stem,
            resource_type="auto",
            filename=unique_filename,
        )
    else:
        safe_dir = os.path.abspath(os.path.join("uploads", "proposals"))
        os.makedirs(safe_dir, exist_ok=True)
        file_path = os.path.join(safe_dir, unique_filename)
        with open(file_path, "wb") as f:
            f.write(content)
        storage_path = os.path.join("uploads", "proposals", unique_filename)

    record = new_proposal_document_record(
        original_name=raw_filename,
        stored_filename=unique_filename,
        content_type=content_type,
        doc_type=doc_type or "supporting_document",
        size_bytes=size_bytes,
        uploaded_by=str(current_user["_id"]),
        storage_provider=storage_provider,
        storage_path=storage_path,
        cloudinary_url=cloudinary_url,
    )
    ins = await db.proposal_documents.insert_one(record)
    doc_id = str(ins.inserted_id)

    clean_base = (base_url or "").rstrip("/")
    protected_path = f"/api/proposals/documents/{doc_id}"
    file_url = f"{clean_base}{protected_path}" if clean_base else protected_path

    return {
        "docId": doc_id,
        "name": raw_filename,
        "url": file_url,
        "docType": doc_type or "supporting_document",
        "sizeBytes": size_bytes,
    }


async def get_protected_document(doc_id: str, current_user: dict):
    """
    Serve an uploaded proposal document only after verifying authentication and proposal/draft permissions (L1).
    """
    _ensure_approved_account(current_user)
    db = get_database()

    if not ObjectId.is_valid(doc_id):
        raise HTTPException(status_code=400, detail="Invalid document ID.")

    record = await db.proposal_documents.find_one({"_id": ObjectId(doc_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Document not found.")

    uid = str(current_user["_id"])
    is_admin = current_user.get("role") == UserRole.ADMIN.value
    is_uploader = str(record.get("uploadedBy")) == uid
    linked_proposal_id = record.get("proposalId")

    if not linked_proposal_id:
        # Unattached draft upload: private to uploader and admin only
        if not is_uploader and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this private document.",
            )
    else:
        proposal = None
        if ObjectId.is_valid(str(linked_proposal_id)):
            proposal = await db.proposals.find_one({"_id": ObjectId(str(linked_proposal_id))})
        if proposal:
            is_owner = await _is_team_member_live(db, proposal, current_user)
            if proposal.get("status") in {ProposalStatus.DRAFT.value, ProposalStatus.WITHDRAWN.value}:
                if not is_owner and not is_uploader and not is_admin:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Documents attached to draft or withdrawn proposals are private.",
                    )
        elif not is_uploader and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this document.",
            )

    if record.get("storageProvider") == "cloudinary" and record.get("cloudinaryUrl"):
        return RedirectResponse(url=record["cloudinaryUrl"], status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    stored_name = os.path.basename(record.get("storedFilename", ""))
    if not stored_name or not SAFE_FILENAME_RE.match(stored_name):
        raise HTTPException(status_code=404, detail="Document file is unavailable.")

    safe_dir = os.path.abspath(os.path.join("uploads", "proposals"))
    file_path = os.path.abspath(os.path.join(safe_dir, stored_name))
    if not file_path.startswith(safe_dir) or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Document file not found on storage.")

    return FileResponse(
        path=file_path,
        media_type=record.get("contentType") or "application/octet-stream",
        filename=record.get("originalName") or stored_name,
        headers={"X-Content-Type-Options": "nosniff"},
    )


# ==============================================================================
# NOTIFICATIONS
# ==============================================================================

async def get_user_notifications(current_user: dict) -> List[dict]:
    """Fetch recent notifications for the authenticated user."""
    db = get_database()
    uid = str(current_user["_id"])
    cursor = db.notifications.find({"userId": uid}).sort("createdAt", -1).limit(30)
    docs = await cursor.to_list(length=30)
    return [_serialize_doc(d) for d in docs]


async def mark_notification_read(notification_id: str, current_user: dict) -> dict:
    """Mark a single user-owned notification as read."""
    db = get_database()
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID.")
    existing = await db.notifications.find_one(
        {"_id": ObjectId(notification_id), "userId": str(current_user["_id"])}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Notification not found.")
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": str(current_user["_id"])},
        {"$set": {"isRead": True}},
    )
    return {"message": "Notification marked as read.", "id": notification_id}


async def mark_all_notifications_read(current_user: dict) -> dict:
    """Mark all unread notifications for the authenticated user as read."""
    db = get_database()
    uid = str(current_user["_id"])
    cursor = db.notifications.find({"userId": uid, "isRead": False}).limit(200)
    docs = await cursor.to_list(length=200)
    for d in docs:
        await db.notifications.update_one({"_id": d["_id"]}, {"$set": {"isRead": True}})
    return {"message": "All notifications marked as read.", "updatedCount": len(docs)}
