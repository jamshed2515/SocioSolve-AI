"""
Service layer for Module 3 – Team Creation & Management (Phase 2).

Business logic for creating, fetching, updating, and deleting innovation teams.
Strictly reuses shared MongoDB Atlas connection and enforces RBAC.
"""
from datetime import datetime, timezone
import math
import re
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
import logging

from app.modules.team_collaboration.models.team_model import (
    MemberRole,
    TeamStatus,
    create_team_indexes,
    new_team_document,
)
from app.modules.team_collaboration.schemas.team_schema import (
    TeamCreate,
    TeamListResponse,
    TeamMemberSchema,
    TeamResponse,
    TeamUpdate,
)

logger = logging.getLogger(__name__)


def _serialize_object_id(oid: Any) -> str:
    return str(oid) if oid is not None else ""


async def ensure_team_indexes(db: Any) -> None:
    """Ensure indexes on startup or first call."""
    await create_team_indexes(db)


async def ensure_published_challenges(db: Any) -> List[Dict[str, Any]]:
    """
    Ensure challenge references exist in `db.challenges` so team creation works
    seamlessly even before Module 2 is fully integrated.
    """
    count = await db.challenges.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc)
        default_challenges = [
            {
                "title": "IoT Groundwater & Drinking Water Monitoring – Dhanbad & Bokaro",
                "category": "Water & Environment",
                "description": "Deploy affordable IoT water quality sensors in rural panchayats to detect contamination.",
                "location": "Dhanbad, Jharkhand",
                "status": "published",
                "isPublished": True,
                "createdAt": now,
            },
            {
                "title": "Direct Market Access for Tribal Dokra & Sohrai Artisans",
                "category": "Rural Economy & Crafts",
                "description": "Digital storytelling and fair-trade marketplace for indigenous handicraft clusters.",
                "location": "Hazaribagh & Ranchi, Jharkhand",
                "status": "published",
                "isPublished": True,
                "createdAt": now,
            },
            {
                "title": "Multilingual AI Learning Companion for Santhali & Mundari Children",
                "category": "Education & Tribal Languages",
                "description": "Voice-enabled offline interactive tutor preserving native Jharkhand tribal dialects.",
                "location": "Ranchi & Dumka, Jharkhand",
                "status": "published",
                "isPublished": True,
                "createdAt": now,
            },
            {
                "title": "Smart Solar Cold Storage for Smallholder Vegetable Farmers",
                "category": "Agriculture & Cold Chain",
                "description": "Decentralized solar cooling units preventing post-harvest tomato and green vegetable rot.",
                "location": "Ranchi, Jharkhand",
                "status": "published",
                "isPublished": True,
                "createdAt": now,
            },
        ]
        await db.challenges.insert_many(default_challenges)

    cursor = db.challenges.find(
        {"$or": [{"isPublished": True}, {"status": "published"}]}
    )
    results = []
    async for doc in cursor:
        results.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", "Societal Challenge"),
            "category": doc.get("category", "General"),
            "description": doc.get("description", ""),
            "location": doc.get("location", "Jharkhand"),
            "status": doc.get("status", "published"),
        })
    return results


async def _enrich_team_doc(db: Any, team_doc: Dict[str, Any], current_user_id: Optional[str] = None) -> TeamResponse:
    """Enrich team document with leader names, member names, and challenge metadata."""
    team_id_str = str(team_doc["_id"])
    leader_oid = team_doc.get("leader_id")
    leader_id_str = str(leader_oid) if leader_oid else ""
    challenge_oid = team_doc.get("challenge_id")
    challenge_id_str = str(challenge_oid) if challenge_oid else ""

    # Fetch Leader details
    leader_name = "Team Leader"
    if leader_oid:
        leader_user = await db.users.find_one({"_id": leader_oid})
        if leader_user:
            leader_name = leader_user.get("name", "Team Leader")

    # Fetch Challenge details
    challenge_title = "Societal Challenge"
    challenge_category = "General"
    if challenge_oid:
        challenge_doc = await db.challenges.find_one({"_id": challenge_oid})
        if challenge_doc:
            challenge_title = challenge_doc.get("title", "Societal Challenge")
            challenge_category = challenge_doc.get("category", "General")

    # Member schemas & details
    members_raw = team_doc.get("members", [])
    members_schemas: List[TeamMemberSchema] = []
    member_user_ids = [m.get("user_id") for m in members_raw if m.get("user_id")]

    user_map = {}
    if member_user_ids:
        async for u in db.users.find({"_id": {"$in": member_user_ids}}):
            user_map[str(u["_id"])] = u

    is_current_leader = bool(current_user_id and str(current_user_id) == leader_id_str)
    is_current_member = False

    for m in members_raw:
        uid_str = str(m.get("user_id", ""))
        if current_user_id and str(current_user_id) == uid_str:
            is_current_member = True

        user_info = user_map.get(uid_str)
        m_name = user_info.get("name") if user_info else (leader_name if uid_str == leader_id_str else "Member")
        m_email = user_info.get("email") if user_info else None
        joined_at = m.get("joined_at", team_doc.get("created_at", datetime.now(timezone.utc)))

        members_schemas.append(
            TeamMemberSchema(
                user_id=uid_str,
                name=m_name,
                email=m_email,
                role=m.get("role", MemberRole.MEMBER.value),
                joined_at=joined_at,
            )
        )

    # Sort members: Team Leader first
    members_schemas.sort(key=lambda x: 0 if x.role == MemberRole.LEADER.value else 1)

    member_count = len(members_schemas)
    max_members = team_doc.get("max_members", 6)

    # Auto-adjust status if full
    status_str = team_doc.get("status", TeamStatus.RECRUITING.value)
    if status_str == TeamStatus.RECRUITING.value and member_count >= max_members:
        status_str = TeamStatus.FULL.value

    # Look up current user's join request status if logged in
    user_request_status = None
    user_request_id = None
    team_oid = team_doc.get("_id")
    join_requests_col = getattr(db, "join_requests", None)
    if join_requests_col is not None and current_user_id and ObjectId.is_valid(current_user_id) and team_oid:
        latest_req = await join_requests_col.find_one(
            {"team_id": team_oid, "user_id": ObjectId(current_user_id)},
            sort=[("created_at", -1)],
        )
        if latest_req:
            user_request_status = latest_req.get("status")
            user_request_id = str(latest_req["_id"])

    return TeamResponse(
        id=team_id_str,
        name=team_doc.get("name", "Untitled Team"),
        description=team_doc.get("description", ""),
        challenge_id=challenge_id_str,
        challenge_title=challenge_title,
        challenge_category=challenge_category,
        leader_id=leader_id_str,
        leader_name=leader_name,
        members=members_schemas,
        member_count=member_count,
        max_members=max_members,
        status=status_str,
        is_leader=is_current_leader,
        is_member=is_current_member or is_current_leader,
        user_request_status=user_request_status,
        user_request_id=user_request_id,
        created_at=team_doc.get("created_at", datetime.now(timezone.utc)),
        updated_at=team_doc.get("updated_at", datetime.now(timezone.utc)),
    )


async def create_team(db: Any, user_doc: Dict[str, Any], payload: TeamCreate) -> TeamResponse:
    """
    Create a new team associated with a societal challenge.
    Creator is automatically enrolled as Team Leader with 1 member count.
    """
    user_id = user_doc["_id"]
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)

    # Validate challenge exists
    if not ObjectId.is_valid(payload.challenge_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid challenge ID format.",
        )

    challenge_oid = ObjectId(payload.challenge_id)
    challenge = await db.challenges.find_one({"_id": challenge_oid})
    if not challenge:
        # Check if seed challenges need to be generated
        await ensure_published_challenges(db)
        challenge = await db.challenges.find_one({"_id": challenge_oid})
        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected societal challenge does not exist.",
            )

    # Build fresh team document
    team_doc = new_team_document(
        name=payload.name,
        description=payload.description,
        challenge_id=challenge_oid,
        leader_id=user_id,
        max_members=payload.max_members,
        status=TeamStatus.RECRUITING,
    )

    insert_result = await db.teams.insert_one(team_doc)
    team_doc["_id"] = insert_result.inserted_id

    logger.info("Created new team '%s' (ID: %s) by leader %s", payload.name, team_doc["_id"], user_id)
    return await _enrich_team_doc(db, team_doc, current_user_id=str(user_id))


async def get_my_teams(db: Any, user_id: str, page: int = 1, limit: int = 10) -> TeamListResponse:
    """Retrieve all teams where the authenticated user is Leader or Member."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format.",
        )

    user_oid = ObjectId(user_id)
    query = {
        "$or": [
            {"leader_id": user_oid},
            {"members.user_id": user_oid},
        ]
    }

    total = await db.teams.count_documents(query)
    skip = (page - 1) * limit
    pages = math.ceil(total / limit) if total > 0 else 1

    cursor = db.teams.find(query).sort("updated_at", -1).skip(skip).limit(limit)
    teams: List[TeamResponse] = []
    async for doc in cursor:
        teams.append(await _enrich_team_doc(db, doc, current_user_id=user_id))

    return TeamListResponse(
        teams=teams,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_all_teams(
    db: Any,
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    challenge_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user_id: Optional[str] = None,
) -> TeamListResponse:
    """
    Retrieve all teams with optional search, challenge filtering, and status filtering.
    """
    query: Dict[str, Any] = {}

    if search:
        escaped = re.escape(search.strip())
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"description": {"$regex": escaped, "$options": "i"}},
        ]

    if challenge_id and challenge_id.strip() and challenge_id != "all":
        if ObjectId.is_valid(challenge_id.strip()):
            query["challenge_id"] = ObjectId(challenge_id.strip())

    if status_filter and status_filter.strip() and status_filter.lower() != "all":
        query["status"] = status_filter.strip().lower()

    total = await db.teams.count_documents(query)
    skip = (page - 1) * limit
    pages = math.ceil(total / limit) if total > 0 else 1

    cursor = db.teams.find(query).sort("created_at", -1).skip(skip).limit(limit)
    teams: List[TeamResponse] = []
    async for doc in cursor:
        teams.append(await _enrich_team_doc(db, doc, current_user_id=current_user_id))

    return TeamListResponse(
        teams=teams,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_team_by_id(db: Any, team_id: str, current_user_id: Optional[str] = None) -> TeamResponse:
    """Retrieve a single team by its unique ID."""
    if not ObjectId.is_valid(team_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    team_doc = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    return await _enrich_team_doc(db, team_doc, current_user_id=current_user_id)


async def update_team(db: Any, team_id: str, user_id: str, payload: TeamUpdate) -> TeamResponse:
    """
    Update team name, description, or capacity.
    Restricted strictly to the Team Leader.
    Prevents reducing capacity below current member count.
    """
    if not ObjectId.is_valid(team_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # Leader authorization check
    if str(team.get("leader_id")) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Only the team leader can modify team details.",
        )

    updates: Dict[str, Any] = {}
    current_members_count = len(team.get("members", []))

    if payload.name is not None:
        updates["name"] = payload.name

    if payload.description is not None:
        updates["description"] = payload.description

    if payload.max_members is not None:
        if payload.max_members < current_members_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reduce capacity to {payload.max_members}. The team currently has {current_members_count} members.",
            )
        updates["max_members"] = payload.max_members

        # Adjust status between recruiting and full if active/completed not set
        current_status = team.get("status", TeamStatus.RECRUITING.value)
        if current_status in [TeamStatus.RECRUITING.value, TeamStatus.FULL.value]:
            if current_members_count >= payload.max_members:
                updates["status"] = TeamStatus.FULL.value
            else:
                updates["status"] = TeamStatus.RECRUITING.value

    if not updates:
        return await _enrich_team_doc(db, team, current_user_id=user_id)

    updates["updated_at"] = datetime.now(timezone.utc)
    await db.teams.update_one({"_id": ObjectId(team_id)}, {"$set": updates})

    updated_team = await db.teams.find_one({"_id": ObjectId(team_id)})
    return await _enrich_team_doc(db, updated_team, current_user_id=user_id)


async def delete_team(db: Any, team_id: str, user_id: str) -> Dict[str, Any]:
    """
    Delete a team and its associated team record.
    Restricted strictly to the Team Leader.
    """
    if not ObjectId.is_valid(team_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # Leader authorization check
    if str(team.get("leader_id")) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Only the team leader can delete this team.",
        )

    await db.teams.delete_one({"_id": ObjectId(team_id)})
    logger.info("Team %s successfully deleted by leader %s", team_id, user_id)
    return {
        "message": f"Team '{team.get('name')}' successfully deleted.",
        "team_id": team_id,
    }

