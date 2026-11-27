"""
MongoDB document models & collection definitions for Module 3.
Final collections and document schemas will be finalized in Phase 2+.
"""
from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.models.team_model import TeamStatus, MemberRole, ASSIGNABLE_MEMBER_ROLES
from app.modules.team_collaboration.models.join_request_model import JoinRequestStatus
from app.modules.team_collaboration.models.invitation_model import InvitationStatus
from app.modules.team_collaboration.models.discussion_model import (
    DiscussionCategory,
    new_discussion_document,
    new_comment_document,
    create_discussion_indexes,
)
from app.modules.team_collaboration.models.task_model import (
    TaskPriority,
    TaskStatus,
    new_task_document,
    create_task_indexes,
)
from app.modules.team_collaboration.models.meeting_model import (
    MeetingType,
    MeetingStatus,
    new_meeting_document,
    create_meeting_indexes,
)
from app.modules.team_collaboration.models.milestone_model import (
    MilestoneStatus,
    new_milestone_document,
    create_milestone_indexes,
)
from app.modules.team_collaboration.models.notification_model import (
    NotificationType,
    new_notification_document,
    create_notification_indexes,
)

__all__ = [
    "TeamCollaborationCollections",
    "TeamStatus",
    "MemberRole",
    "ASSIGNABLE_MEMBER_ROLES",
    "JoinRequestStatus",
    "InvitationStatus",
    "DiscussionCategory",
    "new_discussion_document",
    "new_comment_document",
    "create_discussion_indexes",
    "TaskPriority",
    "TaskStatus",
    "new_task_document",
    "create_task_indexes",
    "MeetingType",
    "MeetingStatus",
    "new_meeting_document",
    "create_meeting_indexes",
    "MilestoneStatus",
    "new_milestone_document",
    "create_milestone_indexes",
    "NotificationType",
    "new_notification_document",
    "create_notification_indexes",
]

