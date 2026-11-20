"""
Firebase-backed auth service: MongoDB profile synchronisation, logout, password change.
"""
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth as fb_auth
from pymongo.errors import DuplicateKeyError

from app.config.database import get_database
from app.config.settings import settings
from app.models.user import (
    UserRole,
    REQUESTABLE_ROLES,
    APPROVAL_REQUIRED_ROLES,
    new_user_document,
)
from app.schemas.auth_schema import SyncUserRequest, SyncUserResponse
from app.schemas.profile_schema import user_to_profile

logger = logging.getLogger(__name__)


async def sync_user(claims: dict, payload: SyncUserRequest) -> SyncUserResponse:
    """
    Find-or-create the MongoDB profile for a verified Firebase identity.
    Idempotent: safe to call after every sign-in and to retry after failures.
    """
    db = get_database()
    uid = claims["uid"]
    email = (claims.get("email") or "").lower().strip()
    email_verified = bool(claims.get("email_verified", False))
    now = datetime.now(timezone.utc)

    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Firebase account has no email address.")

    # 1. Existing linked profile -> refresh identity fields from the TRUSTED token only
    user = await db.users.find_one({"firebase_uid": uid})
    if user:
        updates = {"email": email, "is_verified": email_verified, "updated_at": now}
        if not user.get("profile_image") and claims.get("picture"):
            updates["profile_image"] = claims["picture"]
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
        return SyncUserResponse(created=False, user=user_to_profile(user))

    # 2. Legacy / pre-existing profile with the same email but no Firebase link
    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get("firebase_uid"):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email is linked to another account.")
        if not email_verified:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "An account with this email exists. Verify your email to link it.",
            )
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {"firebase_uid": uid, "is_verified": True, "updated_at": now},
                "$unset": {"password": "", "resetToken": "", "resetTokenExpiry": ""},
            },
        )
        linked = await db.users.find_one({"_id": existing["_id"]})
        return SyncUserResponse(created=False, user=user_to_profile(linked))

    # 3. Brand-new profile -> apply trusted role rules
    role = payload.requestedRole
    if role is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Profile not found. Choose a role to complete registration.",
        )
    if role not in REQUESTABLE_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This role cannot be self-assigned.")

    org = payload.organization.model_dump(exclude_none=True) if payload.organization else {}
    if role in APPROVAL_REQUIRED_ROLES and not org.get("name"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Organization name is required.")
    if role in APPROVAL_REQUIRED_ROLES:
        org["type"] = role.value

    name = payload.name or claims.get("name") or email.split("@")[0]
    doc = new_user_document(
        firebase_uid=uid,
        email=email,
        name=name,
        role=role,
        email_verified=email_verified,
        phone=payload.phone,
        organization=org,
        profile_image=claims.get("picture"),
    )
    try:
        result = await db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
        created = True
    except DuplicateKeyError:
        # Concurrent/retried sync created it already -> return that profile, never a duplicate
        doc = await db.users.find_one({"firebase_uid": uid})
        if not doc:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered.")
        created = False

    logger.info("Synced Firebase user %s (role=%s, created=%s)", uid, doc["role"], created)
    return SyncUserResponse(created=created, user=user_to_profile(doc))


async def logout(uid: str) -> dict:
    """Revoke the user's Firebase refresh tokens (signs out all sessions)."""
    await run_in_threadpool(fb_auth.revoke_refresh_tokens, uid)
    return {"message": "Logged out successfully."}


async def change_password(claims: dict, new_password: str, confirm_password: str) -> dict:
    if new_password != confirm_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Passwords do not match.")

    provider = (claims.get("firebase") or {}).get("sign_in_provider")
    if provider != "password":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Password change is only available for email/password accounts.",
        )

    auth_time = int(claims.get("auth_time", 0))
    if datetime.now(timezone.utc).timestamp() - auth_time > settings.RECENT_LOGIN_MAX_AGE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Recent sign-in required. Re-enter your current password.")

    await run_in_threadpool(fb_auth.update_user, claims["uid"], password=new_password)
    await run_in_threadpool(fb_auth.revoke_refresh_tokens, claims["uid"])
    return {"message": "Password changed successfully. Please log in again."}
