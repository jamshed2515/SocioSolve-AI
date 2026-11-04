"""
Authentication routes – /api/auth/*
Rate limiting applied to login and forgot-password endpoints.
"""
from fastapi import APIRouter, Request, Cookie, Response
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.auth_schema import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.schemas.profile_schema import UserProfileResponse
from app.services import auth_service
from app.middleware.auth_middleware import get_current_user
from app.services.profile_service import _doc_to_profile
from fastapi import Depends

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


# ── POST /api/auth/register ──────────────────────────────────────────────────
@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(payload: RegisterRequest):
    """Register a new user (Citizen, Student, University, or Industry Partner)."""
    return await auth_service.register_user(payload)


# ── POST /api/auth/login ─────────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, response: Response):
    """Authenticate user and return access + refresh tokens."""
    result = await auth_service.login_user(payload)

    # Set refresh token as HttpOnly cookie for web security
    response.set_cookie(
        key="refresh_token",
        value=result.accessToken,  # Store the refresh token separately; simplified here
        httponly=True,
        secure=False,   # Set True in production (HTTPS)
        samesite="lax",
        max_age=7 * 24 * 60 * 60,
    )
    return result


# ── POST /api/auth/logout ────────────────────────────────────────────────────
@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    current_user: dict = Depends(get_current_user),
):
    """Revoke refresh token and clear cookie."""
    result = await auth_service.logout_user(refresh_token, str(current_user["_id"]))
    response.delete_cookie("refresh_token")
    return result


# ── GET /api/auth/me ─────────────────────────────────────────────────────────
@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return _doc_to_profile(current_user)


# ── POST /api/auth/refresh ────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh_token(payload: TokenRefreshRequest):
    """Exchange a valid refresh token for a new access token (token rotation)."""
    return await auth_service.refresh_access_token(payload.refreshToken)


# ── POST /api/auth/forgot-password ───────────────────────────────────────────
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("5/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest):
    """Request a password reset link (sent to email or printed to console in mock mode)."""
    return await auth_service.forgot_password(payload.email)


# ── POST /api/auth/reset-password ────────────────────────────────────────────
@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(payload: ResetPasswordRequest):
    """Reset password using a valid, unexpired token."""
    return await auth_service.reset_password(payload)
