"""
Module 3 – Team Formation & Collaboration API Router.

Phase 1 Foundation:
- Registers a dedicated modular router under `/api/team-collaboration`.
- Exposes only the read-only foundation status endpoint for connectivity verification.
- Team CRUD, join requests, invitations, discussions, tasks, meetings, and milestones
  routers will be mounted here in Phases 2–6.
"""
from datetime import datetime, timezone
from fastapi import APIRouter

from app.modules.team_collaboration.schemas.common import ModuleStatusResponse
from app.modules.team_collaboration.services.database_service import (
    check_database_readiness,
)

router = APIRouter()

PLANNED_CAPABILITIES = [
    "Team Creation & Management (Phase 2)",
    "Team Discovery & Join Requests (Phase 3)",
    "Member Invitations & Role Assignment (Phase 3)",
    "Real-Time Team Discussions via WebSockets / Socket.IO (Phase 4)",
    "Collaborative Task Tracking (Phase 5)",
    "Meetings & Milestones Management (Phase 6)",
]


@router.get(
    "/status",
    response_model=ModuleStatusResponse,
    summary="Module 3 foundation status & shared DB readiness check",
)
async def get_module_status() -> ModuleStatusResponse:
    """
    Verify that the Module 3 router is registered and inspect readiness of the
    shared MongoDB Atlas connection. Does not create collections or mutate state.
    """
    db_status = await check_database_readiness()
    return ModuleStatusResponse(
        status="operational" if db_status.connected else "degraded",
        database=db_status,
        planned_capabilities=PLANNED_CAPABILITIES,
        timestamp=datetime.now(timezone.utc),
    )

