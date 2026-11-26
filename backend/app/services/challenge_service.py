"""
Challenge service layer for Module 2: Societal Challenge Management.

Encapsulates all asynchronous MongoDB operations, permissions validation,
filtering/search, attachment storage (Cloudinary with local filesystem fallback),
and status lifecycle transitions while preserving compatibility with Module 4.
"""
import math
import os
import re
import uuid
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId

from fastapi import HTTPException, status, UploadFile
from app.config.database import get_database
from app.models.challenge import (
    ChallengeCategory,
    ChallengeStatus,
    ChallengeDifficulty,
    is_valid_status_transition,
    is_published_status,
    new_challenge_document,
)
from app.schemas.challenge_schema import (
    ChallengeCreateRequest,
    ChallengeUpdateRequest,
    ChallengeStatusUpdateRequest,
    ChallengeResponse,
    ChallengeListResponse,
    challenge_to_response,
)

logger = logging.getLogger(__name__)

ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".doc",
    ".docx",
    ".zip",
}
MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit


def _find_id_filter(challenge_id: str) -> dict:
    """Build a MongoDB query filter matching an ObjectId, challengeCode, or string id."""
    filters = []
    if ObjectId.is_valid(challenge_id):
        filters.append({"_id": ObjectId(challenge_id)})
    filters.append({"challengeCode": challenge_id})
    filters.append({"id": challenge_id})
    return {"$or": filters} if len(filters) > 1 else filters[0]


async def _get_challenge_or_404(challenge_id: str, db=None) -> dict:
    """Retrieve raw challenge document from MongoDB or raise 404."""
    if db is None:
        db = get_database()
    doc = await db.challenges.find_one(_find_id_filter(challenge_id))
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Societal challenge not found.",
        )
    return doc


# ── 1. Create Challenge ──────────────────────────────────────────────────────

async def create_challenge(payload: ChallengeCreateRequest, current_user: dict) -> ChallengeResponse:
    """
    Create a new challenge in MongoDB.
    Sets authorId and creator attributes strictly from the authenticated user.
    """
    db = get_database()
    author_id = str(current_user["_id"])
    author_name = current_user.get("name") or "Anonymous"
    author_email = current_user.get("email")
    author_role = current_user.get("role", "citizen")
    is_admin = author_role == "admin"

    # Determine initial status
    requested_status = payload.status or ChallengeStatus.SUBMITTED
    if requested_status == ChallengeStatus.PUBLISHED and not is_admin:
        # Non-admins submitting a challenge can publish directly if self-service,
        # or have it as submitted/published. We preserve their explicit choice.
        target_status = ChallengeStatus.PUBLISHED
    else:
        target_status = requested_status

    # Convert attachments
    raw_attachments = [a.model_dump() for a in payload.attachments]

    doc = new_challenge_document(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        location=payload.location,
        author_id=author_id,
        author_name=author_name,
        author_email=author_email,
        author_role=author_role,
        difficulty=payload.difficulty,
        status=target_status,
        expected_impact=payload.expectedImpact,
        deadline=payload.deadline,
        tags=payload.tags,
        attachments=raw_attachments,
        created_by=author_name,
    )

    result = await db.challenges.insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Challenge created: %s (%s) by user %s", doc["title"], doc["challengeCode"], author_id)
    return challenge_to_response(doc)


# ── 2. Get Challenge Details ─────────────────────────────────────────────────

async def get_challenge_by_id(challenge_id: str, current_user: Optional[dict] = None) -> ChallengeResponse:
    """
    Retrieve challenge details by ID or challengeCode.
    Enforces draft visibility permissions and increments viewsCount atomically.
    """
    db = get_database()
    doc = await _get_challenge_or_404(challenge_id, db)

    # Draft visibility check
    if doc.get("status") == ChallengeStatus.DRAFT.value:
        uid = str(current_user["_id"]) if current_user else None
        is_admin = current_user and current_user.get("role") == "admin"
        is_author = uid and doc.get("authorId") == uid
        if not (is_admin or is_author):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Societal challenge not found.",
            )

    # Increment view count atomically in the background
    try:
        await db.challenges.update_one({"_id": doc["_id"]}, {"$inc": {"viewsCount": 1}})
        doc["viewsCount"] = doc.get("viewsCount", 0) + 1
    except Exception as exc:
        logger.warning("Failed to increment viewsCount for challenge %s: %s", doc.get("_id"), exc)

    return challenge_to_response(doc)


# ── 3. List Challenges (Discovery Catalog) ───────────────────────────────────

async def get_challenges(
    *,
    current_user: Optional[dict] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    location: Optional[str] = None,
    difficulty: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_by: str = "newest",
    page: int = 1,
    limit: int = 10,
) -> ChallengeListResponse:
    """
    Database-level filtered search and pagination for public and authenticated discovery.
    Drafts are strictly excluded from public discovery unless queried by an administrator
    or by the author themselves.
    """
    db = get_database()
    uid = str(current_user["_id"]) if current_user else None
    is_admin = bool(current_user and current_user.get("role") == "admin")

    query: Dict[str, Any] = {}

    # Status & Draft security filtering
    if status_filter:
        s_clean = status_filter.strip().lower()
        if s_clean == ChallengeStatus.DRAFT.value:
            if not is_admin and not uid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required to view draft challenges.",
                )
            if not is_admin:
                query["authorId"] = uid
            query["status"] = ChallengeStatus.DRAFT.value
        else:
            query["status"] = s_clean
    else:
        # Default discovery: never expose drafts in public listings
        if not is_admin:
            query["status"] = {"$ne": ChallengeStatus.DRAFT.value}

    # Keyword search across title, description, code, and tags
    if search and search.strip():
        term = re.escape(search.strip())
        query["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
            {"challengeCode": {"$regex": term, "$options": "i"}},
            {"tags": {"$regex": term, "$options": "i"}},
        ]

    # Category filter
    if category and category.strip():
        query["category"] = category.strip()

    # Location filter (case-insensitive substring)
    if location and location.strip():
        query["location"] = {"$regex": re.escape(location.strip()), "$options": "i"}

    # Difficulty filter
    if difficulty and difficulty.strip():
        query["difficulty"] = difficulty.strip()

    # Sorting
    sort_options = {
        "newest": [("createdAt", -1)],
        "oldest": [("createdAt", 1)],
        "views": [("viewsCount", -1), ("createdAt", -1)],
        "proposals": [("proposalsCount", -1), ("createdAt", -1)],
        "deadline": [("deadline", 1), ("createdAt", -1)],
    }
    sort_fields = sort_options.get(sort_by, [("createdAt", -1)])

    # Pagination bounds
    page = max(1, page)
    limit = max(1, min(50, limit))
    skip = (page - 1) * limit

    total = await db.challenges.count_documents(query)
    pages = max(1, math.ceil(total / limit))

    cursor = db.challenges.find(query).sort(sort_fields).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    return ChallengeListResponse(
        challenges=[challenge_to_response(d) for d in docs],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


# ── 4. My Challenges ─────────────────────────────────────────────────────────

async def get_my_challenges(
    current_user: dict,
    status_filter: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> ChallengeListResponse:
    """
    Retrieve challenges authored by the current user.
    Includes drafts, submitted, and active challenges owned by the caller.
    """
    db = get_database()
    uid = str(current_user["_id"])
    uemail = (current_user.get("email") or "").strip().lower()

    query: Dict[str, Any] = {
        "$or": [
            {"authorId": uid},
            {"authorEmail": uemail},
        ]
    }

    if status_filter and status_filter.strip():
        query["status"] = status_filter.strip().lower()

    page = max(1, page)
    limit = max(1, min(50, limit))
    skip = (page - 1) * limit

    total = await db.challenges.count_documents(query)
    pages = max(1, math.ceil(total / limit))

    cursor = db.challenges.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    return ChallengeListResponse(
        challenges=[challenge_to_response(d) for d in docs],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


# ── 5. Update Challenge ──────────────────────────────────────────────────────

async def update_challenge(
    challenge_id: str,
    payload: ChallengeUpdateRequest,
    current_user: dict,
) -> ChallengeResponse:
    """
    Update an existing challenge.
    Only the original author or an administrator is permitted to update.
    Protects system-managed fields and ensures isPublished consistency.
    """
    db = get_database()
    doc = await _get_challenge_or_404(challenge_id, db)

    uid = str(current_user["_id"])
    is_admin = current_user.get("role") == "admin"
    is_author = doc.get("authorId") == uid

    if not (is_admin or is_author):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this challenge.",
        )

    # Non-admins cannot edit resolved or closed challenges
    current_status = doc.get("status", ChallengeStatus.PUBLISHED.value)
    if not is_admin and current_status in {ChallengeStatus.RESOLVED.value, ChallengeStatus.CLOSED.value}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit a {current_status} challenge. Please contact an administrator.",
        )

    updates: Dict[str, Any] = {"updatedAt": datetime.now(timezone.utc)}

    if payload.title is not None:
        updates["title"] = payload.title.strip()
    if payload.description is not None:
        updates["description"] = payload.description.strip()
    if payload.category is not None:
        updates["category"] = payload.category.value
    if payload.location is not None:
        updates["location"] = payload.location.strip()
    if payload.difficulty is not None:
        updates["difficulty"] = payload.difficulty.value
    if payload.expectedImpact is not None:
        updates["expectedImpact"] = payload.expectedImpact.strip()
    if payload.deadline is not None:
        updates["deadline"] = payload.deadline.strip()
    if payload.tags is not None:
        updates["tags"] = payload.tags
    if payload.attachments is not None:
        updates["attachments"] = [a.model_dump() for a in payload.attachments]

    # Re-verify publication consistency
    updates["isPublished"] = is_published_status(current_status)

    await db.challenges.update_one({"_id": doc["_id"]}, {"$set": updates})
    updated_doc = await db.challenges.find_one({"_id": doc["_id"]})
    logger.info("Challenge updated: %s by user %s", challenge_id, uid)
    return challenge_to_response(updated_doc)


# ── 6. Delete Challenge ──────────────────────────────────────────────────────

async def delete_challenge(challenge_id: str, current_user: dict) -> dict:
    """
    Delete a challenge if no dependent records (proposals or teams) exist.
    Only the author or an administrator can delete.
    Never cascade-deletes proposals or teams.
    """
    db = get_database()
    doc = await _get_challenge_or_404(challenge_id, db)

    uid = str(current_user["_id"])
    is_admin = current_user.get("role") == "admin"
    is_author = doc.get("authorId") == uid

    if not (is_admin or is_author):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this challenge.",
        )

    cid_str = str(doc["_id"])

    # 1. Proposal dependency check (Module 4)
    proposals_count = await db.proposals.count_documents(
        {"$or": [{"challengeId": cid_str}, {"challengeId": challenge_id}]}
    )
    if proposals_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete challenge because it has {proposals_count} active or submitted proposal(s). "
                "Close or archive the challenge instead."
            ),
        )

    # 2. Team dependency check (Module 3)
    teams_count = await db.teams.count_documents(
        {"$or": [{"challengeId": cid_str}, {"challengeId": challenge_id}]}
    )
    if teams_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete challenge because it has {teams_count} associated team(s).",
        )

    await db.challenges.delete_one({"_id": doc["_id"]})
    logger.info("Challenge deleted: %s (%s) by user %s", doc.get("title"), cid_str, uid)
    return {"message": "Challenge deleted successfully.", "id": cid_str}


# ── 7. Status Management ─────────────────────────────────────────────────────

async def update_challenge_status(
    challenge_id: str,
    payload: ChallengeStatusUpdateRequest,
    current_user: dict,
) -> ChallengeResponse:
    """
    Transition challenge status following the defined lifecycle rules.
    Administrators can execute standard workflow transitions. Authors can withdraw
    or close their own challenges. Updates isPublished consistently for Module 4.
    """
    db = get_database()
    doc = await _get_challenge_or_404(challenge_id, db)

    uid = str(current_user["_id"])
    is_admin = current_user.get("role") == "admin"
    is_author = doc.get("authorId") == uid

    if not (is_admin or is_author):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update the status of this challenge.",
        )

    try:
        current_status = ChallengeStatus(doc.get("status", ChallengeStatus.PUBLISHED.value))
    except ValueError:
        current_status = ChallengeStatus.PUBLISHED

    target_status = payload.status

    # Validate transition state machine
    if not is_valid_status_transition(current_status, target_status):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{current_status.value}' to '{target_status.value}'.",
        )

    # Author permission restrictions
    if not is_admin:
        allowed_author_transitions = [
            (ChallengeStatus.DRAFT, ChallengeStatus.SUBMITTED),
            (ChallengeStatus.SUBMITTED, ChallengeStatus.DRAFT),  # Withdraw
            (ChallengeStatus.PUBLISHED, ChallengeStatus.CLOSED),  # Close own
        ]
        if (current_status, target_status) not in allowed_author_transitions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only administrators are authorized to change challenge status to '{target_status.value}'.",
            )

    now = datetime.now(timezone.utc)
    is_pub = is_published_status(target_status)

    update_fields: Dict[str, Any] = {
        "status": target_status.value,
        "isPublished": is_pub,
        "updatedAt": now,
    }
    if payload.reason:
        update_fields["statusChangeReason"] = payload.reason.strip()

    await db.challenges.update_one({"_id": doc["_id"]}, {"$set": update_fields})
    updated_doc = await db.challenges.find_one({"_id": doc["_id"]})
    logger.info("Challenge %s status changed: %s -> %s", challenge_id, current_status.value, target_status.value)
    return challenge_to_response(updated_doc)


# ── 8. Upload Challenge Attachment ───────────────────────────────────────────

async def upload_challenge_attachment(file: UploadFile, current_user: dict) -> dict:
    """
    Validate and store a supporting file/photo for a challenge.
    Reuses app.utils.cloudinary_storage with fallback to uploads/challenges/.
    """
    filename = file.filename or "attachment.pdf"
    _, ext = os.path.splitext(filename.lower())

    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}",
        )

    content = await file.read()
    size_bytes = len(content)

    if size_bytes == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if size_bytes > MAX_ATTACHMENT_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10 MB maximum limit.",
        )

    clean_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", os.path.splitext(filename)[0])[:40]
    public_stem = f"{uuid.uuid4().hex[:10]}_{clean_stem}"
    unique_filename = f"{public_stem}{ext}"

    from app.utils.cloudinary_storage import is_cloudinary_configured, upload_bytes_to_cloudinary

    if is_cloudinary_configured():
        file_url = await upload_bytes_to_cloudinary(
            content,
            folder="sociosolve/challenges",
            public_id=public_stem,
            resource_type="auto",
            filename=unique_filename,
        )
    else:
        safe_dir = os.path.join("uploads", "challenges")
        os.makedirs(safe_dir, exist_ok=True)
        file_path = os.path.join(safe_dir, unique_filename)
        with open(file_path, "wb") as f:
            f.write(content)
        file_url = f"/uploads/challenges/{unique_filename}"

    file_type = ext.lstrip(".").lower() or "document"
    return {
        "name": filename,
        "url": file_url,
        "fileType": file_type,
        "sizeBytes": size_bytes,
    }


# ── 9. Categories & Metadata ─────────────────────────────────────────────────

async def get_challenge_categories() -> dict:
    """
    Return all supported categories along with current challenge counts.
    """
    db = get_database()
    categories = [c.value for c in ChallengeCategory]

    # Aggregate counts of non-draft challenges per category
    pipeline = [
        {"$match": {"status": {"$ne": ChallengeStatus.DRAFT.value}}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    cursor = db.challenges.aggregate(pipeline)
    counts_map = {doc["_id"]: doc["count"] async for doc in cursor}

    data = [{"category": cat, "count": counts_map.get(cat, 0)} for cat in categories]
    return {"categories": data, "totalCategories": len(categories)}
