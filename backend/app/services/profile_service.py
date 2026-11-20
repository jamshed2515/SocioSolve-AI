"""
Profile service - profile reads, updates and avatar upload.
"""
import os
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile, status

from app.config.database import get_database
from app.models.user import APPROVAL_REQUIRED_ROLES, UserRole
from app.schemas.profile_schema import (
    UpdateProfileRequest,
    UpdateProfileResponse,
    ProfileImageResponse,
    user_to_profile,
)
from app.utils.cloudinary_storage import is_cloudinary_configured, upload_bytes_to_cloudinary

AVATAR_DIR = "uploads/avatars"
ALLOWED_IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


async def update_profile(user: dict, payload: UpdateProfileRequest) -> UpdateProfileResponse:
    db = get_database()
    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    data = payload.model_dump(exclude_unset=True, exclude_none=True)

    for field in ("name", "phone", "skills", "interests"):
        if field in data:
            updates[field] = data[field]

    if payload.organization is not None:
        org = payload.organization.model_dump(exclude_none=True)
        if UserRole(user["role"]) in APPROVAL_REQUIRED_ROLES:
            org["type"] = user["role"]  # org type is tied to the trusted role
        updates["organization"] = org

    await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    updated = await db.users.find_one({"_id": user["_id"]})
    return UpdateProfileResponse(message="Profile updated successfully.", user=user_to_profile(updated))


async def upload_profile_image(user: dict, file: UploadFile) -> ProfileImageResponse:
    db = get_database()
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type)
    if not ext:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file type. Allowed: JPEG, PNG, WebP.")

    contents = await file.read(MAX_IMAGE_SIZE + 1)
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File too large. Max size is 5 MB.")

    # Server-generated identifier only (never trust the client filename)
    stem = f"{user['_id']}_{uuid.uuid4().hex}"
    if is_cloudinary_configured():
        image_url = await upload_bytes_to_cloudinary(
            contents,
            folder="sociosolve/avatars",
            public_id=stem,
            resource_type="image",
            filename=f"{stem}.{ext}",
        )
    else:
        filename = f"{stem}.{ext}"
        os.makedirs(AVATAR_DIR, exist_ok=True)
        with open(os.path.join(AVATAR_DIR, filename), "wb") as f:
            f.write(contents)
        image_url = f"/uploads/avatars/{filename}"

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"profile_image": image_url, "updated_at": datetime.now(timezone.utc)}},
    )
    return ProfileImageResponse(message="Profile image updated successfully.", profileImageUrl=image_url)
