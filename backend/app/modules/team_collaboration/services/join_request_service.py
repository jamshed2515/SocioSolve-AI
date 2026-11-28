"""
Service layer for Module 3 – Join Requests (Phase 3).

Business logic for submitting, retrieving, approving, rejecting, and cancelling join requests.
Strictly reuses shared MongoDB connection and enforces RBAC & atomic capacity limits.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
import logging

from app.modules.team_collaboration.models.join_request_model import (
    JoinRequestStatus,
    new_join_request_document,
)
from app.modules.team_collaboration.models.team_model import TeamStatus
from app.modules.team_collaboration.schemas.join_request_schema import (
    CreateJoinRequest,
    JoinRequestListResponse,
    JoinRequestResponse,
)
from app.modules.team_collaboration.services import notification_service

logger = logging.getLogger(__name__)


def _serialize_id(oid: Any) -> str:
    return str(oid) if oid is not None else ""


async def _enrich_request_doc(db: Any, doc: Dict[str, Any]) -> JoinRequestResponse:
    """Enrich a join_request MongoDB document with team and applicant details."""
    team_id_raw = doc.get("team_id")
    team_oid = ObjectId(team_id_raw) if isinstance(team_id_raw, str) else team_id_raw
    user_id_raw = doc.get("user_id")
    user_oid = ObjectId(user_id_raw) if isinstance(user_id_raw, str) else user_id_raw

    team = await db.teams.find_one({"_id": team_oid}) if team_oid else None
    applicant = await db.users.find_one({"_id": user_oid}) if user_oid else None

    challenge_title = None
    leader_name = None
    if team:
        c_id = team.get("challenge_id")
        if c_id:
            c_oid = ObjectId(c_id) if isinstance(c_id, str) else c_id
            challenge = await db.challenges.find_one({"_id": c_oid})
            if challenge:
                challenge_title = challenge.get("title")

        l_id = team.get("leader_id")
        if l_id:
            l_oid = ObjectId(l_id) if isinstance(l_id, str) else l_id
            leader = await db.users.find_one({"_id": l_oid})
            if leader:
                leader_name = leader.get("name")

    return JoinRequestResponse(
        id=_serialize_id(doc.get("_id")),
        team_id=_serialize_id(team_oid),
        team_name=team.get("name") if team else "Unknown Team",
        team_status=team.get("status") if team else None,
        challenge_title=challenge_title or (team.get("challenge_title") if team else None),
        leader_id=_serialize_id(team.get("leader_id")) if team else None,
        leader_name=leader_name or "Team Leader",
        member_count=len(team.get("members", [])) if team else 0,
        max_members=team.get("max_members", 6) if team else 6,
        user_id=_serialize_id(user_oid),
        applicant_name=applicant.get("name") if applicant else "Student Applicant",
        applicant_email=applicant.get("email") if applicant else None,
        applicant_profile_image=applicant.get("profileImage") if applicant else None,
        applicant_skills=applicant.get("skills", []) if applicant else [],
        applicant_role=applicant.get("role") if applicant else None,
        message=doc.get("message"),
        status=doc.get("status", JoinRequestStatus.PENDING.value),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
        updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
    )


async def submit_join_request(
    db: Any,
    user_doc: Dict[str, Any],
    payload: CreateJoinRequest,
) -> JoinRequestResponse:
    """
    Submit a request to join a team.
    Identity is strictly derived from JWT user_doc.
    """
    user_id = user_doc["_id"]

    if not ObjectId.is_valid(payload.team_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format.",
        )
    team_oid = ObjectId(payload.team_id)
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # Team must be recruiting
    if team.get("status") != TeamStatus.RECRUITING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This team is currently '{team.get('status')}' and is not accepting join requests.",
        )

    # Team must not be full
    current_members = team.get("members", [])
    max_members = team.get("max_members", 6)
    if len(current_members) >= max_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This team has reached its maximum member capacity.",
        )

    # Requester must not be the leader
    if team.get("leader_id") == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are the leader of this team and cannot submit a join request to it.",
        )

    # Requester must not already be a member
    if any(m.get("user_id") == user_id for m in current_members):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this team.",
        )

    # Requester must not have an active pending request for this team
    existing_pending = await db.join_requests.find_one({
        "team_id": team_oid,
        "user_id": user_id,
        "status": JoinRequestStatus.PENDING.value,
    })
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending join request for this team.",
        )

    # Insert new join request document
    doc = new_join_request_document(
        team_id=team_oid,
        user_id=user_id,
        message=payload.message,
    )
    res = await db.join_requests.insert_one(doc)
    doc["_id"] = res.inserted_id

    logger.info(
        "User %s submitted join request for team '%s' (%s)",
        user_id,
        team.get("name"),
        payload.team_id,
    )

    # Phase 8: Notify team leader of new join request
    await notification_service.create_notification(
        recipient_id=team.get("leader_id"),
        sender_id=user_id,
        team_id=team_oid,
        notification_type="join_request_received",
        title="New Join Request Received",
        message=f"{user_doc.get('name', 'A student')} requested to join your team '{team.get('name')}'.",
        reference_id=str(res.inserted_id),
        reference_type="join_request",
        team_name=team.get("name"),
        sender_name=user_doc.get("name"),
    )

    return await _enrich_request_doc(db, doc)


async def get_my_join_requests(
    db: Any,
    user_id: str,
    status_filter: Optional[str] = None,
) -> JoinRequestListResponse:
    """Retrieve all join requests submitted by the authenticated user."""
    user_oid = ObjectId(user_id)
    query: Dict[str, Any] = {"user_id": user_oid}

    if status_filter and status_filter.lower() != "all":
        query["status"] = status_filter.lower()

    cursor = db.join_requests.find(query).sort("created_at", -1)
    requests: List[JoinRequestResponse] = []
    async for doc in cursor:
        requests.append(await _enrich_request_doc(db, doc))

    return JoinRequestListResponse(requests=requests, total=len(requests))


async def get_team_join_requests(
    db: Any,
    team_id: str,
    leader_user_id: str,
    status_filter: Optional[str] = None,
) -> JoinRequestListResponse:
    """
    Retrieve join requests for a team.
    Restricted to the team leader.
    """
    if not ObjectId.is_valid(team_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid team ID format.",
        )
    team_oid = ObjectId(team_id)
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # Only team leader can view join requests
    if str(team.get("leader_id")) != leader_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can access join requests for this team.",
        )

    query: Dict[str, Any] = {"team_id": team_oid}
    if status_filter and status_filter.lower() != "all":
        query["status"] = status_filter.lower()

    cursor = db.join_requests.find(query).sort("created_at", -1)
    requests: List[JoinRequestResponse] = []
    async for doc in cursor:
        requests.append(await _enrich_request_doc(db, doc))

    return JoinRequestListResponse(requests=requests, total=len(requests))


async def decide_join_request(
    db: Any,
    request_id: str,
    leader_user_id: str,
    decision: str,
) -> JoinRequestResponse:
    """
    Accept or reject a join request.
    Restricted strictly to the team leader.
    Acceptance performs atomic conditional membership update and capacity check.
    """
    if not ObjectId.is_valid(request_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request ID format.",
        )
    req_oid = ObjectId(request_id)
    req = await db.join_requests.find_one({"_id": req_oid})
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found.",
        )

    # Request must be pending
    if req.get("status") != JoinRequestStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This join request has already been {req.get('status')}.",
        )

    team_oid = req["team_id"]
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team not found.",
        )

    # Verify authenticated user is the leader
    if str(team.get("leader_id")) != leader_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can accept or reject join requests.",
        )

    now = datetime.now(timezone.utc)

    if decision == "rejected":
        await db.join_requests.update_one(
            {"_id": req_oid},
            {"$set": {"status": JoinRequestStatus.REJECTED.value, "updated_at": now}},
        )
        req["status"] = JoinRequestStatus.REJECTED.value
        req["updated_at"] = now
        logger.info("Leader rejected join request %s for team %s", request_id, team_oid)

        # Phase 8: Notify applicant of rejection
        await notification_service.create_notification(
            recipient_id=req["user_id"],
            sender_id=team.get("leader_id"),
            team_id=team_oid,
            notification_type="join_request_rejected",
            title="Join Request Status",
            message=f"Your request to join team '{team.get('name')}' was not approved at this time.",
            reference_id=str(team_oid),
            reference_type="team",
            team_name=team.get("name"),
        )

        return await _enrich_request_doc(db, req)

    # ── Acceptance Logic ────────────────────────────────────────────────────────
    applicant_oid = req["user_id"]

    # Verify applicant not already member
    if any(m.get("user_id") == applicant_oid for m in team.get("members", [])):
        await db.join_requests.update_one(
            {"_id": req_oid},
            {"$set": {"status": JoinRequestStatus.ACCEPTED.value, "updated_at": now}},
        )
        req["status"] = JoinRequestStatus.ACCEPTED.value
        req["updated_at"] = now
        return await _enrich_request_doc(db, req)

    # Verify team is still recruiting and not full
    max_members = team.get("max_members", 6)
    if len(team.get("members", [])) >= max_members:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot accept request: team has already reached its maximum capacity.",
        )

    # Atomic conditional update: push member only if current count < max_members
    member_entry = {
        "user_id": applicant_oid,
        "role": "Member",
        "joined_at": now,
    }

    # Conditional update using $expr to guarantee race-free capacity enforcement
    update_filter = {
        "_id": team_oid,
        "$expr": {"$lt": [{"$size": "$members"}, "$max_members"]},
        "members.user_id": {"$ne": applicant_oid},
    }

    # We use update_one with matched_count check
    update_res = await db.teams.update_one(
        update_filter,
        {
            "$push": {"members": member_entry},
            "$set": {"updated_at": now},
        },
    )

    if update_res.matched_count == 0:
        # Check why update failed
        fresh_team = await db.teams.find_one({"_id": team_oid})
        if not fresh_team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team no longer exists.")
        if len(fresh_team.get("members", [])) >= fresh_team.get("max_members", 6):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team capacity was reached by another acceptance.",
            )
        # If applicant was already added concurrently
        if any(m.get("user_id") == applicant_oid for m in fresh_team.get("members", [])):
            pass

    # Check if team is now full after adding member
    refreshed_team = await db.teams.find_one({"_id": team_oid})
    if refreshed_team and len(refreshed_team.get("members", [])) >= refreshed_team.get("max_members", 6):
        # Only change status to full if it was recruiting (do not overwrite active/completed)
        if refreshed_team.get("status") == TeamStatus.RECRUITING.value:
            await db.teams.update_one(
                {"_id": team_oid, "status": TeamStatus.RECRUITING.value},
                {"$set": {"status": TeamStatus.FULL.value, "updated_at": now}},
            )

    # Mark request as accepted
    await db.join_requests.update_one(
        {"_id": req_oid},
        {"$set": {"status": JoinRequestStatus.ACCEPTED.value, "updated_at": now}},
    )
    req["status"] = JoinRequestStatus.ACCEPTED.value
    req["updated_at"] = now

    logger.info("Leader accepted join request %s for team %s; member added.", request_id, team_oid)

    # Phase 8: Notify applicant of acceptance
    await notification_service.create_notification(
        recipient_id=applicant_oid,
        sender_id=team.get("leader_id"),
        team_id=team_oid,
        notification_type="join_request_accepted",
        title="Join Request Approved",
        message=f"Your request to join team '{team.get('name')}' was approved! You are now an active member.",
        reference_id=str(team_oid),
        reference_type="team",
        team_name=team.get("name"),
    )

    return await _enrich_request_doc(db, req)


async def cancel_join_request(
    db: Any,
    request_id: str,
    user_id: str,
) -> JoinRequestResponse:
    """
    Cancel a pending join request.
    Restricted strictly to the original requester.
    """
    if not ObjectId.is_valid(request_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request ID format.",
        )
    req_oid = ObjectId(request_id)
    req = await db.join_requests.find_one({"_id": req_oid})
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found.",
        )

    # Verify authenticated user is the requester
    if str(req.get("user_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own join requests.",
        )

    # Request must be pending
    if req.get("status") != JoinRequestStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a join request that is already '{req.get('status')}'.",
        )

    now = datetime.now(timezone.utc)
    await db.join_requests.update_one(
        {"_id": req_oid},
        {"$set": {"status": JoinRequestStatus.CANCELLED.value, "updated_at": now}},
    )
    req["status"] = JoinRequestStatus.CANCELLED.value
    req["updated_at"] = now

    logger.info("User %s cancelled join request %s", user_id, request_id)
    return await _enrich_request_doc(db, req)
