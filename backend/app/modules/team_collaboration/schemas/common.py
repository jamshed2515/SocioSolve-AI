"""
Shared Pydantic v2 schemas for Module 3 foundation and cross-phase contracts.
"""
from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

from app.models.user import UserRole


class DatabaseStatus(BaseModel):
    """Read-only database readiness snapshot reusing the shared MongoDB client."""

    connected: bool
    database_name: str
    message: str


class ModuleStatusResponse(BaseModel):
    """Foundation status response for Module 3 router verification."""

    module: str = Field(default="Module 3 – Team Formation & Collaboration")
    project: str = Field(default="Societal Innovation Collaboration Portal for Jharkhand")
    phase: str = Field(default="Phase 1 – Foundation")
    status: Literal["operational", "degraded"]
    auth_integration: str = Field(default="JWT + RBAC (reusing Module 1 auth_middleware)")
    database: DatabaseStatus
    planned_capabilities: List[str]
    timestamp: datetime


class AuthenticatedUserContext(BaseModel):
    """Normalized authenticated user identity extracted from Module 1 JWT middleware."""

    user_id: str
    name: str
    email: str
    role: UserRole
    is_active: bool = True
    is_verified: bool = False
    skills: List[str] = Field(default_factory=list)
    profile_image: Optional[str] = None

