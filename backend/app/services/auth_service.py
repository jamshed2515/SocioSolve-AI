"""
Authentication service – business logic for register, login, logout,
token refresh, forgot-password and reset-password.
"""
import secrets
import logging
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import HTTPException, status

from app.config.database import get_database
from app.models.user import UserRole, ROLE_DASHBOARD_MAP, new_user_document
from app.schemas.auth_schema import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
    UserBasicInfo,
    TokenRefreshResponse,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.utils.password_handler import hash_password, verify_password
from app.utils.jwt_handler import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_expiry_datetime,
)
from app.services.email_service import send_password_reset_email

logger = logging.getLogger(__name__)


# ── Helpers ─────────────────────────────────────────────────────────────────
def _user_to_basic_info(user: dict) -> UserBasicInfo:
    return UserBasicInfo(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        profileImage=user.get("profileImage"),
        isVerified=user.get("isVerified", False),
    )


# ── Register ─────────────────────────────────────────────────────────────────
async def register_user(payload: RegisterRequest) -> RegisterResponse:
    db = get_database()

    # Check duplicate email
    existing = await db.users.find_one({"email": payload.email.lower().strip()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Build & insert document
    org = payload.organization.model_dump() if payload.organization else {}
    doc = new_user_document(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        phone=payload.phone,
        organization=org,
    )
    result = await db.users.insert_one(doc)
    user_id = str(result.inserted_id)

    logger.info(f"New user registered: {payload.email} (role={payload.role})")
    return RegisterResponse(
        message="Registration successful! You can now log in.",
        userId=user_id,
        role=payload.role,
        dashboardUrl=ROLE_DASHBOARD_MAP[payload.role],
    )


# ── Login ────────────────────────────────────────────────────────────────────
async def login_user(payload: LoginRequest) -> LoginResponse:
    db = get_database()

    user = await db.users.find_one({"email": payload.email.lower().strip()})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.get("isActive", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact support.",
        )

    user_id = str(user["_id"])
    token_data = {"sub": user_id, "role": user["role"]}

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Persist hashed refresh token (we store plain for lookup simplicity;
    # in production consider hashing the refresh token too)
    await db.refresh_tokens.insert_one(
        {
            "userId": user_id,
            "token": refresh_token,
            "expires_at": get_token_expiry_datetime(days=7),
            "createdAt": datetime.now(timezone.utc),
        }
    )

    role = UserRole(user["role"])
    return LoginResponse(
        accessToken=access_token,
        role=role,
        dashboardUrl=ROLE_DASHBOARD_MAP[role],
        user=_user_to_basic_info(user),
    )


# ── Logout ───────────────────────────────────────────────────────────────────
async def logout_user(refresh_token: str | None, user_id: str) -> dict:
    db = get_database()
    if refresh_token:
        await db.refresh_tokens.delete_one({"token": refresh_token, "userId": user_id})
    return {"message": "Logged out successfully."}


# ── Refresh token ─────────────────────────────────────────────────────────────
async def refresh_access_token(refresh_token: str) -> TokenRefreshResponse:
    db = get_database()

    # Validate JWT structure first
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    # Check DB record exists (revocation check)
    record = await db.refresh_tokens.find_one({"token": refresh_token})
    if not record:
        raise HTTPException(status_code=401, detail="Refresh token revoked or expired.")

    # Rotate: delete old, issue new
    await db.refresh_tokens.delete_one({"token": refresh_token})
    user_id = payload["sub"]
    role = payload["role"]
    new_access = create_access_token({"sub": user_id, "role": role})
    new_refresh = create_refresh_token({"sub": user_id, "role": role})

    await db.refresh_tokens.insert_one(
        {
            "userId": user_id,
            "token": new_refresh,
            "expires_at": get_token_expiry_datetime(days=7),
            "createdAt": datetime.now(timezone.utc),
        }
    )

    return TokenRefreshResponse(accessToken=new_access)


# ── Forgot password ───────────────────────────────────────────────────────────
async def forgot_password(email: str) -> ForgotPasswordResponse:
    db = get_database()
    user = await db.users.find_one({"email": email.lower().strip()})

    # Always return generic message (security: don't reveal email existence)
    generic = ForgotPasswordResponse(
        message="If that email exists, a reset link has been sent."
    )

    if not user:
        return generic

    reset_token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"resetToken": reset_token, "resetTokenExpiry": expiry}},
    )

    await send_password_reset_email(email, reset_token)
    return generic


# ── Reset password ────────────────────────────────────────────────────────────
async def reset_password(payload: ResetPasswordRequest) -> ResetPasswordResponse:
    db = get_database()

    user = await db.users.find_one({"resetToken": payload.token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    expiry: datetime = user.get("resetTokenExpiry")
    if not expiry or datetime.now(timezone.utc) > expiry.replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired.")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": hash_password(payload.newPassword),
                "updatedAt": datetime.now(timezone.utc),
            },
            "$unset": {"resetToken": "", "resetTokenExpiry": ""},
        },
    )

    # Revoke all refresh tokens for security
    await db.refresh_tokens.delete_many({"userId": str(user["_id"])})

    return ResetPasswordResponse(message="Password reset successful. Please log in.")
