"""
Profile service – handles profile reads, updates and avatar upload.
"""
import os
import uuid
import logging
import aiofiles
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, UploadFile, status

from app.config.database import get_database
from app.schemas.profile_schema import (
    UserProfileResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    ProfileImageResponse,
)
from app.utils.password_handler import hash_password, verify_password

logger = logging.getLogger(__name__)

AVATAR_DIR = "uploads/avatars"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def _doc_to_profile(user: dict) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        phone=user.get("phone"),
        profileImage=user.get("profileImage"),
        skills=user.get("skills", []),
        interests=user.get("interests", []),
        organization=user.get("organization"),
        isVerified=user.get("isVerified", False),
        isActive=user.get("isActive", True),
        createdAt=user["createdAt"],
    )


async def _get_user_or_404(user_id: str) -> dict:
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


# ── Get profile ───────────────────────────────────────────────────────────────
async def get_profile(user_id: str) -> UserProfileResponse:
    user = await _get_user_or_404(user_id)
    return _doc_to_profile(user)


# ── Update profile ────────────────────────────────────────────────────────────
async def update_profile(user_id: str, payload: UpdateProfileRequest) -> UpdateProfileResponse:
    db = get_database()
    updates: dict = {"updatedAt": datetime.now(timezone.utc)}

    if payload.name is not None:
        updates["name"] = payload.name
    if payload.phone is not None:
        updates["phone"] = payload.phone
    if payload.skills is not None:
        updates["skills"] = payload.skills
    if payload.interests is not None:
        updates["interests"] = payload.interests
    if payload.organization is not None:
        updates["organization"] = payload.organization.model_dump(exclude_none=True)

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    updated_user = await _get_user_or_404(user_id)
    return UpdateProfileResponse(
        message="Profile updated successfully.",
        user=_doc_to_profile(updated_user),
    )


# ── Change password ───────────────────────────────────────────────────────────
async def change_password(user_id: str, payload: ChangePasswordRequest) -> ChangePasswordResponse:
    db = get_database()
    user = await _get_user_or_404(user_id)

    if not verify_password(payload.currentPassword, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if payload.newPassword != payload.confirmPassword:
        raise HTTPException(status_code=400, detail="New passwords do not match.")

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "password": hash_password(payload.newPassword),
                "updatedAt": datetime.now(timezone.utc),
            }
        },
    )

    # Revoke all refresh tokens after password change
    await db.refresh_tokens.delete_many({"userId": user_id})

    return ChangePasswordResponse(message="Password changed successfully. Please log in again.")


# ── Upload profile image ───────────────────────────────────────────────────────
async def upload_profile_image(user_id: str, file: UploadFile) -> ProfileImageResponse:
    db = get_database()

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Allowed: JPEG, PNG, WebP.",
        )

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 5 MB.")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{user_id}_{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)

    os.makedirs(AVATAR_DIR, exist_ok=True)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)

    image_url = f"/uploads/avatars/{filename}"
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profileImage": image_url, "updatedAt": datetime.now(timezone.utc)}},
    )

    return ProfileImageResponse(
        message="Profile image updated successfully.",
        profileImageUrl=image_url,
    )
