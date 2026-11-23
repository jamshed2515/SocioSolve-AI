"""
Comprehensive automated tests for Module 4: Solution Proposals & Evaluation.
Covers draft lifecycle, submission validation, unpublished challenge guard,
rubric scoring, self-review prevention, role permissions, and status history.
"""
import asyncio
from bson import ObjectId
from fastapi import HTTPException

from app.models.proposal import (
    ProposalStatus,
    ReviewRecommendation,
    DEFAULT_RUBRIC_CRITERIA,
)
from app.schemas.proposal_schema import (
    ProposalCreateRequest,
    ProposalUpdateRequest,
    ReviewUpsertRequest,
    CriterionScoreSchema,
    StatusTransitionRequest,
)
from app.services import proposal_service


class InMemoryCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                self._docs.sort(key=lambda x: self._get_nested(x, k) or "", reverse=(d == -1))
        else:
            self._docs.sort(
                key=lambda x: self._get_nested(x, key_or_list) or "",
                reverse=(direction == -1),
            )
        return self

    def skip(self, n):
        self._docs = self._docs[n:]
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length=100):
        return self._docs[:length]

    @staticmethod
    def _get_nested(doc, path):
        cur = doc
        for part in path.split("."):
            if isinstance(cur, dict):
                cur = cur.get(part)
            else:
                return None
        return cur


class InMemoryCollection:
    def __init__(self):
        self.docs = []

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$and":
                if not all(self._matches(doc, cond) for cond in v):
                    return False
            elif k == "$or":
                if not any(self._matches(doc, cond) for cond in v):
                    return False
            else:
                val = doc.get(k)
                if isinstance(v, dict):
                    if "$ne" in v and val == v["$ne"]:
                        return False
                    if "$regex" in v:
                        import re
                        flags = re.IGNORECASE if "i" in v.get("$options", "") else 0
                        if not re.search(v["$regex"], str(val or ""), flags):
                            return False
                else:
                    if val != v:
                        return False
        return True

    async def count_documents(self, query):
        return sum(1 for d in self.docs if self._matches(d, query))

    def find(self, query=None):
        matched = [dict(d) for d in self.docs if self._matches(d, query or {})]
        return InMemoryCursor(matched)

    async def find_one(self, query):
        for d in self.docs:
            if self._matches(d, query):
                return dict(d)
        return None

    async def insert_one(self, doc):
        new_doc = dict(doc)
        if "_id" not in new_doc:
            new_doc["_id"] = ObjectId()
        self.docs.append(new_doc)

        class Result:
            inserted_id = new_doc["_id"]

        return Result()

    async def insert_many(self, docs):
        for d in docs:
            await self.insert_one(d)

    async def update_one(self, query, update):
        for d in self.docs:
            if self._matches(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                return

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            if self._matches(d, query):
                self.docs.pop(i)
                return

    async def delete_many(self, query):
        self.docs = [d for d in self.docs if not self._matches(d, query)]

    def aggregate(self, pipeline):
        matched = self.docs
        grouped = {}
        for stage in pipeline:
            if "$match" in stage:
                matched = [d for d in matched if self._matches(d, stage["$match"])]
            elif "$group" in stage:
                for d in matched:
                    status_val = d.get("status")
                    grouped[status_val] = grouped.get(status_val, 0) + 1
        result = [{"_id": k, "count": v} for k, v in grouped.items()]
        return InMemoryCursor(result)


class FakeDatabase:
    def __init__(self):
        self.challenges = InMemoryCollection()
        self.proposals = InMemoryCollection()
        self.proposal_reviews = InMemoryCollection()
        self.proposal_status_history = InMemoryCollection()
        self.proposal_review_history = InMemoryCollection()
        self.notifications = InMemoryCollection()
        self.teams = InMemoryCollection()

    def __getattr__(self, name):
        col = InMemoryCollection()
        setattr(self, name, col)
        return col


async def run_all_module4_tests():
    fake_db = FakeDatabase()
    proposal_service.get_database = lambda: fake_db

    student_user = {
        "_id": ObjectId(),
        "name": "Gudiya Kumari",
        "email": "gudiya@university.edu",
        "role": "student",
    }
    other_student = {
        "_id": ObjectId(),
        "name": "Rahul Sharma",
        "email": "rahul@university.edu",
        "role": "student",
    }
    reviewer_user = {
        "_id": ObjectId(),
        "name": "Dr. Anita Verma",
        "email": "anita.verma@iit.ac.in",
        "role": "university",
    }

    # 1. Seed published challenges & verify unpublished challenge blocking
    published = await proposal_service.ensure_seed_challenges(fake_db)
    assert len(published) >= 5, "Expected at least 5 published seed challenges"
    pub_challenge_id = published[0]["id"]

    unpublished_doc = await fake_db.challenges.find_one({"status": "draft"})
    assert unpublished_doc is not None

    try:
        await proposal_service.create_proposal(
            ProposalCreateRequest(
                title="Invalid Challenge Proposal",
                challengeId=str(unpublished_doc["_id"]),
            ),
            student_user,
        )
        assert False, "Should have blocked proposal for unpublished challenge"
    except HTTPException as exc:
        assert exc.status_code == 400

    # 2. Create Draft Proposal & Edit Draft
    draft = await proposal_service.create_proposal(
        ProposalCreateRequest(
            title="HydroSense AI Water Quality Monitor",
            challengeId=pub_challenge_id,
            problemUnderstanding="Initial draft problem statement",
            submitImmediately=False,
        ),
        student_user,
    )
    assert draft["status"] == ProposalStatus.DRAFT.value
    proposal_id = draft["id"]

    # 3. Verify submitting incomplete draft fails validation
    try:
        await proposal_service.submit_draft_proposal(proposal_id, student_user)
        assert False, "Submitting incomplete draft should fail validation"
    except HTTPException as exc:
        assert exc.status_code == 400

    # 4. Update Draft with all required fields
    updated_draft = await proposal_service.update_proposal(
        proposal_id,
        ProposalUpdateRequest(
            problemUnderstanding="Fluoride and arsenic contamination affects over 50 rural villages with no real-time alerts.",
            proposedSolution="Solar-powered IoT edge sensor nodes with TinyML anomaly detection and SMS alerts for panchayats.",
            innovationUniqueness="Self-calibrating low-cost optical + conductivity sensor array under Rs 3500.",
            technicalApproach="ESP32-S3 microcontroller, LoRaWAN mesh gateway, FastAPI backend, React dashboard.",
            implementationPlan="Phase 1 (Weeks 1-4): Lab calibration. Phase 2 (Weeks 5-8): 10-village pilot deployment.",
            requiredResources="Water testing lab access, 15 sensor kits, industry mentor in embedded systems.",
            expectedImpact="Provide safe drinking water early warnings to 50,000+ rural citizens.",
            estimatedTimeline="12 Weeks",
            prototypeUrl="https://figma.com/file/hydrosense-prototype",
            githubUrl="https://github.com/sociosolve/hydrosense-ai",
        ),
        student_user,
    )
    assert updated_draft["estimatedTimeline"] == "12 Weeks"

    # 5. Submit Draft Proposal -> Status becomes 'submitted'
    submitted = await proposal_service.submit_draft_proposal(proposal_id, student_user)
    assert submitted["status"] == ProposalStatus.SUBMITTED.value
    assert submitted["submittedAt"] is not None

    # 6. Verify Submitted Proposal cannot be silently edited or deleted
    try:
        await proposal_service.update_proposal(
            proposal_id,
            ProposalUpdateRequest(title="Silent Edit Attempt"),
            student_user,
        )
        assert False, "Submitted proposal must not be editable"
    except HTTPException as exc:
        assert exc.status_code == 400

    try:
        await proposal_service.delete_draft_proposal(proposal_id, student_user)
        assert False, "Submitted proposal must not be deletable"
    except HTTPException as exc:
        assert exc.status_code == 400

    # 7. Verify Self-Review & Unauthorized Role Review Prevention
    sample_criteria = [
        CriterionScoreSchema(key=c["key"], label=c["label"], score=18, maxScore=20, comment="Strong")
        for c in DEFAULT_RUBRIC_CRITERIA
    ]
    try:
        await proposal_service.upsert_review(
            proposal_id,
            ReviewUpsertRequest(
                criteriaScores=sample_criteria,
                overallFeedback="Trying to review my own proposal",
                recommendation=ReviewRecommendation.ACCEPT,
                submitFinal=True,
            ),
            other_student,
        )
        assert False, "Student role should not be permitted to review"
    except HTTPException as exc:
        assert exc.status_code == 403

    # Even if author had reviewer role, self-review must fail
    author_as_uni = dict(student_user, role="university")
    try:
        await proposal_service.upsert_review(
            proposal_id,
            ReviewUpsertRequest(
                criteriaScores=sample_criteria,
                overallFeedback="Author attempting self-review",
                recommendation=ReviewRecommendation.ACCEPT,
                submitFinal=True,
            ),
            author_as_uni,
        )
        assert False, "Self-review must be blocked"
    except HTTPException as exc:
        assert exc.status_code == 403

    # 8. Authorized Reviewer submits official evaluation -> auto-calculates score out of 100 & moves to 'under_review'
    review_res = await proposal_service.upsert_review(
        proposal_id,
        ReviewUpsertRequest(
            criteriaScores=sample_criteria,
            overallFeedback="Excellent technical architecture and strong rural deployment feasibility.",
            recommendation=ReviewRecommendation.ACCEPT,
            submitFinal=True,
        ),
        reviewer_user,
    )
    assert review_res["review"]["totalScore"] == 90.0
    assert review_res["review"]["maxTotalScore"] == 100.0
    assert review_res["review"]["averageScore"] == 18.0
    assert review_res["reviewSummary"]["totalScore"] == 90.0
    assert review_res["reviewSummary"]["maxTotalScore"] == 100.0

    detail_after_review = await proposal_service.get_proposal_by_id(proposal_id, student_user)
    assert detail_after_review["status"] == ProposalStatus.UNDER_REVIEW.value
    assert len(detail_after_review["reviewHistory"]) == 1

    # Review history preservation: submitting an updated review appends to reviewHistory without overwriting
    updated_criteria = [
        CriterionScoreSchema(key=c["key"], label=c["label"], score=19, maxScore=20, comment="Outstanding")
        for c in DEFAULT_RUBRIC_CRITERIA
    ]
    await proposal_service.upsert_review(
        proposal_id,
        ReviewUpsertRequest(
            criteriaScores=updated_criteria,
            overallFeedback="Updated review after prototype demonstration.",
            recommendation=ReviewRecommendation.ACCEPT,
            submitFinal=True,
        ),
        reviewer_user,
    )
    detail_revised = await proposal_service.get_proposal_by_id(proposal_id, student_user)
    assert len(detail_revised["reviewHistory"]) == 2
    assert detail_revised["reviewSummary"]["totalScore"] == 95.0

    # 9. Finalize decision -> Under Review to Accepted
    accepted_detail = await proposal_service.transition_proposal_status(
        proposal_id,
        StatusTransitionRequest(
            toStatus=ProposalStatus.ACCEPTED,
            comment="Approved for university-industry seed grant and pilot deployment.",
        ),
        reviewer_user,
    )
    assert accepted_detail["status"] == ProposalStatus.ACCEPTED.value
    assert len(accepted_detail["statusHistory"]) == 4  # draft -> submitted -> under_review -> accepted

    # 10. Verify that editing after final acceptance is strictly blocked
    try:
        await proposal_service.update_proposal(
            proposal_id,
            ProposalUpdateRequest(title="Editing after accepted should fail"),
            student_user,
        )
        assert False, "Accepted proposal must not be editable"
    except HTTPException as exc:
        assert exc.status_code == 400

    # 10. Dashboard stats & search verification
    stats = await proposal_service.get_dashboard_stats(student_user)
    assert stats["totalProposals"] == 1
    assert stats["acceptedProposals"] == 1

    search_res = await proposal_service.list_proposals(student_user, search="HydroSense")
    assert search_res["total"] == 1

    # 11. Test Proposal Withdrawal and Resubmission Flow
    withdrawn_prop = await proposal_service.create_proposal(
        ProposalCreateRequest(
            title="Clean Rivers Autonomous Drone Network",
            challengeId=pub_challenge_id,
            problemUnderstanding="Chemical run-off and municipal discharge into rivers.",
            proposedSolution="Autonomous solar drone boat with water sampling and optical turbidity sensors.",
            innovationUniqueness="Swarm communication between 4 micro-surface drones.",
            technicalApproach="ROS 2, ArduPilot, LoRa transceiver, OpenCV water debris analysis.",
            implementationPlan="Phase 1: 3-month prototype. Phase 2: Pilot run in Sabarmati river.",
            requiredResources="Boat hull materials, telemetry radios, river safety permits.",
            expectedImpact="Track pollution hotspots across 40 km of river corridor.",
            estimatedTimeline="16 Weeks",
            submitImmediately=True,
        ),
        student_user,
    )
    assert withdrawn_prop["status"] == ProposalStatus.SUBMITTED.value

    # Author withdraws proposal to adjust specs
    withdrawn = await proposal_service.withdraw_proposal(
        withdrawn_prop["id"],
        "Need to revise sensor specifications with research mentor.",
        student_user,
    )
    assert withdrawn["status"] == ProposalStatus.WITHDRAWN.value

    # Author can edit the withdrawn proposal
    revised_withdrawn = await proposal_service.update_proposal(
        withdrawn_prop["id"],
        ProposalUpdateRequest(estimatedTimeline="20 Weeks"),
        student_user,
    )
    assert revised_withdrawn["estimatedTimeline"] == "20 Weeks"

    # Author can resubmit the withdrawn proposal
    resubmitted = await proposal_service.submit_draft_proposal(withdrawn_prop["id"], student_user)
    assert resubmitted["status"] == ProposalStatus.SUBMITTED.value

    print("✅ All Module 4 service-level tests passed successfully!")


def test_module4_workflow():
    asyncio.run(run_all_module4_tests())


def test_module4_fastapi_client():
    """Verify FastAPI routes: /review, PATCH /status, /review-history, /rubric-criteria."""
    from fastapi.testclient import TestClient
    from app.config import database as db_config
    from app.main import app
    from app.middleware.auth_middleware import get_current_user

    fake_db = FakeDatabase()
    proposal_service.get_database = lambda: fake_db
    db_config.get_database = lambda: fake_db

    student_id = ObjectId()
    reviewer_id = ObjectId()

    mock_student = {
        "_id": student_id,
        "name": "Aakash Gupta",
        "email": "aakash@university.edu",
        "role": "student",
        "approval_status": "approved",
        "is_active": True,
    }
    mock_reviewer = {
        "_id": reviewer_id,
        "name": "Prof. R. Sengupta",
        "email": "sengupta@iit.ac.in",
        "role": "university",
        "approval_status": "approved",
        "is_active": True,
    }

    current_test_user = [mock_student]

    async def override_get_current_user():
        return current_test_user[0]

    app.dependency_overrides[get_current_user] = override_get_current_user

    client = TestClient(app)

    # 1. Rubric criteria endpoint returns max score of 100
    res = client.get("/api/proposals/rubric-criteria")
    assert res.status_code == 200, res.text
    rubric_data = res.json()
    assert rubric_data["maxTotalScore"] == 100
    assert len(rubric_data["criteria"]) == 5

    # 2. Get published challenges
    res = client.get("/api/proposals/challenges/published")
    assert res.status_code == 200
    challenges = res.json()["challenges"]
    assert len(challenges) >= 1
    challenge_id = challenges[0]["id"]

    # 3. Create Proposal via POST /api/proposals
    create_payload = {
        "title": "Smart Solar Cold Storage for Farmers",
        "challengeId": challenge_id,
        "problemUnderstanding": "Post-harvest crop spoilage due to lack of decentralized cold storage.",
        "proposedSolution": "Phase-change material thermal battery cold rooms for farmer producer organizations.",
        "innovationUniqueness": "Zero chemical refrigerant thermal storage with 72-hour autonomy.",
        "technicalApproach": "IoT temperature nodes, variable frequency drive compressor, MQTT monitoring.",
        "implementationPlan": "Deploy 2 pilot containers in cooperative mandis over 14 weeks.",
        "requiredResources": "Food science lab partnership, cold room insulation panels.",
        "expectedImpact": "Reduce fruit/vegetable wastage by 45% for 120 smallholder farming families.",
        "estimatedTimeline": "14 Weeks",
        "submitImmediately": True,
    }
    res = client.post("/api/proposals", json=create_payload)
    assert res.status_code == 201, res.text
    prop_data = res.json()
    proposal_id = prop_data["id"]
    assert prop_data["status"] == "submitted"

    # 4. Switch to Reviewer & submit evaluation via POST /api/proposals/{id}/review (singular alias)
    current_test_user[0] = mock_reviewer
    review_payload = {
        "criteriaScores": [
            {"key": c["key"], "label": c["label"], "score": 19, "maxScore": 20, "comment": "Exemplary"}
            for c in rubric_data["criteria"]
        ],
        "overallFeedback": "Thoroughly planned post-harvest refrigeration architecture with high societal impact.",
        "recommendation": "accept",
        "submitFinal": True,
    }
    res = client.post(f"/api/proposals/{proposal_id}/review", json=review_payload)
    assert res.status_code == 200, res.text
    review_res = res.json()
    assert review_res["review"]["totalScore"] == 95.0
    assert review_res["review"]["maxTotalScore"] == 100.0

    # 5. Fetch review history via GET /api/proposals/{id}/review-history
    res = client.get(f"/api/proposals/{proposal_id}/review-history")
    assert res.status_code == 200
    rev_hist_data = res.json()
    assert len(rev_hist_data["reviewHistory"]) >= 1

    # 6. Update status via PATCH /api/proposals/{id}/status (patch alias)
    patch_payload = {
        "toStatus": "accepted",
        "comment": "Formally accepted for incubation support and grant funding.",
    }
    res = client.patch(f"/api/proposals/{proposal_id}/status", json=patch_payload)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "accepted"

    # Reset overrides
    app.dependency_overrides.clear()
    print("✅ All FastAPI client endpoint tests passed successfully!")


if __name__ == "__main__":
    test_module4_workflow()
    test_module4_fastapi_client()
