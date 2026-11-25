"""
API routes for Module 4: Solution Proposals & Evaluation.
"""
from fastapi import (
    APIRouter,
    Depends,
    Query,
    Request,
    UploadFile,
    File,
    Form,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from typing import Optional

from app.config.database import get_database
from app.middleware.auth_middleware import (
    get_current_user,
    require_approved_user,
    require_role,
)
from app.models.user import UserRole, is_active
from app.models.proposal import DEFAULT_RUBRIC_CRITERIA, RUBRIC_MAX_TOTAL_SCORE
from app.schemas.proposal_schema import (
    ProposalCreateRequest,
    ProposalUpdateRequest,
    ReviewUpsertRequest,
    StatusTransitionRequest,
    WithdrawProposalRequest,
    ReopenProposalRequest,
)
from app.services import proposal_service
from app.services.proposal_ws import proposal_ws_manager
from app.utils import firebase_token

router = APIRouter()

reviewer_guard = require_role(
    UserRole.UNIVERSITY,
    UserRole.INDUSTRY,
    UserRole.ADMIN,
    require_approval=True,
)

proposer_guard = require_role(
    UserRole.STUDENT,
    UserRole.CITIZEN,
    UserRole.UNIVERSITY,
    UserRole.ADMIN,
    require_approval=True,
)


@router.get("/dashboard-stats", summary="Get Proposal Dashboard KPIs & distribution")
async def get_dashboard_stats(
    scope: str = Query("all", description="'all' or 'mine'"),
    current_user: dict = Depends(require_approved_user),
):
    return await proposal_service.get_dashboard_stats(current_user, scope=scope)


@router.get("/rubric-criteria", summary="Get structured evaluation rubric criteria")
@router.get("/meta/rubric", summary="Alias: Get structured evaluation rubric criteria")
async def get_rubric_criteria(current_user: dict = Depends(require_approved_user)):
    return {
        "criteria": DEFAULT_RUBRIC_CRITERIA,
        "maxTotalScore": int(RUBRIC_MAX_TOTAL_SCORE),
        "minCriterionScore": 1,
        "maxCriterionScore": 10,
    }


@router.get("/challenges/published", summary="Get published challenges eligible for proposals")
@router.get("/meta/challenges", summary="Alias: Get published challenges eligible for proposals")
async def get_published_challenges(current_user: dict = Depends(require_approved_user)):
    challenges = await proposal_service.get_published_challenges()
    return {
        "challenges": challenges,
        "count": len(challenges),
        "source": "module2_challenges_collection",
    }


@router.get("/teams/my-teams", summary="Get user's teams from Module 3")
@router.get("/meta/my-teams", summary="Alias: Get user's teams from Module 3")
async def get_my_teams(current_user: dict = Depends(require_approved_user)):
    return await proposal_service.get_user_teams(current_user)


@router.get("/notifications", summary="Get proposal workflow notifications for current user")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    items = await proposal_service.get_user_notifications(current_user)
    return {"notifications": items}


@router.put("/notifications/read-all", summary="Mark all notifications as read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    return await proposal_service.mark_all_notifications_read(current_user)


@router.put("/notifications/{notification_id}/read", summary="Mark notification as read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await proposal_service.mark_notification_read(notification_id, current_user)


@router.websocket("/ws/notifications")
async def proposal_notifications_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="Firebase ID token"),
):
    """Real-time WebSocket stream for Module 4 proposal notifications."""
    raw_token = token
    if not raw_token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            raw_token = auth_header.split(" ", 1)[1].strip()

    if not raw_token:
        await websocket.close(code=1008, reason="Missing authentication token.")
        return

    try:
        claims = firebase_token.verify_firebase_token(raw_token)
        db = get_database()
        user = await db.users.find_one({"firebase_uid": claims["uid"]})
        if not user or not is_active(user):
            await websocket.close(code=1008, reason="Unauthorized user.")
            return
    except Exception:
        await websocket.close(code=1008, reason="Invalid authentication token.")
        return

    uid = str(user["_id"])
    await proposal_ws_manager.connect(uid, websocket)
    try:
        await websocket.send_json({"event": "connected", "userId": uid})
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        proposal_ws_manager.disconnect(uid, websocket)
    except Exception:
        proposal_ws_manager.disconnect(uid, websocket)


@router.post("/upload-document", summary="Upload supporting document or implementation plan")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    docType: str = Form("supporting_document"),
    current_user: dict = Depends(proposer_guard),
):
    base_url = str(request.base_url).rstrip("/")
    return await proposal_service.upload_proposal_document(
        file,
        docType,
        current_user,
        base_url=base_url,
    )


@router.get("/documents/{doc_id}", summary="Download an authorized proposal supporting document")
async def download_proposal_document(
    doc_id: str,
    current_user: dict = Depends(require_approved_user),
):
    return await proposal_service.get_protected_document(doc_id, current_user)


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
    current_user: dict = Depends(require_approved_user),
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
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    sortBy: str = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(require_approved_user),
):
    return await proposal_service.list_proposals(
        current_user,
        search=search,
        status_filter=status,
        challenge_id=challengeId,
        date_from=dateFrom,
        date_to=dateTo,
        sort_by=sortBy,
        mine_only=True,
        review_queue=False,
        page=page,
        limit=limit,
    )


@router.get("/review-queue", summary="Get reviewable proposals for authorized reviewers & admins")
@router.get("/reviewer/queue", summary="Alias: Get reviewable proposals for authorized reviewers & admins")
async def list_review_queue(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    challengeId: Optional[str] = Query(None),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    sortBy: str = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(reviewer_guard),
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
        review_queue=True,
        page=page,
        limit=limit,
    )


@router.post("", status_code=status.HTTP_201_CREATED, summary="Create a new proposal or draft")
async def create_proposal(
    data: ProposalCreateRequest,
    current_user: dict = Depends(proposer_guard),
):
    return await proposal_service.create_proposal(data, current_user)


@router.get("/{proposal_id}", summary="Get proposal details, reviews & status history")
async def get_proposal_details(
    proposal_id: str,
    current_user: dict = Depends(require_approved_user),
):
    return await proposal_service.get_proposal_by_id(proposal_id, current_user)


@router.put("/{proposal_id}", summary="Update a draft proposal")
async def update_proposal(
    proposal_id: str,
    data: ProposalUpdateRequest,
    current_user: dict = Depends(proposer_guard),
):
    return await proposal_service.update_proposal(proposal_id, data, current_user)


@router.delete("/{proposal_id}", summary="Delete a draft proposal")
async def delete_proposal(
    proposal_id: str,
    current_user: dict = Depends(proposer_guard),
):
    return await proposal_service.delete_draft_proposal(proposal_id, current_user)


@router.post("/{proposal_id}/submit", summary="Submit a draft proposal for evaluation")
async def submit_proposal(
    proposal_id: str,
    current_user: dict = Depends(proposer_guard),
):
    return await proposal_service.submit_draft_proposal(proposal_id, current_user)


@router.post("/{proposal_id}/withdraw", summary="Withdraw a submitted proposal if allowed")
async def withdraw_proposal(
    proposal_id: str,
    data: WithdrawProposalRequest = WithdrawProposalRequest(),
    current_user: dict = Depends(proposer_guard),
):
    return await proposal_service.withdraw_proposal(proposal_id, data.reason, current_user)


@router.post("/{proposal_id}/reopen", summary="Reopen a withdrawn proposal back to draft")
async def reopen_proposal(
    proposal_id: str,
    data: ReopenProposalRequest = ReopenProposalRequest(),
    current_user: dict = Depends(proposer_guard),
):
    return await proposal_service.reopen_withdrawn_proposal(proposal_id, data.reason, current_user)


@router.get("/{proposal_id}/reviews", summary="Get evaluations/reviews for a proposal")
async def get_proposal_reviews(
    proposal_id: str,
    current_user: dict = Depends(require_approved_user),
):
    detail = await proposal_service.get_proposal_by_id(proposal_id, current_user)
    return {
        "reviews": detail.get("reviews", []),
        "reviewSummary": detail.get("reviewSummary", {}),
    }


@router.post("/{proposal_id}/reviews", summary="Create/update review draft or submit official review")
@router.post("/{proposal_id}/review", summary="Alias: Create/update review draft or submit official review")
async def upsert_proposal_review(
    proposal_id: str,
    data: ReviewUpsertRequest,
    current_user: dict = Depends(reviewer_guard),
):
    return await proposal_service.upsert_review(proposal_id, data, current_user)


@router.get("/{proposal_id}/review-history", summary="Get proposal evaluation review history")
@router.get("/{proposal_id}/reviews/history", summary="Alias: Get proposal evaluation review history")
async def get_proposal_review_history(
    proposal_id: str,
    current_user: dict = Depends(require_approved_user),
):
    detail = await proposal_service.get_proposal_by_id(proposal_id, current_user)
    return {
        "reviews": detail.get("reviews", []),
        "reviewHistory": detail.get("reviewHistory", []),
        "reviewSummary": detail.get("reviewSummary", {}),
    }


@router.get("/{proposal_id}/status-history", summary="Get proposal status history")
async def get_proposal_status_history(
    proposal_id: str,
    current_user: dict = Depends(require_approved_user),
):
    detail = await proposal_service.get_proposal_by_id(proposal_id, current_user)
    return {
        "status": detail.get("status"),
        "statusHistory": detail.get("statusHistory", []),
    }


@router.post("/{proposal_id}/status", summary="Change proposal status through controlled workflow")
@router.patch("/{proposal_id}/status", summary="Alias: Update proposal status through controlled workflow")
async def change_proposal_status(
    proposal_id: str,
    data: StatusTransitionRequest,
    current_user: dict = Depends(reviewer_guard),
):
    return await proposal_service.transition_proposal_status(proposal_id, data, current_user)
