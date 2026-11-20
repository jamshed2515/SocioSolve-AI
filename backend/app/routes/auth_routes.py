"""
Authentication routes - /api/auth/*
Firebase handles credentials on the client; the backend verifies Firebase ID tokens.
"""
from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.middleware.auth_middleware import get_current_user, get_firebase_claims
from app.schemas.auth_schema import SyncUserRequest, SyncUserResponse, MessageResponse
from app.schemas.profile_schema import UserProfileResponse, user_to_profile
from app.services import auth_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/sync-user", response_model=SyncUserResponse)
@limiter.limit("30/minute")
async def sync_user(
    request: Request,
    payload: SyncUserRequest | None = None,
    claims: dict = Depends(get_firebase_claims),
):
    """
    Verify the Firebase ID token and find-or-create the MongoDB profile.
    Profile fields in the body are only used when the profile is first created.
    """
    return await auth_service.sync_user(claims, payload or SyncUserRequest())


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile and trusted role."""
    return user_to_profile(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout(claims: dict = Depends(get_firebase_claims)):
    """
    Revoke Firebase refresh tokens server-side (client also calls signOut()).
    Existing ID tokens are rejected afterwards because verification uses check_revoked.
    """
    return await auth_service.logout(claims["uid"])

# Note: /refresh, /register, /login, /forgot-password and /reset-password are no longer
# backend endpoints - the Firebase JS SDK refreshes ID tokens and handles credentials.
