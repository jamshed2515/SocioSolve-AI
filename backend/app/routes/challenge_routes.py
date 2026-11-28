"""
API routes for Module 2: Societal Challenge Management.

Mounted under /api/challenges.
All static endpoints (/my, /categories, /upload-attachment) are registered
before parameterized routes (/{challenge_id}) to prevent path collisions.
"""
from fastapi import APIRouter, Depends, Query, UploadFile, File, status, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from typing import Optional

from app.config.database import get_database
from app.middleware.auth_middleware import (
    bearer_scheme,
    get_current_user,
    require_active_user,
    require_role,
)
from app.models.user import UserRole, is_active
from app.utils import firebase_token
from app.schemas.challenge_schema import (
    ChallengeCreateRequest,
    ChallengeUpdateRequest,
    ChallengeStatusUpdateRequest,
    ChallengeResponse,
    ChallengeListResponse,
)
from app.services import challenge_service

router = APIRouter()


async def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    """Retrieve user if valid Bearer token provided; return None otherwise for public discovery."""
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    try:
        claims = firebase_token.verify_firebase_token(creds.credentials)
        db = get_database()
        user = await db.users.find_one({"firebase_uid": claims["uid"]})
        if user and is_active(user):
            user["_claims"] = claims
            return user
    except Exception:
        return None
    return None


# ── Static Routes (Registered First) ─────────────────────────────────────────

@router.post(
    "",
    response_model=ChallengeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new societal challenge (draft or submitted)",
)
async def create_challenge(
    payload: ChallengeCreateRequest,
    current_user: dict = Depends(require_active_user),
):
    return await challenge_service.create_challenge(payload, current_user)


@router.get(
    "/my",
    response_model=ChallengeListResponse,
    summary="Get challenges submitted/authored by the current authenticated user",
)
async def get_my_challenges(
    status: Optional[str] = Query(None, description="Optional status filter"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=50, description="Items per page"),
    current_user: dict = Depends(require_active_user),
):
    return await challenge_service.get_my_challenges(
        current_user,
        status_filter=status,
        page=page,
        limit=limit,
    )


@router.get(
    "/categories",
    summary="Get available societal challenge categories and challenge distribution counts",
)
async def get_categories():
    return await challenge_service.get_challenge_categories()


@router.post(
    "/upload-attachment",
    summary="Upload image or document attachment for a challenge",
)
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_active_user),
):
    return await challenge_service.upload_challenge_attachment(file, current_user)


@router.get(
    "",
    response_model=ChallengeListResponse,
    summary="Discover and search challenges with filtering, sorting and pagination",
)
async def list_challenges(
    search: Optional[str] = Query(None, description="Search term in title, description, code, or tags"),
    category: Optional[str] = Query(None, description="Filter by societal domain category"),
    location: Optional[str] = Query(None, description="Filter by location (partial matching)"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty level: Easy | Medium | Hard"),
    status: Optional[str] = Query(None, description="Filter by challenge status"),
    sortBy: str = Query("newest", description="Sorting criteria: newest | oldest | views | proposals | deadline"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=50, description="Results per page"),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    return await challenge_service.get_challenges(
        current_user=current_user,
        search=search,
        category=category,
        location=location,
        difficulty=difficulty,
        status_filter=status,
        sort_by=sortBy,
        page=page,
        limit=limit,
    )


# ── Parameterized Dynamic Routes ─────────────────────────────────────────────

@router.get(
    "/{challenge_id}",
    response_model=ChallengeResponse,
    summary="Get full details of a single challenge by ID or challenge code",
)
async def get_challenge_details(
    challenge_id: str,
    current_user: Optional[dict] = Depends(get_optional_user),
):
    return await challenge_service.get_challenge_by_id(challenge_id, current_user)


@router.put(
    "/{challenge_id}",
    response_model=ChallengeResponse,
    summary="Update challenge information (Author or Administrator only)",
)
async def update_challenge(
    challenge_id: str,
    payload: ChallengeUpdateRequest,
    current_user: dict = Depends(require_active_user),
):
    return await challenge_service.update_challenge(challenge_id, payload, current_user)


@router.delete(
    "/{challenge_id}",
    summary="Delete a challenge (Author or Administrator; blocked if active proposals exist)",
)
async def delete_challenge(
    challenge_id: str,
    current_user: dict = Depends(require_active_user),
):
    return await challenge_service.delete_challenge(challenge_id, current_user)


@router.patch(
    "/{challenge_id}/status",
    response_model=ChallengeResponse,
    summary="Transition challenge status following lifecycle rules (Admin or Author withdrawal)",
)
async def update_challenge_status(
    challenge_id: str,
    payload: ChallengeStatusUpdateRequest,
    current_user: dict = Depends(require_active_user),
):
    return await challenge_service.update_challenge_status(challenge_id, payload, current_user)
