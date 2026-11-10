"""
Partnership service – business logic for Module 6: Industry Partnerships.
Handles opportunity CRUD, application processing, validation and status updates.
"""
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
import logging
import pymongo.errors

from app.config.database import get_database
from app.models.partnership import (
    OpportunityType,
    OpportunityStatus,
    ApplicationStatus,
    new_partnership_document,
    new_application_document,
)
from app.schemas.partnership_schema import (
    CreateOpportunityRequest,
    OpportunityResponse,
    OpportunityListResponse,
    ApplyOpportunityRequest,
    ApplicationResponse,
    ApplicationListResponse,
    UpdateApplicationStatusRequest,
)

logger = logging.getLogger(__name__)


# ── Serialization & Validation Helpers ────────────────────────────────────────

def _parse_object_id(id_str: str, entity_name: str = "Resource") -> ObjectId:
    """Validate and parse a MongoDB ObjectId string. Raises HTTP 400 if invalid."""
    if not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {entity_name} ID format.",
        )
    return ObjectId(id_str)


def _doc_to_opportunity(doc: dict) -> OpportunityResponse:
    return OpportunityResponse(
        id=str(doc["_id"]),
        industryUserId=str(doc["industryUserId"]),
        industryName=doc.get("industryName", "Industry Partner"),
        organizationName=doc.get("organizationName", "Partner Organization"),
        organizationWebsite=doc.get("organizationWebsite"),
        title=doc["title"],
        description=doc["description"],
        type=OpportunityType(doc["type"]),
        targetCategories=doc.get("targetCategories", []),
        resourcesOffered=doc.get("resourcesOffered", []),
        maxTeams=doc.get("maxTeams", 3),
        acceptedTeamsCount=doc.get("acceptedTeamsCount", 0),
        status=OpportunityStatus(doc.get("status", OpportunityStatus.ACTIVE.value)),
        createdAt=doc["createdAt"],
        updatedAt=doc.get("updatedAt", doc["createdAt"]),
    )


def _doc_to_application(doc: dict) -> ApplicationResponse:
    return ApplicationResponse(
        id=str(doc["_id"]),
        partnershipId=str(doc["partnershipId"]),
        partnershipTitle=doc.get("partnershipTitle", ""),
        applicantUserId=str(doc["applicantUserId"]),
        applicantName=doc.get("applicantName", "Student"),
        applicantEmail=doc.get("applicantEmail", ""),
        teamName=doc.get("teamName", "Team"),
        teamId=str(doc["teamId"]) if doc.get("teamId") else None,
        message=doc["message"],
        status=ApplicationStatus(doc.get("status", ApplicationStatus.PENDING.value)),
        feedback=doc.get("feedback"),
        createdAt=doc["createdAt"],
        updatedAt=doc.get("updatedAt", doc["createdAt"]),
    )


# ── Opportunity Operations ────────────────────────────────────────────────────

async def create_opportunity(user: dict, payload: CreateOpportunityRequest) -> OpportunityResponse:
    """Create a new partnership opportunity by an authenticated Industry partner."""
    db = get_database()

    org_data = user.get("organization") or {}
    org_name = org_data.get("name") or user.get("name") or "Industry Partner"
    org_website = org_data.get("website")

    doc = new_partnership_document(
        industry_user_id=str(user["_id"]),
        industry_name=user.get("name", "Industry Partner"),
        organization_name=org_name,
        title=payload.title,
        description=payload.description,
        opportunity_type=payload.type,
        target_categories=payload.targetCategories,
        resources_offered=payload.resourcesOffered,
        max_teams=payload.maxTeams,
        organization_website=org_website,
    )

    result = await db.partnerships.insert_one(doc)
    doc["_id"] = result.inserted_id

    logger.info(f"New partnership opportunity created: '{payload.title}' by {user.get('email')}")
    return _doc_to_opportunity(doc)


async def get_opportunities(
    opportunity_type: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> OpportunityListResponse:
    """Retrieve available partnership opportunities with optional filtering."""
    db = get_database()
    query: dict = {}

    if status_filter:
        query["status"] = status_filter
    if opportunity_type:
        query["type"] = opportunity_type
    if category:
        query["targetCategories"] = {"$in": [category]}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"organizationName": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.partnerships.find(query).sort("createdAt", -1)
    items = await cursor.to_list(length=100)
    opportunities = [_doc_to_opportunity(doc) for doc in items]

    return OpportunityListResponse(opportunities=opportunities, total=len(opportunities))


async def get_opportunity_by_id(opportunity_id: str) -> OpportunityResponse:
    """Get single opportunity details by ID."""
    db = get_database()
    oid = _parse_object_id(opportunity_id, "Opportunity")

    doc = await db.partnerships.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partnership opportunity not found.")

    return _doc_to_opportunity(doc)


async def get_my_opportunities(industry_user_id: str) -> OpportunityListResponse:
    """Get all opportunities created by the authenticated industry partner."""
    db = get_database()
    uid = _parse_object_id(industry_user_id, "User")

    cursor = db.partnerships.find({"industryUserId": uid}).sort("createdAt", -1)
    items = await cursor.to_list(length=100)
    opportunities = [_doc_to_opportunity(doc) for doc in items]

    return OpportunityListResponse(opportunities=opportunities, total=len(opportunities))


async def update_opportunity_status(
    opportunity_id: str, industry_user_id: str, new_status: OpportunityStatus
) -> OpportunityResponse:
    """Toggle opportunity status (Active/Closed). Only creator can update."""
    db = get_database()
    oid = _parse_object_id(opportunity_id, "Opportunity")
    uid = _parse_object_id(industry_user_id, "User")

    opportunity = await db.partnerships.find_one({"_id": oid})
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found.")

    if opportunity["industryUserId"] != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this opportunity.",
        )

    now = datetime.now(timezone.utc)
    await db.partnerships.update_one(
        {"_id": oid},
        {"$set": {"status": new_status.value, "updatedAt": now}},
    )

    updated = await db.partnerships.find_one({"_id": oid})
    return _doc_to_opportunity(updated)


# ── Application Operations ────────────────────────────────────────────────────

async def apply_to_opportunity(
    opportunity_id: str, student_user: dict, payload: ApplyOpportunityRequest
) -> ApplicationResponse:
    """
    Submit an application to a partnership opportunity by a student team.

    NOTE ON MODULE 3 INTEGRATION:
    Currently, unique application checks are enforced at the (partnershipId, applicantUserId) level
    as a temporary solution while Module 3 (Team Formation) is pending development.
    When Module 3 is integrated, duplicate prevention will be upgraded to validate on
    (partnershipId, teamId) and ensure team membership via Member 3's team service.
    """
    db = get_database()
    oid = _parse_object_id(opportunity_id, "Opportunity")
    student_id = student_user["_id"]

    # 1. Verify opportunity exists and is Active
    opportunity = await db.partnerships.find_one({"_id": oid})
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partnership opportunity not found.")

    if opportunity.get("status") != OpportunityStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This partnership opportunity is closed and is no longer accepting applications.",
        )

    # 2. Check team capacity limit
    accepted_count = opportunity.get("acceptedTeamsCount", 0)
    max_teams = opportunity.get("maxTeams", 3)
    if accepted_count >= max_teams:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This opportunity has reached its maximum accepted teams capacity.",
        )

    # 3. Check for existing application by this student for this opportunity (temporary student-level constraint)
    existing = await db.partnership_applications.find_one(
        {"partnershipId": oid, "applicantUserId": student_id}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your team or account has already submitted an application for this partnership opportunity.",
        )

    # 4. Build and insert application document
    app_doc = new_application_document(
        partnership_id=opportunity_id,
        partnership_title=opportunity["title"],
        applicant_user_id=str(student_id),
        applicant_name=student_user.get("name", "Student"),
        applicant_email=student_user.get("email", ""),
        team_name=payload.teamName,
        message=payload.message,
        team_id=payload.teamId,
    )

    try:
        result = await db.partnership_applications.insert_one(app_doc)
        app_doc["_id"] = result.inserted_id
    except pymongo.errors.DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your team or account has already submitted an application for this partnership opportunity.",
        )

    logger.info(
        f"Application submitted for '{opportunity['title']}' by team '{payload.teamName}' ({student_user.get('email')})"
    )
    return _doc_to_application(app_doc)


async def get_opportunity_applications(opportunity_id: str, industry_user_id: str) -> ApplicationListResponse:
    """Get all applications for a specific opportunity. Only the owner industry user can view."""
    db = get_database()
    oid = _parse_object_id(opportunity_id, "Opportunity")
    uid = _parse_object_id(industry_user_id, "User")

    opportunity = await db.partnerships.find_one({"_id": oid})
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found.")

    if opportunity["industryUserId"] != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view applications for this opportunity.",
        )

    cursor = db.partnership_applications.find({"partnershipId": oid}).sort("createdAt", -1)
    items = await cursor.to_list(length=200)
    applications = [_doc_to_application(doc) for doc in items]

    return ApplicationListResponse(applications=applications, total=len(applications))


async def get_my_applications(student_user_id: str) -> ApplicationListResponse:
    """Get all applications submitted by the authenticated student."""
    db = get_database()
    uid = _parse_object_id(student_user_id, "User")

    cursor = db.partnership_applications.find({"applicantUserId": uid}).sort("createdAt", -1)
    items = await cursor.to_list(length=100)
    applications = [_doc_to_application(doc) for doc in items]

    return ApplicationListResponse(applications=applications, total=len(applications))


async def get_all_incoming_applications(industry_user_id: str) -> ApplicationListResponse:
    """Get all applications across ALL opportunities created by this industry user."""
    db = get_database()
    uid = _parse_object_id(industry_user_id, "User")

    # Find all opportunity IDs owned by this industry partner
    opportunities = await db.partnerships.find({"industryUserId": uid}, {"_id": 1}).to_list(length=500)
    opp_ids = [opp["_id"] for opp in opportunities]

    if not opp_ids:
        return ApplicationListResponse(applications=[], total=0)

    cursor = db.partnership_applications.find({"partnershipId": {"$in": opp_ids}}).sort("createdAt", -1)
    items = await cursor.to_list(length=200)
    applications = [_doc_to_application(doc) for doc in items]

    return ApplicationListResponse(applications=applications, total=len(applications))


async def update_application_status(
    application_id: str, industry_user_id: str, payload: UpdateApplicationStatusRequest
) -> ApplicationResponse:
    """
    Accept or Reject an application with atomic capacity enforcement, CAS concurrency protection,
    and rollback compensation safety.

    Guarantees:
    1. Authorization: Only the opportunity owner can review and accept/reject applications.
    2. Concurrency Safety (CAS): Uses compare-and-swap on the exact current application status
       in the update query (`{"_id": app_oid, "status": current_status}`) so concurrent Accept/Reject
       requests cannot both update the same application.
    3. Counter Exactness: acceptedTeamsCount is changed exactly once per successful transition.
    4. Quota Enforcement: maxTeams cannot be exceeded; acceptance fails atomically if capacity reached.
    5. Closed Opportunity Guard: Applications cannot be accepted after an opportunity has been closed.
    6. Deployment Safety: Attempts multi-document transactions when supported by deployment;
       otherwise executes safe conditional updates with automatic rollback compensation.
    """
    db = get_database()
    app_oid = _parse_object_id(application_id, "Application")
    uid = _parse_object_id(industry_user_id, "User")

    app_doc = await db.partnership_applications.find_one({"_id": app_oid})
    if not app_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")

    # Verify ownership via the parent partnership
    opportunity = await db.partnerships.find_one({"_id": app_doc["partnershipId"]})
    if not opportunity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated partnership not found.")

    if opportunity["industryUserId"] != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to review applications for this opportunity.",
        )

    current_status = app_doc.get("status")
    target_status = payload.status.value

    # Idempotent return if application is already in the requested status
    if current_status == target_status:
        return _doc_to_application(app_doc)

    now = datetime.now(timezone.utc)

    # Detect multi-document transaction support (MongoDB replica set vs standalone/mock)
    client = getattr(db, "client", None)
    supports_tx = False
    session = None
    if client and hasattr(client, "start_session"):
        try:
            session = await client.start_session()
            session.start_transaction()
            supports_tx = True
        except Exception:
            session = None
            supports_tx = False

    tx_kwargs = {"session": session} if (supports_tx and session) else {}

    try:
        # ── CASE 1: Transitioning to Accepted ──────────────────────────────────────
        if target_status == ApplicationStatus.ACCEPTED.value:
            # Check opportunity status before attempting acceptance
            if opportunity.get("status") != OpportunityStatus.ACTIVE.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot accept application. The opportunity is closed.",
                )

            # Atomically reserve a slot on the opportunity (must be ACTIVE and below maxTeams)
            opp_res = await db.partnerships.update_one(
                {
                    "_id": opportunity["_id"],
                    "status": OpportunityStatus.ACTIVE.value,
                    "$expr": {"$lt": ["$acceptedTeamsCount", "$maxTeams"]},
                },
                {
                    "$inc": {"acceptedTeamsCount": 1},
                    "$set": {"updatedAt": now},
                },
                **tx_kwargs,
            )

            if opp_res.matched_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot accept application. The opportunity is either closed or has already reached its maximum accepted teams capacity.",
                )

            # Compare-And-Swap (CAS) update application only if status is STILL current_status
            app_res = await db.partnership_applications.update_one(
                {
                    "_id": app_oid,
                    "status": current_status,  # Exact CAS matching prevents concurrent race
                },
                {
                    "$set": {
                        "status": ApplicationStatus.ACCEPTED.value,
                        "feedback": payload.feedback,
                        "updatedAt": now,
                    }
                },
                **tx_kwargs,
            )

            if app_res.matched_count == 0:
                # Concurrent race condition: another request modified this application
                # Execute compensation rollback to release the reserved slot on the opportunity
                if not supports_tx:
                    await db.partnerships.update_one(
                        {"_id": opportunity["_id"], "acceptedTeamsCount": {"$gt": 0}},
                        {"$inc": {"acceptedTeamsCount": -1}, "$set": {"updatedAt": now}},
                    )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Application was modified concurrently. Please reload and try again.",
                )

        # ── CASE 2: Transitioning to Rejected ──────────────────────────────────────
        elif target_status == ApplicationStatus.REJECTED.value:
            # Compare-And-Swap (CAS) update application only if status is STILL current_status
            app_res = await db.partnership_applications.update_one(
                {
                    "_id": app_oid,
                    "status": current_status,  # Exact CAS matching prevents concurrent race
                },
                {
                    "$set": {
                        "status": ApplicationStatus.REJECTED.value,
                        "feedback": payload.feedback,
                        "updatedAt": now,
                    }
                },
                **tx_kwargs,
            )

            if app_res.matched_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Application was modified concurrently. Please reload and try again.",
                )

            # If transitioning from Accepted -> Rejected, atomically decrement acceptedTeamsCount
            if current_status == ApplicationStatus.ACCEPTED.value:
                await db.partnerships.update_one(
                    {"_id": opportunity["_id"], "acceptedTeamsCount": {"$gt": 0}},
                    {"$inc": {"acceptedTeamsCount": -1}, "$set": {"updatedAt": now}},
                    **tx_kwargs,
                )

        if supports_tx and session:
            await session.commit_transaction()

    except Exception as e:
        if supports_tx and session:
            try:
                await session.abort_transaction()
            except Exception:
                pass
        raise e
    finally:
        if session and hasattr(session, "end_session"):
            try:
                res = session.end_session()
                if hasattr(res, "__await__"):
                    await res
            except Exception:
                pass

    updated_app = await db.partnership_applications.find_one({"_id": app_oid})
    logger.info(
        f"Application {application_id} updated to {target_status} by industry partner {uid}"
    )
    return _doc_to_application(updated_app)
