"""
Admin account-control routes - /api/admin/*  (admin role only)
Minimal Module 1 RBAC endpoints: approve university/industry accounts and
activate/deactivate users. Analytics dashboards belong to Module 6.
"""
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth as fb_auth

from app.config.database import get_database
from app.middleware.auth_middleware import require_role
from app.models.user import UserRole, ApprovalStatus, APPROVAL_REQUIRED_ROLES
from app.schemas.auth_schema import ApprovalRequest
from app.schemas.profile_schema import UserProfileResponse, user_to_profile

router = APIRouter()
admin_only = require_role(UserRole.ADMIN)


async def _get_user(user_id: str) -> dict:
    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise HTTPException(400, "Invalid user id.")
    user = await get_database().users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found.")
    return user


@router.get("/users/pending", response_model=list[UserProfileResponse])
async def list_pending(_: dict = Depends(admin_only)):
    cursor = get_database().users.find({"approval_status": ApprovalStatus.PENDING.value}).limit(200)
    return [user_to_profile(u) async for u in cursor]


@router.put("/users/{user_id}/approval", response_model=UserProfileResponse)
async def set_approval(user_id: str, body: ApprovalRequest, _: dict = Depends(admin_only)):
    user = await _get_user(user_id)
    if UserRole(user["role"]) not in APPROVAL_REQUIRED_ROLES:
        raise HTTPException(400, "Only university and industry accounts require approval.")
    status_value = ApprovalStatus.APPROVED if body.approve else ApprovalStatus.REJECTED
    await get_database().users.update_one(
        {"_id": user["_id"]},
        {"$set": {"approval_status": status_value.value, "updated_at": datetime.now(timezone.utc)}},
    )
    return user_to_profile(await _get_user(user_id))


@router.put("/users/{user_id}/active", response_model=UserProfileResponse)
async def set_active(user_id: str, active: bool, admin: dict = Depends(admin_only)):
    user = await _get_user(user_id)
    if user["_id"] == admin["_id"]:
        raise HTTPException(400, "Administrators cannot deactivate themselves.")
    await get_database().users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_active": active, "updated_at": datetime.now(timezone.utc)}},
    )
    if not active and user.get("firebase_uid"):
        # Kill existing sessions immediately
        await run_in_threadpool(fb_auth.revoke_refresh_tokens, user["firebase_uid"])
    return user_to_profile(await _get_user(user_id))
