"""
Pydantic Schemas for Module 3 – Team Milestone Management (Phase 7).
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MilestoneStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"


class LinkedTaskInfo(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    progress: int = 0


class MilestonePermissions(BaseModel):
    can_edit: bool = False
    can_update_progress: bool = False
    can_delete: bool = False
    is_leader: bool = False
    is_creator: bool = False


class MilestoneCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, description="Milestone title")
    description: Optional[str] = Field(default="", max_length=3000)
    due_date: datetime = Field(..., description="Target due date for milestone completion")
    linked_task_ids: Optional[List[str]] = Field(default_factory=list, description="IDs of existing team tasks")


class MilestoneUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=3000)
    due_date: Optional[datetime] = Field(default=None)
    linked_task_ids: Optional[List[str]] = Field(default=None)
    status: Optional[MilestoneStatus] = Field(default=None)


class MilestoneProgressUpdate(BaseModel):
    progress: int = Field(..., ge=0, le=100, description="Completion percentage (0-100)")


class MilestoneResponse(BaseModel):
    id: str
    team_id: str
    team_name: Optional[str] = None
    title: str
    description: str = ""
    created_by: str
    creator_name: Optional[str] = None
    due_date: datetime
    status: str
    progress: int = 0
    linked_task_ids: List[str] = []
    linked_tasks: List[LinkedTaskInfo] = []
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    is_overdue: bool = False
    permissions: Optional[MilestonePermissions] = None


class MilestoneListResponse(BaseModel):
    items: List[MilestoneResponse]
    total: int
    page: int
    limit: int
    pages: int
