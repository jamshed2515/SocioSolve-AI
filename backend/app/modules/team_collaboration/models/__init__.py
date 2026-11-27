"""
MongoDB document models & collection definitions for Module 3.
Final collections and document schemas will be finalized in Phase 2+.
"""
from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.models.team_model import TeamStatus, MemberRole, ASSIGNABLE_MEMBER_ROLES
from app.modules.team_collaboration.models.join_request_model import JoinRequestStatus
from app.modules.team_collaboration.models.invitation_model import InvitationStatus

__all__ = [
    "TeamCollaborationCollections",
    "TeamStatus",
    "MemberRole",
    "ASSIGNABLE_MEMBER_ROLES",
    "JoinRequestStatus",
    "InvitationStatus",
]

