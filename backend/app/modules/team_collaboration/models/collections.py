"""
Collection name registry for Module 3 (Team Formation & Collaboration).

Phase 1 Foundation Note:
- Only defines canonical MongoDB collection name constants for future phases.
- Does NOT create collections, indexes, or seed records in Phase 1.
"""
from enum import Enum


class TeamCollaborationCollections(str, Enum):
    """Planned MongoDB collection names for Module 3 (implemented in Phase 2+)."""

    TEAMS = "teams"
    TEAM_INVITATIONS = "team_invitations"
    TEAM_JOIN_REQUESTS = "team_join_requests"
    TEAM_DISCUSSIONS = "team_discussions"
    TEAM_TASKS = "team_tasks"
    TEAM_MEETINGS = "team_meetings"
    TEAM_MILESTONES = "team_milestones"

