"""
MongoDB document models & collection definitions for Module 3.
Final collections and document schemas will be finalized in Phase 2+.
"""
from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.models.team_model import TeamStatus, MemberRole
from app.modules.team_collaboration.models.join_request_model import JoinRequestStatus

__all__ = ["TeamCollaborationCollections", "TeamStatus", "MemberRole", "JoinRequestStatus"]

