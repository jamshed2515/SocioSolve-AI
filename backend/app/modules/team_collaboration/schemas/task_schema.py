"""
Pydantic Schemas for Module 3 – Team Task Management (Phase 6).

Request bodies, response models, serialization, and validators for:
- Task creation & editing
- Status update
- Progress update
- Assignment management
- Listing & single details
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    todo = "todo"
    in_progress = "in_progress"
    review = "review"
    completed = "completed"


class TaskCreate(BaseModel):
    """Payload to create a new task in a team."""
    title: str = Field(..., min_length=2, max_length=150, description="Task title")
    description: Optional[str] = Field(default="", max_length=3000, description="Task description")
    assigned_to: Optional[List[str]] = Field(default_factory=list, description="List of member user IDs assigned to this task")
    priority: TaskPriority = Field(default=TaskPriority.medium, description="Task priority level")
    start_date: Optional[datetime] = Field(default=None, description="Planned start date")
    due_date: Optional[datetime] = Field(default=None, description="Deadline / due date")

    @model_validator(mode="after")
    def validate_dates(self) -> "TaskCreate":
        if self.start_date and self.due_date:
            if self.due_date < self.start_date:
                raise ValueError("due_date cannot be earlier than start_date")
        return self


class TaskUpdate(BaseModel):
    """Payload to update an existing task."""
    title: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=3000)
    assigned_to: Optional[List[str]] = Field(default=None)
    priority: Optional[TaskPriority] = Field(default=None)
    start_date: Optional[datetime] = Field(default=None)
    due_date: Optional[datetime] = Field(default=None)

    @model_validator(mode="after")
    def validate_dates(self) -> "TaskUpdate":
        if self.start_date and self.due_date:
            if self.due_date < self.start_date:
                raise ValueError("due_date cannot be earlier than start_date")
        return self


class TaskStatusUpdate(BaseModel):
    """Payload to update task status."""
    status: TaskStatus = Field(..., description="Target task status")


class TaskProgressUpdate(BaseModel):
    """Payload to update task progress percentage."""
    progress: int = Field(..., ge=0, le=100, description="Completion progress percentage (0-100)")


class TaskAssignUpdate(BaseModel):
    """Payload to reassign task members."""
    assigned_to: List[str] = Field(..., description="Array of team member user IDs assigned to this task")


class AssignedMemberInfo(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None


class TaskPermissions(BaseModel):
    can_edit: bool = False
    can_delete: bool = False
    can_update_status: bool = False
    can_update_progress: bool = False
    can_reassign: bool = False
    is_leader: bool = False
    is_assigned: bool = False


class TaskResponse(BaseModel):
    id: str
    team_id: str
    team_name: Optional[str] = None
    title: str
    description: str = ""
    created_by: str
    creator_name: Optional[str] = None
    creator_email: Optional[str] = None
    assigned_to: List[str] = []
    assigned_members: List[AssignedMemberInfo] = []
    priority: str
    status: str
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    progress: int = 0
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    is_overdue: bool = False
    permissions: Optional[TaskPermissions] = None


class TaskListResponse(BaseModel):
    items: List[TaskResponse]
    total: int
    page: int
    limit: int
    pages: int
