"""
User / Profile routes – /api/users/*
All routes require authentication.
"""
from fastapi import APIRouter, Depends, UploadFile, File

from app.schemas.profile_schema import (
    UserProfileResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    ProfileImageResponse,
)
from app.services import profile_service
from app.middleware.auth_middleware import get_current_user

router = APIRouter()


# ── GET /api/users/profile ────────────────────────────────────────────────────
@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get the authenticated user's full profile."""
    return await profile_service.get_profile(str(current_user["_id"]))


# ── PUT /api/users/profile ────────────────────────────────────────────────────
@router.put("/profile", response_model=UpdateProfileResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update profile fields (name, phone, skills, interests, organization)."""
    return await profile_service.update_profile(str(current_user["_id"]), payload)


# ── PUT /api/users/change-password ───────────────────────────────────────────
@router.put("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Change the authenticated user's password."""
    return await profile_service.change_password(str(current_user["_id"]), payload)


# ── PUT /api/users/profile-image ─────────────────────────────────────────────
@router.put("/profile-image", response_model=ProfileImageResponse)
async def update_profile_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a new profile avatar (JPEG/PNG/WebP, max 5 MB)."""
    return await profile_service.upload_profile_image(str(current_user["_id"]), file)
