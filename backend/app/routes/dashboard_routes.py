"""
Role-protected dashboard endpoints - /api/dashboard/*
Backend enforcement for the five role dashboards (hiding UI is not security).
Other modules can replace the placeholder payloads with real data.
"""
from fastapi import APIRouter, Depends

from app.middleware.auth_middleware import require_role
from app.models.user import UserRole

router = APIRouter()


def _payload(user: dict, role: str) -> dict:
    return {"dashboard": role, "user": {"id": str(user["_id"]), "name": user.get("name")}}


@router.get("/citizen")
async def citizen(user: dict = Depends(require_role(UserRole.CITIZEN))):
    return _payload(user, "citizen")


@router.get("/student")
async def student(user: dict = Depends(require_role(UserRole.STUDENT))):
    return _payload(user, "student")


@router.get("/university")
async def university(user: dict = Depends(require_role(UserRole.UNIVERSITY))):
    return _payload(user, "university")


@router.get("/industry")
async def industry(user: dict = Depends(require_role(UserRole.INDUSTRY))):
    return _payload(user, "industry")


@router.get("/admin")
async def admin(user: dict = Depends(require_role(UserRole.ADMIN))):
    return _payload(user, "admin")
