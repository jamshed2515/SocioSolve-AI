"""
Service layer for Module 3 – Team Invitations & Member Management (Phase 4).

Handles invitation creation, approval, rejection, cancellation, user lookup,
member removal, role modification, and team leave operations.
"""
from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from app.modules.team_collaboration.models.team_model import (
    ASSIGNABLE_MEMBER_ROLES,
    MemberRole,
    TeamStatus,
    new_member_document,
)
from app.modules.team_collaboration.models.invitation_model import (
    InvitationStatus,
    new_invitation_document,
)
from app.modules.team_collaboration.schemas.invitation_schema import (
    CreateInvitationRequest,
    InvitationListResponse,
    InvitationResponse,
    TeamMemberDetailResponse,
    UserSearchItem,
)
from app.modules.team_collaboration.services import notification_service

logger = logging.getLogger(__name__)


def _to_oid(id_str: str, entity_name: str = "ID") -> ObjectId:
    if not id_str or not ObjectId.is_valid(id_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {entity_name} format.",
        )
    return ObjectId(id_str)


async def _enrich_invitation_doc(db: Any, doc: Dict[str, Any]) -> InvitationResponse:
    """Enrich an invitation document with team, challenge, inviter, and invitee details."""
    inv_id = str(doc["_id"])
    team_oid = doc.get("team_id")
    inviter_oid = doc.get("inviter_id")
    invitee_oid = doc.get("invitee_id")

    # Team & Challenge details
    team_name = "Team"
    team_status = "recruiting"
    challenge_title = None
    member_count = 0
    max_members = 6

    if team_oid:
        team_doc = await db.teams.find_one({"_id": team_oid})
        if team_doc:
            team_name = team_doc.get("name", "Team")
            team_status = team_doc.get("status", "recruiting")
            members = team_doc.get("members", [])
            member_count = len(members)
            max_members = team_doc.get("max_members", 6)

            challenge_oid = team_doc.get("challenge_id")
            if challenge_oid:
                ch_doc = await db.challenges.find_one({"_id": challenge_oid})
                if ch_doc:
                    challenge_title = ch_doc.get("title")

    # Inviter details
    inviter_name = "Team Leader"
    inviter_email = None
    if inviter_oid:
        inviter_user = await db.users.find_one({"_id": inviter_oid})
        if inviter_user:
            inviter_name = inviter_user.get("name", "Team Leader")
            inviter_email = inviter_user.get("email")

    # Invitee details
    invitee_name = "User"
    invitee_email = None
    invitee_profile_image = None
    invitee_skills = []
    if invitee_oid:
        invitee_user = await db.users.find_one({"_id": invitee_oid})
        if invitee_user:
            invitee_name = invitee_user.get("name", "User")
            invitee_email = invitee_user.get("email")
            invitee_profile_image = invitee_user.get("profile_image") or invitee_user.get("profileImage")
            invitee_skills = invitee_user.get("skills", [])

    return InvitationResponse(
        id=inv_id,
        team_id=str(team_oid) if team_oid else "",
        team_name=team_name,
        team_status=team_status,
        challenge_title=challenge_title,
        member_count=member_count,
        max_members=max_members,
        inviter_id=str(inviter_oid) if inviter_oid else "",
        inviter_name=inviter_name,
        inviter_email=inviter_email,
        invitee_id=str(invitee_oid) if invitee_oid else "",
        invitee_name=invitee_name,
        invitee_email=invitee_email,
        invitee_profile_image=invitee_profile_image,
        invitee_skills=invitee_skills,
        message=doc.get("message"),
        status=doc.get("status", "pending"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
        updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
    )


# ── INVITATIONS ─────────────────────────────────────────────────────────────

async def send_team_invitation(
    db: Any,
    team_id_str: str,
    inviter_user: Dict[str, Any],
    payload: CreateInvitationRequest,
) -> InvitationResponse:
    """
    Leader sends an invitation to an existing platform user.
    Enforces capacity, role checks, and prevents duplicate pending invitations.
    """
    team_oid = _to_oid(team_id_str, "Team ID")
    invitee_oid = _to_oid(payload.invitee_id, "Invitee User ID")
    inviter_oid = inviter_user["_id"]

    # 1. Fetch team
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # 2. Check if inviter is the team leader
    if str(team.get("leader_id")) != str(inviter_oid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can send invitations.",
        )

    # 3. Check team status and capacity
    team_status = team.get("status", TeamStatus.RECRUITING.value)
    if team_status == TeamStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invite members to a completed team.",
        )

    members = team.get("members", [])
    max_members = team.get("max_members", 6)
    if len(members) >= max_members or team_status == TeamStatus.FULL.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team has reached its maximum member capacity.",
        )

    # 4. Cannot invite yourself
    if str(inviter_oid) == str(invitee_oid):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself to the team.",
        )

    # 5. Check invitee exists in db.users
    invitee = await db.users.find_one({"_id": invitee_oid})
    if not invitee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invited user does not exist.",
        )

    # 6. Cannot invite an existing member
    if any(str(m.get("user_id")) == str(invitee_oid) for m in members):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user is already a member of the team.",
        )

    # 7. Check for duplicate pending invitation
    existing_pending = await db.team_invitations.find_one({
        "team_id": team_oid,
        "invitee_id": invitee_oid,
        "status": InvitationStatus.PENDING.value,
    })
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invitation has already been sent to this user.",
        )

    # 8. Create and insert invitation document
    doc = new_invitation_document(
        team_id=team_oid,
        inviter_id=inviter_oid,
        invitee_id=invitee_oid,
        message=payload.message,
    )
    result = await db.team_invitations.insert_one(doc)
    doc["_id"] = result.inserted_id

    logger.info(
        "Leader %s invited user %s to team %s (invitation: %s)",
        inviter_oid,
        invitee_oid,
        team_oid,
        result.inserted_id,
    )

    # Phase 8: Notify invited user
    await notification_service.create_notification(
        recipient_id=invitee_oid,
        sender_id=inviter_oid,
        team_id=team_oid,
        notification_type="team_invitation",
        title="Team Invitation Received",
        message=f"You have been invited to join team '{team.get('name')}' by {inviter_user.get('name', 'the team leader')}.",
        reference_id=str(result.inserted_id),
        reference_type="invitation",
        team_name=team.get("name"),
        sender_name=inviter_user.get("name", "Team Leader"),
        db=db,
    )

    return await _enrich_invitation_doc(db, doc)


async def get_my_received_invitations(
    db: Any,
    user_id_str: str,
    status_filter: Optional[str] = None,
) -> InvitationListResponse:
    """Retrieve invitations received by the authenticated user."""
    user_oid = _to_oid(user_id_str, "User ID")
    query: Dict[str, Any] = {"invitee_id": user_oid}

    if status_filter and status_filter.strip().lower() != "all":
        query["status"] = status_filter.strip().lower()

    cursor = db.team_invitations.find(query).sort("created_at", -1)
    items: List[InvitationResponse] = []
    async for doc in cursor:
        items.append(await _enrich_invitation_doc(db, doc))

    return InvitationListResponse(items=items, total=len(items))


async def get_my_sent_invitations(
    db: Any,
    user_id_str: str,
    status_filter: Optional[str] = None,
    team_id_filter: Optional[str] = None,
) -> InvitationListResponse:
    """Retrieve invitations sent by the authenticated user (team leader)."""
    user_oid = _to_oid(user_id_str, "User ID")
    query: Dict[str, Any] = {"inviter_id": user_oid}

    if team_id_filter and team_id_filter.strip():
        query["team_id"] = _to_oid(team_id_filter, "Team ID")

    if status_filter and status_filter.strip().lower() != "all":
        query["status"] = status_filter.strip().lower()

    cursor = db.team_invitations.find(query).sort("created_at", -1)
    items: List[InvitationResponse] = []
    async for doc in cursor:
        items.append(await _enrich_invitation_doc(db, doc))

    return InvitationListResponse(items=items, total=len(items))


async def respond_to_team_invitation(
    db: Any,
    invitation_id_str: str,
    current_user: Dict[str, Any],
    decision: str,
) -> InvitationResponse:
    """
    Invitee accepts or rejects an invitation.
    Atomic MongoDB update prevents concurrent acceptances exceeding max_members.
    """
    inv_oid = _to_oid(invitation_id_str, "Invitation ID")
    user_oid = current_user["_id"]
    now = datetime.now(timezone.utc)

    # 1. Fetch invitation
    invitation = await db.team_invitations.find_one({"_id": inv_oid})
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found.",
        )

    # 2. Verify current user is the intended invitee
    if str(invitation.get("invitee_id")) != str(user_oid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the invited user can respond to this invitation.",
        )

    # 3. Check invitation status is pending
    if invitation.get("status") != InvitationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation is no longer pending (current status: {invitation.get('status')}).",
        )

    team_oid = invitation.get("team_id")

    # 4. Handle Rejection
    if decision == "rejected":
        await db.team_invitations.update_one(
            {"_id": inv_oid},
            {"$set": {"status": InvitationStatus.REJECTED.value, "updated_at": now}},
        )
        invitation["status"] = InvitationStatus.REJECTED.value
        invitation["updated_at"] = now
        logger.info("User %s rejected invitation %s", user_oid, inv_oid)

        # Phase 8: Notify team leader
        await notification_service.create_notification(
            recipient_id=invitation.get("inviter_id"),
            sender_id=user_oid,
            team_id=team_oid,
            notification_type="join_request_rejected",
            title="Team Invitation Declined",
            message=f"{current_user.get('name', 'Candidate')} declined the invitation to join the team.",
            reference_id=str(team_oid) if team_oid else None,
            reference_type="team",
            sender_name=current_user.get("name"),
        )

        return await _enrich_invitation_doc(db, invitation)

    # 5. Handle Acceptance
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The team no longer exists.",
        )

    # Check if already a member
    if any(str(m.get("user_id")) == str(user_oid) for m in team.get("members", [])):
        # Mark invitation accepted to resolve inconsistency
        await db.team_invitations.update_one(
            {"_id": inv_oid},
            {"$set": {"status": InvitationStatus.ACCEPTED.value, "updated_at": now}},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this team.",
        )

    # Atomic conditional update: check capacity and push new member
    new_member = new_member_document(user_id=user_oid, role=MemberRole.MEMBER)
    filter_query = {
        "_id": team_oid,
        "members.user_id": {"$ne": user_oid},
        "$expr": {"$lt": [{"$size": "$members"}, "$max_members"]},
    }
    update_op = {
        "$push": {"members": new_member},
        "$set": {"updated_at": now},
    }

    res = await db.teams.update_one(filter_query, update_op)
    if res.modified_count == 0:
        # Team may have filled up in a concurrent request
        refreshed_team = await db.teams.find_one({"_id": team_oid})
        if refreshed_team and len(refreshed_team.get("members", [])) >= refreshed_team.get("max_members", 6):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team has reached its maximum member capacity.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not join team. Please ensure you are not already a member.",
        )

    # Mark invitation as accepted
    await db.team_invitations.update_one(
        {"_id": inv_oid},
        {"$set": {"status": InvitationStatus.ACCEPTED.value, "updated_at": now}},
    )

    # Check if team is now full and update status if recruiting
    updated_team = await db.teams.find_one({"_id": team_oid})
    if updated_team:
        member_count = len(updated_team.get("members", []))
        max_cap = updated_team.get("max_members", 6)
        if member_count >= max_cap and updated_team.get("status") == TeamStatus.RECRUITING.value:
            await db.teams.update_one(
                {"_id": team_oid},
                {"$set": {"status": TeamStatus.FULL.value, "updated_at": now}},
            )

    # If the user had a pending join request for this team, update it to accepted
    if hasattr(db, "join_requests"):
        await db.join_requests.update_many(
            {"team_id": team_oid, "user_id": user_oid, "status": "pending"},
            {"$set": {"status": "accepted", "updated_at": now}},
        )

    invitation["status"] = InvitationStatus.ACCEPTED.value
    invitation["updated_at"] = now
    logger.info("User %s accepted invitation %s; enrolled in team %s", user_oid, inv_oid, team_oid)

    # Phase 8: Notify team leader
    await notification_service.create_notification(
        recipient_id=invitation.get("inviter_id"),
        sender_id=user_oid,
        team_id=team_oid,
        notification_type="member_added",
        title="Team Invitation Accepted",
        message=f"{current_user.get('name', 'New member')} accepted your invitation and joined team '{team.get('name')}'.",
        reference_id=str(team_oid),
        reference_type="team",
        team_name=team.get("name"),
        sender_name=current_user.get("name"),
    )

    return await _enrich_invitation_doc(db, invitation)


async def cancel_team_invitation(
    db: Any,
    invitation_id_str: str,
    current_user: Dict[str, Any],
) -> InvitationResponse:
    """Team leader cancels a pending invitation."""
    inv_oid = _to_oid(invitation_id_str, "Invitation ID")
    user_oid = current_user["_id"]
    now = datetime.now(timezone.utc)

    invitation = await db.team_invitations.find_one({"_id": inv_oid})
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found.",
        )

    # Check permission: inviter or team leader
    team_oid = invitation.get("team_id")
    team = await db.teams.find_one({"_id": team_oid}) if team_oid else None
    is_leader = team and str(team.get("leader_id")) == str(user_oid)
    is_inviter = str(invitation.get("inviter_id")) == str(user_oid)

    if not (is_leader or is_inviter):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader who sent this invitation can cancel it.",
        )

    if invitation.get("status") != InvitationStatus.PENDING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel invitation that is not pending (current status: {invitation.get('status')}).",
        )

    await db.team_invitations.update_one(
        {"_id": inv_oid},
        {"$set": {"status": InvitationStatus.CANCELLED.value, "updated_at": now}},
    )

    invitation["status"] = InvitationStatus.CANCELLED.value
    invitation["updated_at"] = now
    logger.info("Leader %s cancelled invitation %s", user_oid, inv_oid)
    return await _enrich_invitation_doc(db, invitation)


# ── MEMBER MANAGEMENT ────────────────────────────────────────────────────────

async def get_team_members(
    db: Any,
    team_id_str: str,
) -> List[TeamMemberDetailResponse]:
    """
    Return sanitized member profiles for a team.
    Strictly excludes sensitive fields like passwords and tokens.
    """
    team_oid = _to_oid(team_id_str, "Team ID")
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    members_raw = team.get("members", [])
    if not members_raw:
        return []

    user_ids = [m.get("user_id") for m in members_raw if m.get("user_id")]
    user_map = {}
    if user_ids:
        cursor = db.users.find({"_id": {"$in": user_ids}})
        async for u in cursor:
            user_map[str(u["_id"])] = u

    results: List[TeamMemberDetailResponse] = []
    leader_id_str = str(team.get("leader_id", ""))

    for m in members_raw:
        uid_str = str(m.get("user_id", ""))
        user_info = user_map.get(uid_str, {})

        org_name = None
        org = user_info.get("organization")
        if isinstance(org, dict):
            org_name = org.get("name")
        elif isinstance(org, str):
            org_name = org

        results.append(
            TeamMemberDetailResponse(
                user_id=uid_str,
                name=user_info.get("name") or (team.get("leader_name") if uid_str == leader_id_str else "Member"),
                email=user_info.get("email"),
                role=m.get("role", MemberRole.MEMBER.value),
                joined_at=m.get("joined_at", team.get("created_at", datetime.now(timezone.utc))),
                skills=user_info.get("skills", []),
                profile_image=user_info.get("profile_image") or user_info.get("profileImage"),
                organization_or_university=org_name or user_info.get("university"),
            )
        )

    # Sort: Team Leader first, then by joined_at
    results.sort(key=lambda x: (0 if x.role == MemberRole.LEADER.value else 1, x.joined_at))
    return results


async def remove_team_member(
    db: Any,
    team_id_str: str,
    target_user_id_str: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Team leader removes a member from the team.
    Updates capacity and reopens recruitment if team was full.
    """
    team_oid = _to_oid(team_id_str, "Team ID")
    target_oid = _to_oid(target_user_id_str, "Member User ID")
    leader_oid = current_user["_id"]
    now = datetime.now(timezone.utc)

    # 1. Fetch team
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # 2. Check if current user is leader
    if str(team.get("leader_id")) != str(leader_oid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can remove members.",
        )

    # 3. Leader cannot remove themselves
    if str(target_oid) == str(leader_oid):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The team leader cannot be removed. Please transfer leadership first or delete the team.",
        )

    # 4. Target must be a current member
    members = team.get("members", [])
    if not any(str(m.get("user_id")) == str(target_oid) for m in members):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this team.",
        )

    # 5. Cannot remove from completed team
    if team.get("status") == TeamStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove members from a completed team.",
        )

    # 6. Pull member from members list
    await db.teams.update_one(
        {"_id": team_oid},
        {
            "$pull": {"members": {"user_id": target_oid}},
            "$set": {"updated_at": now},
        },
    )

    # 7. Check if status was 'full' and re-open to 'recruiting'
    refreshed_team = await db.teams.find_one({"_id": team_oid})
    if refreshed_team and refreshed_team.get("status") == TeamStatus.FULL.value:
        if len(refreshed_team.get("members", [])) < refreshed_team.get("max_members", 6):
            await db.teams.update_one(
                {"_id": team_oid},
                {"$set": {"status": TeamStatus.RECRUITING.value, "updated_at": now}},
            )

    logger.info("Leader %s removed member %s from team %s", leader_oid, target_oid, team_oid)

    # Phase 8: Notify removed member
    await notification_service.create_notification(
        recipient_id=target_oid,
        sender_id=leader_oid,
        team_id=team_oid,
        notification_type="member_removed",
        title="Removed from Team",
        message=f"You have been removed from team '{team.get('name')}'.",
        reference_id=str(team_oid),
        reference_type="team",
        team_name=team.get("name"),
        sender_name=current_user.get("name", "Team Leader"),
    )

    return {
        "success": True,
        "message": "Team member removed successfully.",
        "team_id": team_id_str,
        "user_id": target_user_id_str,
    }


async def leave_team(
    db: Any,
    team_id_str: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Authenticated member voluntarily leaves a team.
    Leaders cannot leave without transferring leadership first.
    """
    team_oid = _to_oid(team_id_str, "Team ID")
    user_oid = current_user["_id"]
    now = datetime.now(timezone.utc)

    # 1. Fetch team
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # 2. Check if user is the leader
    if str(team.get("leader_id")) == str(user_oid):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team leader cannot leave the team without transferring leadership first.",
        )

    # 3. Check if user is a member
    members = team.get("members", [])
    if not any(str(m.get("user_id")) == str(user_oid) for m in members):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of this team.",
        )

    # 4. Pull user from members array
    await db.teams.update_one(
        {"_id": team_oid},
        {
            "$pull": {"members": {"user_id": user_oid}},
            "$set": {"updated_at": now},
        },
    )

    # 5. Check if team status was 'full' and re-open to 'recruiting'
    refreshed = await db.teams.find_one({"_id": team_oid})
    if refreshed and refreshed.get("status") == TeamStatus.FULL.value:
        if len(refreshed.get("members", [])) < refreshed.get("max_members", 6):
            await db.teams.update_one(
                {"_id": team_oid},
                {"$set": {"status": TeamStatus.RECRUITING.value, "updated_at": now}},
            )

    logger.info("User %s left team %s", user_oid, team_oid)
    return {
        "success": True,
        "message": "You have successfully left the team.",
        "team_id": team_id_str,
    }


async def change_member_role(
    db: Any,
    team_id_str: str,
    target_user_id_str: str,
    new_role: str,
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Team leader updates the functional role of a team member.
    The Team Leader role itself cannot be reassigned via this endpoint.
    """
    team_oid = _to_oid(team_id_str, "Team ID")
    target_oid = _to_oid(target_user_id_str, "Target User ID")
    leader_oid = current_user["_id"]
    now = datetime.now(timezone.utc)

    # 1. Fetch team
    team = await db.teams.find_one({"_id": team_oid})
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # 2. Check if current user is leader
    if str(team.get("leader_id")) != str(leader_oid):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team leader can change member roles.",
        )

    # 3. Cannot change the leader's role
    if str(target_oid) == str(team.get("leader_id")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The Team Leader's role cannot be changed through this endpoint.",
        )

    # 4. Validate new role against assignable roles
    clean_role = new_role.strip()
    if clean_role not in ASSIGNABLE_MEMBER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{clean_role}'. Supported roles: {', '.join(ASSIGNABLE_MEMBER_ROLES)}",
        )

    # 5. Check if target user is currently in team
    members = team.get("members", [])
    if not any(str(m.get("user_id")) == str(target_oid) for m in members):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this team.",
        )

    # 6. Update role using array filter
    result = await db.teams.update_one(
        {"_id": team_oid, "members.user_id": target_oid},
        {
            "$set": {
                "members.$.role": clean_role,
                "updated_at": now,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Could not find member in team.",
        )

    logger.info("Leader %s changed role of member %s to '%s' in team %s", leader_oid, target_oid, clean_role, team_oid)

    # Phase 8: Notify member of role change
    await notification_service.create_notification(
        recipient_id=target_oid,
        sender_id=leader_oid,
        team_id=team_oid,
        notification_type="member_role_changed",
        title="Team Role Updated",
        message=f"Your functional role in team '{team.get('name')}' was changed to '{clean_role}'.",
        reference_id=str(team_oid),
        reference_type="team",
        team_name=team.get("name"),
        sender_name=current_user.get("name", "Team Leader"),
    )

    return {
        "success": True,
        "message": f"Member role updated to '{clean_role}'.",
        "team_id": team_id_str,
        "user_id": target_user_id_str,
        "role": clean_role,
    }


async def search_platform_users(
    db: Any,
    query: str,
    current_user_id: Optional[str] = None,
    limit: int = 15,
) -> List[UserSearchItem]:
    """
    Search platform users by name or email for team invitation.
    Excludes the calling user and returns sanitized profile information.
    """
    if not query or len(query.strip()) < 1:
        return []

    escaped = re.escape(query.strip())
    filter_criteria: Dict[str, Any] = {
        "$or": [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
        ]
    }

    if current_user_id and ObjectId.is_valid(current_user_id):
        filter_criteria["_id"] = {"$ne": ObjectId(current_user_id)}

    cursor = db.users.find(filter_criteria).limit(limit)
    results: List[UserSearchItem] = []

    async for u in cursor:
        org_name = None
        org = u.get("organization")
        if isinstance(org, dict):
            org_name = org.get("name")
        elif isinstance(org, str):
            org_name = org

        results.append(
            UserSearchItem(
                id=str(u["_id"]),
                name=u.get("name") or "User",
                email=u.get("email", ""),
                role=u.get("role", "student"),
                skills=u.get("skills", []),
                profile_image=u.get("profile_image") or u.get("profileImage"),
                organization_or_university=org_name or u.get("university"),
            )
        )

    return results
