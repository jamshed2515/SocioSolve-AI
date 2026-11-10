"""
Partnership and Partnership Application models for MongoDB.
Defines enums, constants, and document builders for Module 6: Industry Partnerships.
"""
from enum import Enum
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId


class OpportunityType(str, Enum):
    MENTORSHIP = "Mentorship"
    FUNDING = "Funding"
    DATASET = "Dataset"
    INTERNSHIP = "Internship"


class OpportunityStatus(str, Enum):
    ACTIVE = "Active"
    CLOSED = "Closed"


class ApplicationStatus(str, Enum):
    PENDING = "Pending"
    ACCEPTED = "Accepted"
    REJECTED = "Rejected"


def new_partnership_document(
    industry_user_id: str,
    industry_name: str,
    organization_name: str,
    title: str,
    description: str,
    opportunity_type: OpportunityType,
    target_categories: List[str],
    resources_offered: List[str],
    max_teams: int = 3,
    organization_website: Optional[str] = None,
) -> dict:
    """Build a fresh partnership opportunity document ready for MongoDB insertion."""
    now = datetime.now(timezone.utc)
    return {
        "industryUserId": ObjectId(industry_user_id),
        "industryName": industry_name,
        "organizationName": organization_name,
        "organizationWebsite": organization_website,
        "title": title.strip(),
        "description": description.strip(),
        "type": opportunity_type.value if hasattr(opportunity_type, "value") else str(opportunity_type),
        "targetCategories": [cat.strip() for cat in target_categories if cat.strip()],
        "resourcesOffered": [res.strip() for res in resources_offered if res.strip()],
        "maxTeams": int(max_teams),
        "acceptedTeamsCount": 0,
        "status": OpportunityStatus.ACTIVE.value,
        "createdAt": now,
        "updatedAt": now,
    }


def new_application_document(
    partnership_id: str,
    partnership_title: str,
    applicant_user_id: str,
    applicant_name: str,
    applicant_email: str,
    team_name: str,
    message: str,
    team_id: Optional[str] = None,
) -> dict:
    """Build a fresh partnership application document ready for MongoDB insertion."""
    now = datetime.now(timezone.utc)
    return {
        "partnershipId": ObjectId(partnership_id),
        "partnershipTitle": partnership_title,
        "applicantUserId": ObjectId(applicant_user_id),
        "applicantName": applicant_name,
        "applicantEmail": applicant_email,
        "teamName": team_name.strip(),
        "teamId": ObjectId(team_id) if team_id else None,
        "message": message.strip(),
        "status": ApplicationStatus.PENDING.value,
        "feedback": None,
        "createdAt": now,
        "updatedAt": now,
    }
