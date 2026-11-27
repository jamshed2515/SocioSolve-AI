"""
User / Profile routes - /api/users/*  (all require a verified Firebase token)
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File

from app.config.database import get_database
from app.middleware.auth_middleware import require_active_user
from app.modules.team_collaboration.schemas.invitation_schema import UserSearchItem
from app.modules.team_collaboration.services import invitation_service
from app.schemas.profile_schema import (
    UserProfileResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    ProfileImageResponse,
    user_to_profile,
)
from app.services import auth_service, profile_service

router = APIRouter()


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: dict = Depends(require_active_user)):
    return user_to_profile(current_user)


@router.put("/profile", response_model=UpdateProfileResponse)
async def update_profile(payload: UpdateProfileRequest, current_user: dict = Depends(require_active_user)):
    """Update name, phone, skills, interests, organization. Role/status cannot be changed here."""
    return await profile_service.update_profile(current_user, payload)


@router.put("/change-password", response_model=ChangePasswordResponse)
async def change_password(payload: ChangePasswordRequest, current_user: dict = Depends(require_active_user)):
    """Change the Firebase password. Requires a sign-in within the last few minutes."""
    return await auth_service.change_password(
        current_user["_claims"], payload.newPassword, payload.confirmPassword
    )


@router.put("/profile-image", response_model=ProfileImageResponse)
async def update_profile_image(file: UploadFile = File(...), current_user: dict = Depends(require_active_user)):
    return await profile_service.upload_profile_image(current_user, file)


@router.get("/search", response_model=List[UserSearchItem])
async def search_users(
    q: str = Query(..., min_length=1, description="Search term for name or email"),
    limit: int = Query(15, ge=1, le=50),
    current_user: dict = Depends(require_active_user),
):
    """Search registered platform users by name or email for collaboration and invitations."""
    db = get_database()
    current_user_id = str(current_user["_id"])
    return await invitation_service.search_platform_users(
        db=db, query=q, current_user_id=current_user_id, limit=limit
    )
