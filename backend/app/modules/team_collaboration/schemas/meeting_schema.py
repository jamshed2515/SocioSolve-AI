"""
Pydantic Schemas for Module 3 – Team Meeting Management (Phase 7).
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class MeetingType(str, Enum):
    online = "online"
    offline = "offline"
    ONLINE = "online"
    OFFLINE = "offline"


class MeetingStatus(str, Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AttendeeInfo(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None


class MeetingPermissions(BaseModel):
    can_edit: bool = False
    can_cancel: bool = False
    can_delete: bool = False
    is_organizer: bool = False
    is_leader: bool = False
    is_attendee: bool = False


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=150, description="Meeting title / agenda focus")
    description: Optional[str] = Field(default="", max_length=3000)
    attendees: Optional[List[str]] = Field(default_factory=list, description="List of team member user IDs")
    meeting_date: datetime = Field(..., description="Date of meeting")
    start_time: str = Field(..., description="Start time (e.g. '14:00' or '14:00:00')")
    end_time: str = Field(..., description="End time (e.g. '15:00' or '15:00:00')")
    timezone: Optional[str] = Field(default="Asia/Kolkata", description="Timezone string")
    meeting_type: MeetingType = Field(default=MeetingType.online)
    meeting_link: Optional[str] = Field(default=None, description="URL for online conference")
    location: Optional[str] = Field(default=None, description="Physical location for offline meeting")
    agenda: Optional[str] = Field(default=None, max_length=3000)

    @model_validator(mode="after")
    def validate_meeting(self) -> "MeetingCreate":
        # Check start and end time format & order
        st = self.start_time.strip()
        et = self.end_time.strip()
        if et <= st:
            raise ValueError("end_time must be later than start_time")

        m_type = self.meeting_type.value if isinstance(self.meeting_type, MeetingType) else self.meeting_type
        if m_type == "online" and (not self.meeting_link or not self.meeting_link.strip()):
            raise ValueError("Online meetings require a valid meeting_link")
        if m_type == "offline" and (not self.location or not self.location.strip()):
            raise ValueError("Offline meetings require a physical location")

        return self


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=3000)
    attendees: Optional[List[str]] = Field(default=None)
    meeting_date: Optional[datetime] = Field(default=None)
    start_time: Optional[str] = Field(default=None)
    end_time: Optional[str] = Field(default=None)
    timezone: Optional[str] = Field(default=None)
    meeting_type: Optional[MeetingType] = Field(default=None)
    meeting_link: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default=None)
    agenda: Optional[str] = Field(default=None, max_length=3000)
    status: Optional[MeetingStatus] = Field(default=None)


class MeetingResponse(BaseModel):
    id: str
    team_id: str
    team_name: Optional[str] = None
    title: str
    description: str = ""
    scheduled_by: str
    organizer_name: Optional[str] = None
    organizer_email: Optional[str] = None
    attendees: List[str] = []
    attendee_details: List[AttendeeInfo] = []
    meeting_date: datetime
    start_time: str
    end_time: str
    timezone: str = "Asia/Kolkata"
    meeting_type: str
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    agenda: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    is_upcoming: bool = False
    permissions: Optional[MeetingPermissions] = None


class MeetingListResponse(BaseModel):
    items: List[MeetingResponse]
    total: int
    page: int
    limit: int
    pages: int
