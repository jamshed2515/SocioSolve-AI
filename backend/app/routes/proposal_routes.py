"""
API routes for Module 4: Solution Proposals & Evaluation.
"""
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form, status
from typing import Optional

from app.middleware.auth_middleware import get_current_user
from app.config.database import get_database
from app.models.proposal import DEFAULT_RUBRIC_CRITERIA
from app.schemas.proposal_schema import (
    ProposalCreateRequest,
    ProposalUpdateRequest,
    ReviewUpsertRequest,
    StatusTransitionRequest,
    WithdrawProposalRequest,
)
from app.services import proposal_service

router = APIRouter()


@router.get("/dashboard-stats", summary="Get Proposal Dashboard KPIs & distribution")
async def get_dashboard_stats(
    scope: str = Query("all", description="'all' or 'mine'"),
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.get_dashboard_stats(current_user, scope=scope)


@router.get("/rubric-criteria", summary="Get structured evaluation rubric criteria")
async def get_rubric_criteria(current_user: dict = Depends(get_current_user)):
    return {"criteria": DEFAULT_RUBRIC_CRITERIA, "maxTotalScore": 50}


@router.get("/challenges/published", summary="Get published challenges eligible for proposals")
async def get_published_challenges(current_user: dict = Depends(get_current_user)):
    db = get_database()
    challenges = await proposal_service.ensure_seed_challenges(db)
    return {"challenges": challenges}


@router.get("/teams/my-teams", summary="Get user's teams from Module 3 if available")
async def get_my_teams(current_user: dict = Depends(get_current_user)):
    db = get_database()
    uid = str(current_user["_id"])
    cursor = db.teams.find(
        {"$or": [{"leaderId": uid}, {"leader_id": uid}, {"members.userId": uid}, {"memberIds": uid}]}
    ).limit(25)
    docs = await cursor.to_list(length=25)
    return {"teams": [proposal_service._serialize_doc(t) for t in docs]}


@router.get("/notifications", summary="Get proposal workflow notifications for current user")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    items = await proposal_service.get_user_notifications(current_user)
    return {"notifications": items}


@router.put("/notifications/{notification_id}/read", summary="Mark notification as read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.mark_notification_read(notification_id, current_user)


@router.post("/upload-document", summary="Upload supporting document or implementation plan")
async def upload_document(
    file: UploadFile = File(...),
    docType: str = Form("supporting_document"),
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.upload_proposal_document(file, docType, current_user)


@router.get("", summary="List proposals with search, filter, sort & pagination")
async def list_proposals(
    search: Optional[str] = Query(None, description="Search by title or proposal ID/code"),
    status: Optional[str] = Query(None, description="Filter by proposal status"),
    challengeId: Optional[str] = Query(None, description="Filter by challenge ID"),
    dateFrom: Optional[str] = Query(None, description="ISO start date filter"),
    dateTo: Optional[str] = Query(None, description="ISO end date filter"),
    sortBy: str = Query("newest", description="newest | oldest | score_desc | score_asc | updated"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.list_proposals(
        current_user,
        search=search,
        status_filter=status,
        challenge_id=challengeId,
        date_from=dateFrom,
        date_to=dateTo,
        sort_by=sortBy,
        mine_only=False,
        review_queue=False,
        page=page,
        limit=limit,
    )


@router.get("/my", summary="Get current user's / team's proposals")
async def list_my_proposals(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    challengeId: Optional[str] = Query(None),
    sortBy: str = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.list_proposals(
        current_user,
        search=search,
        status_filter=status,
        challenge_id=challengeId,
        sort_by=sortBy,
        mine_only=True,
        review_queue=False,
        page=page,
        limit=limit,
    )


@router.get("/review-queue", summary="Get reviewable proposals for authorized reviewers & admins")
async def list_review_queue(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    challengeId: Optional[str] = Query(None),
    sortBy: str = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.list_proposals(
        current_user,
        search=search,
        status_filter=status,
        challenge_id=challengeId,
        sort_by=sortBy,
        mine_only=False,
        review_queue=True,
        page=page,
        limit=limit,
    )


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a new proposal or draft")
async def create_proposal(
    data: ProposalCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.create_proposal(data, current_user)


@router.get("/{proposal_id}", summary="Get proposal details, reviews & status history")
async def get_proposal_details(
    proposal_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.get_proposal_by_id(proposal_id, current_user)


@router.put("/{proposal_id}", summary="Update a draft proposal")
async def update_proposal(
    proposal_id: str,
    data: ProposalUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.update_proposal(proposal_id, data, current_user)


@router.delete("/{proposal_id}", summary="Delete a draft proposal")
async def delete_proposal(
    proposal_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.delete_draft_proposal(proposal_id, current_user)


@router.post("/{proposal_id}/submit", summary="Submit a draft proposal for evaluation")
async def submit_proposal(
    proposal_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.submit_draft_proposal(proposal_id, current_user)


@router.post("/{proposal_id}/withdraw", summary="Withdraw a submitted proposal if allowed")
async def withdraw_proposal(
    proposal_id: str,
    data: WithdrawProposalRequest = WithdrawProposalRequest(),
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.withdraw_proposal(proposal_id, data.reason, current_user)


@router.get("/{proposal_id}/reviews", summary="Get evaluations/reviews for a proposal")
async def get_proposal_reviews(
    proposal_id: str,
    current_user: dict = Depends(get_current_user),
):
    detail = await proposal_service.get_proposal_by_id(proposal_id, current_user)
    return {
        "reviews": detail.get("reviews", []),
        "reviewSummary": detail.get("reviewSummary", {}),
    }


@router.post("/{proposal_id}/reviews", summary="Create/update review draft or submit official review")
async def upsert_proposal_review(
    proposal_id: str,
    data: ReviewUpsertRequest,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.upsert_review(proposal_id, data, current_user)


@router.get("/{proposal_id}/status-history", summary="Get proposal status history")
async def get_proposal_status_history(
    proposal_id: str,
    current_user: dict = Depends(get_current_user),
):
    detail = await proposal_service.get_proposal_by_id(proposal_id, current_user)
    return {
        "status": detail.get("status"),
        "statusHistory": detail.get("statusHistory", []),
    }


@router.post("/{proposal_id}/status", summary="Change proposal status through controlled workflow")
async def change_proposal_status(
    proposal_id: str,
    data: StatusTransitionRequest,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.transition_proposal_status(proposal_id, data, current_user)
