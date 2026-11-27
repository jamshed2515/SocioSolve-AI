"""
Service layer for Module 3 – Team Meeting Management (Phase 7).

Business logic for:
- Creating meetings (leader only, team attendees validation, time validation)
- Listing team meetings (pagination, filters: status, upcoming/past, sorted by date)
- Listing my meetings (across teams for authenticated attendee)
- Getting meeting details (team info, organizer, attendees, permissions)
- Updating meetings (leader or organizer)
- Cancelling meetings (leader or organizer)
- Deleting meetings (leader only)
"""
from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Set
from bson import ObjectId
from fastapi import HTTPException, status
import logging

from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.models.meeting_model import (
    MeetingStatus,
    MeetingType,
    new_meeting_document,
)
from app.modules.team_collaboration.schemas.meeting_schema import (
    AttendeeInfo,
    MeetingCreate,
    MeetingListResponse,
    MeetingPermissions,
    MeetingResponse,
    MeetingUpdate,
)
from app.modules.team_collaboration.services import notification_service
from app.modules.team_collaboration.socket import emit_to_team

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_object_id(id_str: str, label: str = "ID") -> ObjectId:
    if not id_str or not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}: '{id_str}'",
        )
    return ObjectId(id_str)


def _extract_user_id(current_user: Dict[str, Any]) -> str:
    """Extract string user ID whether dict has '_id' (MongoDB) or 'id' (test mocks/schemas)."""
    val = current_user.get("_id") or current_user.get("id")
    if not val:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication error: user ID missing.",
        )
    return str(val)


def _is_team_member(team: Dict[str, Any], user_id: str) -> bool:
    if not team or not user_id:
        return False
    if str(team.get("leader_id", "")) == str(user_id):
        return True
    return any(str(m.get("user_id", "")) == str(user_id) for m in team.get("members", []))


def _get_team_member_ids(team: Dict[str, Any]) -> Set[str]:
    ids = set()
    if team.get("leader_id"):
        ids.add(str(team["leader_id"]))
    for m in team.get("members", []):
        if m.get("user_id"):
            ids.add(str(m["user_id"]))
    return ids


def _validate_and_clean_attendees(
    attendees_raw: Optional[List[str]], team: Dict[str, Any]
) -> List[ObjectId]:
    if not attendees_raw:
        return []

    valid_member_ids = _get_team_member_ids(team)
    cleaned_oids: List[ObjectId] = []
    seen = set()

    for uid in attendees_raw:
        uid_str = str(uid).strip()
        if not uid_str:
            continue
        if not ObjectId.is_valid(uid_str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid attendee user ID: '{uid_str}'",
            )
        if uid_str not in valid_member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {uid_str} is not a member of team '{team.get('name', 'this team')}'. External attendees cannot be added.",
            )
        if uid_str not in seen:
            seen.add(uid_str)
            cleaned_oids.append(ObjectId(uid_str))

    return cleaned_oids


def _is_meeting_upcoming(meeting_doc: Dict[str, Any]) -> bool:
    m_date = meeting_doc.get("meeting_date")
    if not m_date or meeting_doc.get("status") == MeetingStatus.CANCELLED.value:
        return False
    now = _utc_now()
    if m_date.tzinfo is None:
        m_date = m_date.replace(tzinfo=timezone.utc)
    return m_date >= now


async def _enrich_meeting_response(
    db: Any, meeting_doc: Dict[str, Any], current_user_id: Optional[str] = None
) -> MeetingResponse:
    team_oid = meeting_doc.get("team_id")
    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    team_name = team.get("name", "Unknown Team") if team else None

    # Fetch Organizer
    organizer_oid = meeting_doc.get("scheduled_by")
    organizer_name = "Team Leader"
    organizer_email = None
    if organizer_oid:
        organizer_doc = await db.users.find_one({"_id": organizer_oid})
        if organizer_doc:
            organizer_name = organizer_doc.get("name", "Team Leader")
            organizer_email = organizer_doc.get("email")

    # Fetch Attendees
    attendee_oids = meeting_doc.get("attendees", [])
    attendee_details: List[AttendeeInfo] = []
    attendee_id_strs: List[str] = []

    if attendee_oids:
        users_cursor = db.users.find({"_id": {"$in": attendee_oids}})
        user_map = {}
        async for u in users_cursor:
            user_map[str(u["_id"])] = u

        role_map = {}
        if team:
            if team.get("leader_id"):
                role_map[str(team.get("leader_id"))] = "Leader"
            for m in team.get("members", []):
                role_map[str(m.get("user_id"))] = m.get("role", "Member")

        for oid in attendee_oids:
            oid_str = str(oid)
            attendee_id_strs.append(oid_str)
            user_data = user_map.get(oid_str)
            attendee_details.append(
                AttendeeInfo(
                    id=oid_str,
                    name=user_data.get("name", "Member") if user_data else "Member",
                    email=user_data.get("email") if user_data else None,
                    avatar=user_data.get("avatar") if user_data else None,
                    role=role_map.get(oid_str, "Member"),
                )
            )

    # Permissions calculation
    is_leader = False
    is_organizer = False
    is_attendee = False
    can_edit = False
    can_cancel = False
    can_delete = False

    if current_user_id:
        cur_id_str = str(current_user_id)
        if team and str(team.get("leader_id")) == cur_id_str:
            is_leader = True
        is_organizer = str(organizer_oid) == cur_id_str
        is_attendee = cur_id_str in attendee_id_strs

        can_edit = is_leader or is_organizer
        can_cancel = is_leader or is_organizer
        can_delete = is_leader

    permissions = MeetingPermissions(
        can_edit=can_edit,
        can_cancel=can_cancel,
        can_delete=can_delete,
        is_organizer=is_organizer,
        is_leader=is_leader,
        is_attendee=is_attendee,
    )

    return MeetingResponse(
        id=str(meeting_doc["_id"]),
        team_id=str(team_oid),
        team_name=team_name,
        title=meeting_doc.get("title", ""),
        description=meeting_doc.get("description", ""),
        scheduled_by=str(organizer_oid),
        organizer_name=organizer_name,
        organizer_email=organizer_email,
        attendees=attendee_id_strs,
        attendee_details=attendee_details,
        meeting_date=meeting_doc.get("meeting_date"),
        start_time=meeting_doc.get("start_time", ""),
        end_time=meeting_doc.get("end_time", ""),
        timezone=meeting_doc.get("timezone", "Asia/Kolkata"),
        meeting_type=meeting_doc.get("meeting_type", MeetingType.ONLINE.value),
        meeting_link=meeting_doc.get("meeting_link"),
        location=meeting_doc.get("location"),
        agenda=meeting_doc.get("agenda"),
        status=meeting_doc.get("status", MeetingStatus.SCHEDULED.value),
        created_at=meeting_doc.get("created_at", _utc_now()),
        updated_at=meeting_doc.get("updated_at", _utc_now()),
        is_upcoming=_is_meeting_upcoming(meeting_doc),
        permissions=permissions,
    )


# ── CORE MEETING ACTIONS ───────────────────────────────────────────────────

async def create_meeting(
    db: Any, team_id_str: str, payload: MeetingCreate, current_user: Dict[str, Any]
) -> MeetingResponse:
    """
    Schedule a new team meeting (Team leader only).
    Validates team existence, leader identity, attendees membership, start/end times.
    """
    team_oid = _parse_object_id(team_id_str, "team_id")
    user_id = _extract_user_id(current_user)
    user_oid = _parse_object_id(user_id, "user_id")

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team '{team_id_str}' does not exist.",
        )

    # Leader only rule
    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can schedule meetings.",
        )

    # Validate attendees
    attendee_oids = _validate_and_clean_attendees(payload.attendees, team)

    # Validate meeting type specifics
    m_type_val = payload.meeting_type.value if isinstance(payload.meeting_type, MeetingType) else payload.meeting_type
    if m_type_val == "online" and (not payload.meeting_link or not payload.meeting_link.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online meetings require a valid meeting_link.",
        )
    if m_type_val == "offline" and (not payload.location or not payload.location.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offline meetings require a location.",
        )

    # End time > start time
    if payload.end_time.strip() <= payload.start_time.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be later than start_time.",
        )

    doc = new_meeting_document(
        team_id=team_oid,
        title=payload.title,
        scheduled_by=user_oid,
        meeting_date=payload.meeting_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        description=payload.description or "",
        attendees=attendee_oids,
        timezone_str=payload.timezone or "Asia/Kolkata",
        meeting_type=payload.meeting_type,
        meeting_link=payload.meeting_link,
        location=payload.location,
        agenda=payload.agenda,
        status=MeetingStatus.SCHEDULED,
    )

    result = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].insert_one(doc)
    doc["_id"] = result.inserted_id
    logger.info("Meeting '%s' scheduled in team %s by %s", doc["title"], team_id_str, user_id)

    res = await _enrich_meeting_response(db, doc, user_id)

    # Phase 8: Emit meeting:scheduled and notify attendees
    await emit_to_team(team_id_str, "meeting:scheduled", res.model_dump(mode="json"))

    for a_oid in attendee_oids:
        await notification_service.create_notification(
            recipient_id=a_oid,
            sender_id=user_id,
            team_id=team_oid,
            notification_type="meeting_scheduled",
            title="Meeting Scheduled",
            message=f"New sync scheduled: '{doc.get('title')}' on {payload.meeting_date} ({payload.start_time} - {payload.end_time}).",
            reference_id=str(result.inserted_id),
            reference_type="meeting",
            team_name=team.get("name"),
            sender_name=current_user.get("name", "Team Leader"),
        )

    return res


async def get_team_meetings(
    db: Any,
    team_id_str: str,
    current_user: Dict[str, Any],
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    timeframe: Optional[str] = None,
    sort_order: str = "asc",
) -> MeetingListResponse:
    """
    List team meetings with status/timeframe filtering and pagination. Team members only.
    """
    team_oid = _parse_object_id(team_id_str, "team_id")
    user_id = _extract_user_id(current_user)

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team '{team_id_str}' does not exist.",
        )

    if not _is_team_member(team, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team members can access this team's meetings.",
        )

    query: Dict[str, Any] = {"team_id": team_oid}

    if status_filter and status_filter != "all":
        query["status"] = status_filter

    now = _utc_now()
    if timeframe == "upcoming":
        query["meeting_date"] = {"$gte": now}
        if "status" not in query:
            query["status"] = {"$ne": MeetingStatus.CANCELLED.value}
    elif timeframe == "past":
        query["meeting_date"] = {"$lt": now}

    total = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].count_documents(query)

    direction = 1 if sort_order == "asc" else -1
    skip = max(0, (page - 1) * limit)
    cursor = (
        db[TeamCollaborationCollections.TEAM_MEETINGS.value]
        .find(query)
        .sort([("meeting_date", direction), ("start_time", direction)])
        .skip(skip)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        items.append(await _enrich_meeting_response(db, doc, user_id))

    pages = math.ceil(total / limit) if total > 0 else 1

    return MeetingListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_my_meetings(
    db: Any,
    current_user: Dict[str, Any],
    page: int = 1,
    limit: int = 20,
    status_filter: Optional[str] = None,
    timeframe: Optional[str] = None,
    sort_order: str = "asc",
) -> MeetingListResponse:
    """
    Get all meetings where the user is an attendee or organizer across all teams.
    """
    user_id = _extract_user_id(current_user)
    user_oid = _parse_object_id(user_id, "user_id")

    query: Dict[str, Any] = {
        "$or": [
            {"attendees": user_oid},
            {"scheduled_by": user_oid},
        ]
    }

    if status_filter and status_filter != "all":
        query["status"] = status_filter

    now = _utc_now()
    if timeframe == "upcoming":
        query["meeting_date"] = {"$gte": now}
        if "status" not in query:
            query["status"] = {"$ne": MeetingStatus.CANCELLED.value}
    elif timeframe == "past":
        query["meeting_date"] = {"$lt": now}

    total = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].count_documents(query)

    direction = 1 if sort_order == "asc" else -1
    skip = max(0, (page - 1) * limit)
    cursor = (
        db[TeamCollaborationCollections.TEAM_MEETINGS.value]
        .find(query)
        .sort([("meeting_date", direction), ("start_time", direction)])
        .skip(skip)
        .limit(limit)
    )

    items = []
    async for doc in cursor:
        items.append(await _enrich_meeting_response(db, doc, user_id))

    pages = math.ceil(total / limit) if total > 0 else 1

    return MeetingListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_meeting_details(
    db: Any, meeting_id_str: str, current_user: Dict[str, Any]
) -> MeetingResponse:
    """
    Get single meeting details. Restricted to team members.
    """
    meeting_oid = _parse_object_id(meeting_id_str, "meeting_id")
    user_id = _extract_user_id(current_user)

    meeting = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].find_one({"_id": meeting_oid})
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting '{meeting_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": meeting["team_id"]})
    if not team or not _is_team_member(team, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team members can access meeting details.",
        )

    return await _enrich_meeting_response(db, meeting, user_id)


async def update_meeting(
    db: Any, meeting_id_str: str, payload: MeetingUpdate, current_user: Dict[str, Any]
) -> MeetingResponse:
    """
    Update meeting details (Leader or organizer only).
    """
    meeting_oid = _parse_object_id(meeting_id_str, "meeting_id")
    user_id = _extract_user_id(current_user)

    meeting = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].find_one({"_id": meeting_oid})
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting '{meeting_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": meeting["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id
    is_organizer = str(meeting.get("scheduled_by")) == user_id

    if not (is_leader or is_organizer):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader or meeting organizer can update this meeting.",
        )

    update_fields: Dict[str, Any] = {"updated_at": _utc_now()}

    # Validate time range if either is updated
    eff_start = payload.start_time if payload.start_time is not None else meeting.get("start_time", "")
    eff_end = payload.end_time if payload.end_time is not None else meeting.get("end_time", "")
    if eff_end and eff_start and eff_end <= eff_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_time must be later than start_time.",
        )

    if payload.title is not None:
        update_fields["title"] = payload.title.strip()
    if payload.description is not None:
        update_fields["description"] = payload.description.strip()
    if payload.meeting_date is not None:
        update_fields["meeting_date"] = payload.meeting_date
    if payload.start_time is not None:
        update_fields["start_time"] = payload.start_time.strip()
    if payload.end_time is not None:
        update_fields["end_time"] = payload.end_time.strip()
    if payload.timezone is not None:
        update_fields["timezone"] = payload.timezone.strip()
    if payload.meeting_type is not None:
        update_fields["meeting_type"] = payload.meeting_type.value
    if payload.meeting_link is not None:
        update_fields["meeting_link"] = payload.meeting_link.strip() if payload.meeting_link else None
    if payload.location is not None:
        update_fields["location"] = payload.location.strip() if payload.location else None
    if payload.agenda is not None:
        update_fields["agenda"] = payload.agenda.strip() if payload.agenda else None
    if payload.status is not None:
        update_fields["status"] = payload.status.value

    # Validate attendees
    if payload.attendees is not None:
        cleaned_oids = _validate_and_clean_attendees(payload.attendees, team)
        update_fields["attendees"] = cleaned_oids

    await db[TeamCollaborationCollections.TEAM_MEETINGS.value].update_one(
        {"_id": meeting_oid}, {"$set": update_fields}
    )

    updated_meeting = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].find_one({"_id": meeting_oid})
    logger.info("Meeting %s updated by user %s", meeting_id_str, user_id)
    res = await _enrich_meeting_response(db, updated_meeting, user_id)

    # Phase 8: Emit meeting:updated to team room and notify attendees
    await emit_to_team(str(meeting["team_id"]), "meeting:updated", res.model_dump(mode="json"))

    for a_oid in updated_meeting.get("attendees", []):
        await notification_service.create_notification(
            recipient_id=a_oid,
            sender_id=user_id,
            team_id=meeting.get("team_id"),
            notification_type="meeting_updated",
            title="Meeting Updated",
            message=f"Meeting '{updated_meeting.get('title')}' has been updated.",
            reference_id=meeting_id_str,
            reference_type="meeting",
            sender_name=current_user.get("name"),
        )

    return res


async def cancel_meeting(
    db: Any, meeting_id_str: str, current_user: Dict[str, Any]
) -> MeetingResponse:
    """
    Cancel a scheduled meeting (Leader or organizer).
    """
    meeting_oid = _parse_object_id(meeting_id_str, "meeting_id")
    user_id = _extract_user_id(current_user)

    meeting = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].find_one({"_id": meeting_oid})
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting '{meeting_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": meeting["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    is_leader = str(team.get("leader_id")) == user_id
    is_organizer = str(meeting.get("scheduled_by")) == user_id

    if not (is_leader or is_organizer):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader or meeting organizer can cancel this meeting.",
        )

    now = _utc_now()
    await db[TeamCollaborationCollections.TEAM_MEETINGS.value].update_one(
        {"_id": meeting_oid},
        {"$set": {"status": MeetingStatus.CANCELLED.value, "updated_at": now}},
    )

    updated_meeting = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].find_one({"_id": meeting_oid})
    logger.info("Meeting %s cancelled by user %s", meeting_id_str, user_id)
    res = await _enrich_meeting_response(db, updated_meeting, user_id)

    # Phase 8: Emit meeting:cancelled to team room and notify attendees
    await emit_to_team(str(meeting["team_id"]), "meeting:cancelled", res.model_dump(mode="json"))

    for a_oid in meeting.get("attendees", []):
        await notification_service.create_notification(
            recipient_id=a_oid,
            sender_id=user_id,
            team_id=meeting.get("team_id"),
            notification_type="meeting_cancelled",
            title="Meeting Cancelled",
            message=f"Meeting '{meeting.get('title')}' scheduled for {meeting.get('meeting_date')} has been cancelled.",
            reference_id=meeting_id_str,
            reference_type="meeting",
            sender_name=current_user.get("name"),
        )

    return res


async def delete_meeting(
    db: Any, meeting_id_str: str, current_user: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Delete a meeting permanently (Leader only). Completed meetings are preserved.
    """
    meeting_oid = _parse_object_id(meeting_id_str, "meeting_id")
    user_id = _extract_user_id(current_user)

    meeting = await db[TeamCollaborationCollections.TEAM_MEETINGS.value].find_one({"_id": meeting_oid})
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting '{meeting_id_str}' does not exist.",
        )

    team = await db[TeamCollaborationCollections.TEAMS.value].find_one({"_id": meeting["team_id"]})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated team was not found.",
        )

    if str(team.get("leader_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can delete meetings.",
        )

    # Preserve completed meeting records
    if meeting.get("status") == MeetingStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed meeting records cannot be deleted to preserve milestone and sprint audit history.",
        )

    await db[TeamCollaborationCollections.TEAM_MEETINGS.value].delete_one({"_id": meeting_oid})
    logger.info("Meeting %s deleted by leader %s", meeting_id_str, user_id)
    await emit_to_team(str(meeting["team_id"]), "meeting:deleted", {"meeting_id": meeting_id_str})
    return {"message": "Meeting deleted successfully.", "meeting_id": meeting_id_str}
