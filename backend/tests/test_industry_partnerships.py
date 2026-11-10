"""
Automated unit & integration test suite for Module 6: Industry Partnerships.
Tests business logic, authorization, capacity limits, atomic updates, and duplicate prevention.
Uses standard asyncio.run() to execute async coroutines cleanly without requiring pytest-asyncio plugin.
"""
import sys
from unittest.mock import MagicMock
from datetime import datetime, timezone
import pytest
from bson import ObjectId

# Ensure missing third-party libs don't prevent unit testing
for mod in ["motor", "motor.motor_asyncio", "jose", "passlib", "passlib.context", "slowapi", "slowapi.util", "slowapi.errors"]:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

def run_coro(coro):
    """Pure coroutine driver that avoids Windows IOCP / proactor event loop blocking."""
    try:
        while True:
            coro.send(None)
    except StopIteration as e:
        return e.value

from fastapi import HTTPException
from pydantic import ValidationError
from app.models.partnership import OpportunityType, OpportunityStatus, ApplicationStatus
from app.schemas.partnership_schema import (
    CreateOpportunityRequest,
    ApplyOpportunityRequest,
    UpdateApplicationStatusRequest,
)
from app.services import partnership_service


# ── In-Memory Async MongoDB Mock ──────────────────────────────────────────────

class MockCursor:
    def __init__(self, items):
        self._items = items

    def sort(self, key, direction=-1):
        reverse = direction == -1
        self._items = sorted(self._items, key=lambda x: x.get(key, 0), reverse=reverse)
        return self

    async def to_list(self, length=100):
        return self._items[:length]


class MockCollection:
    def __init__(self):
        self.docs = []

    async def insert_one(self, doc, **kwargs):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = ObjectId()
        self.docs.append(d)
        res = MagicMock()
        res.inserted_id = d["_id"]
        return res

    async def find_one(self, filter_query):
        for doc in self.docs:
            match = True
            for k, v in filter_query.items():
                if k == "$or":
                    or_match = any(
                        sub_k in doc and sub_v.get("$options") and sub_v.get("$regex", "").lower() in str(doc.get(sub_k, "")).lower()
                        for cond in v for sub_k, sub_v in cond.items()
                    )
                    if not or_match:
                        match = False
                        break
                elif isinstance(v, dict):
                    if "$in" in v:
                        doc_val = doc.get(k, [])
                        if not any(item in v["$in"] for item in (doc_val if isinstance(doc_val, list) else [doc_val])):
                            match = False
                            break
                    elif "$ne" in v:
                        if doc.get(k) == v["$ne"]:
                            match = False
                            break
                    elif "$gt" in v:
                        if not (doc.get(k, 0) > v["$gt"]):
                            match = False
                            break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    def find(self, filter_query=None, projection=None):
        if not filter_query:
            return MockCursor([dict(d) for d in self.docs])
        matched = []
        for doc in self.docs:
            match = True
            for k, v in filter_query.items():
                if k == "$or":
                    or_match = any(
                        sub_k in doc and sub_v.get("$regex", "").lower() in str(doc.get(sub_k, "")).lower()
                        for cond in v for sub_k, sub_v in cond.items()
                    )
                    if not or_match:
                        match = False
                        break
                elif isinstance(v, dict):
                    if "$in" in v:
                        doc_val = doc.get(k, [])
                        if not any(item in v["$in"] for item in (doc_val if isinstance(doc_val, list) else [doc_val])):
                            match = False
                            break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                matched.append(dict(doc))
        return MockCursor(matched)

    async def update_one(self, filter_query, update_query, **kwargs):
        matched_doc = None
        for doc in self.docs:
            match = True
            for k, v in filter_query.items():
                if k == "$expr":
                    # Support $expr: {"$lt": ["$acceptedTeamsCount", "$maxTeams"]}
                    if "$lt" in v:
                        field_a = v["$lt"][0].replace("$", "")
                        field_b = v["$lt"][1].replace("$", "")
                        if not (doc.get(field_a, 0) < doc.get(field_b, 0)):
                            match = False
                            break
                elif isinstance(v, dict):
                    if "$ne" in v and doc.get(k) == v["$ne"]:
                        match = False
                        break
                    elif "$gt" in v and not (doc.get(k, 0) > v["$gt"]):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                matched_doc = doc
                break

        res = MagicMock()
        if not matched_doc:
            res.matched_count = 0
            res.modified_count = 0
            return res

        res.matched_count = 1
        res.modified_count = 1

        if "$set" in update_query:
            matched_doc.update(update_query["$set"])
        if "$inc" in update_query:
            for inc_k, inc_v in update_query["$inc"].items():
                matched_doc[inc_k] = matched_doc.get(inc_k, 0) + inc_v

        return res


class MockDatabase:
    def __init__(self):
        self.partnerships = MockCollection()
        self.partnership_applications = MockCollection()
        self.users = MockCollection()


# ── Test Fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def mock_db(monkeypatch):
    db = MockDatabase()
    monkeypatch.setattr(partnership_service, "get_database", lambda: db)
    return db


@pytest.fixture
def industry_user():
    return {
        "_id": ObjectId(),
        "name": "Sarah Connor",
        "email": "sarah@cyberdyne.com",
        "role": "industry",
        "organization": {
            "name": "Cyberdyne Systems",
            "type": "company",
            "website": "https://cyberdyne.com",
        },
    }


@pytest.fixture
def student_user():
    return {
        "_id": ObjectId(),
        "name": "John Connor",
        "email": "john@student.edu",
        "role": "student",
    }


# ── 1. Create Opportunity Tests ───────────────────────────────────────────────

def test_create_opportunity_success(mock_db, industry_user):
    async def _test():
        req = CreateOpportunityRequest(
            title="AI Robotics Mentorship",
            description="Mentoring student teams on autonomous robotics solutions for healthcare.",
            type=OpportunityType.MENTORSHIP,
            targetCategories=["Healthcare", "Robotics"],
            resourcesOffered=["Weekly 1:1 Mentorship", "Hardware Lab Access"],
            maxTeams=2,
        )
        res = await partnership_service.create_opportunity(user=industry_user, payload=req)

        assert res.id is not None
        assert res.title == "AI Robotics Mentorship"
        assert res.organizationName == "Cyberdyne Systems"
        assert res.status == OpportunityStatus.ACTIVE
        assert res.acceptedTeamsCount == 0
        assert res.maxTeams == 2

    run_coro(_test())


def test_create_opportunity_validation_error():
    # Title too short (<5 chars)
    with pytest.raises(ValidationError):
        CreateOpportunityRequest(
            title="AI",
            description="Too short title test",
            type=OpportunityType.MENTORSHIP,
            targetCategories=["Health"],
            resourcesOffered=["Mentorship"],
        )


# ── 2. Opportunity Listing & Filtering Tests ──────────────────────────────────

def test_get_opportunities_filtering(mock_db, industry_user):
    async def _test():
        req1 = CreateOpportunityRequest(
            title="Solar Clean Energy Grant",
            description="Providing micro-grants for renewable clean energy systems in rural areas.",
            type=OpportunityType.FUNDING,
            targetCategories=["Clean Energy"],
            resourcesOffered=["$5,000 Grant"],
            maxTeams=3,
        )
        req2 = CreateOpportunityRequest(
            title="Healthcare Dataset Access",
            description="Providing anonymized patient outcome datasets for predictive diagnosis.",
            type=OpportunityType.DATASET,
            targetCategories=["Healthcare"],
            resourcesOffered=["HIPAA compliant dataset"],
            maxTeams=3,
        )
        await partnership_service.create_opportunity(user=industry_user, payload=req1)
        await partnership_service.create_opportunity(user=industry_user, payload=req2)

        # Filter by type
        res_funding = await partnership_service.get_opportunities(opportunity_type="Funding")
        assert res_funding.total == 1
        assert res_funding.opportunities[0].type == OpportunityType.FUNDING

        # Filter by category
        res_health = await partnership_service.get_opportunities(category="Healthcare")
        assert res_health.total == 1
        assert res_health.opportunities[0].title == "Healthcare Dataset Access"

    run_coro(_test())


# ── 3. Student Application & Duplicate Prevention Tests ───────────────────────

def test_apply_to_opportunity_success(mock_db, industry_user, student_user):
    async def _test():
        req_opp = CreateOpportunityRequest(
            title="Urban Water Quality Monitoring",
            description="Mentoring teams on building IoT water quality sensors for municipal reservoirs.",
            type=OpportunityType.MENTORSHIP,
            targetCategories=["Environment"],
            resourcesOffered=["Sensor kits"],
            maxTeams=2,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)

        app_req = ApplyOpportunityRequest(
            teamName="AquaGuard Pioneers",
            message="We have designed an optical turbidity sensor and need mentorship on calibration.",
        )
        app = await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_user,
            payload=app_req,
        )

        assert app.id is not None
        assert app.teamName == "AquaGuard Pioneers"
        assert app.status == ApplicationStatus.PENDING
        assert app.applicantName == "John Connor"

    run_coro(_test())


def test_apply_duplicate_prevention(mock_db, industry_user, student_user):
    async def _test():
        req_opp = CreateOpportunityRequest(
            title="Urban Water Quality Monitoring",
            description="Mentoring teams on building IoT water quality sensors for municipal reservoirs.",
            type=OpportunityType.MENTORSHIP,
            targetCategories=["Environment"],
            resourcesOffered=["Sensor kits"],
            maxTeams=2,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)

        app_req = ApplyOpportunityRequest(
            teamName="AquaGuard Pioneers",
            message="First application pitch for this opportunity.",
        )
        await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_user,
            payload=app_req,
        )

        # Second application must raise HTTP 409 Conflict
        with pytest.raises(HTTPException) as exc_info:
            await partnership_service.apply_to_opportunity(
                opportunity_id=opp.id,
                student_user=student_user,
                payload=app_req,
            )
        assert exc_info.value.status_code == 409

    run_coro(_test())


def test_apply_to_closed_opportunity_rejected(mock_db, industry_user, student_user):
    async def _test():
        req_opp = CreateOpportunityRequest(
            title="Closed Mentorship Offer",
            description="This opportunity is already closed to any new applications.",
            type=OpportunityType.MENTORSHIP,
            targetCategories=["Environment"],
            resourcesOffered=["Mentorship"],
            maxTeams=2,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)
        await partnership_service.update_opportunity_status(
            opportunity_id=opp.id,
            industry_user_id=str(industry_user["_id"]),
            new_status=OpportunityStatus.CLOSED,
        )

        app_req = ApplyOpportunityRequest(
            teamName="Team Delta",
            message="Attempting to apply to closed opportunity.",
        )
        with pytest.raises(HTTPException) as exc_info:
            await partnership_service.apply_to_opportunity(
                opportunity_id=opp.id,
                student_user=student_user,
                payload=app_req,
            )
        assert exc_info.value.status_code == 400

    run_coro(_test())


# ── 4. Ownership & Review Boundary Tests ──────────────────────────────────────

def test_unauthorized_review_rejected(mock_db, industry_user, student_user):
    async def _test():
        # Industry User A creates opportunity
        req_opp = CreateOpportunityRequest(
            title="Cybersecurity Internship",
            description="Internship opportunity for vulnerability assessments on civic infrastructure.",
            type=OpportunityType.INTERNSHIP,
            targetCategories=["Infrastructure"],
            resourcesOffered=["Stipend & Mentorship"],
            maxTeams=1,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)

        # Student applies
        app = await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_user,
            payload=ApplyOpportunityRequest(
                teamName="NetShield",
                message="We have ethical hacking expertise and want to secure municipal data.",
            ),
        )

        # Industry User B tries to review User A's application
        malicious_industry_user_id = str(ObjectId())
        with pytest.raises(HTTPException) as exc_info:
            await partnership_service.update_application_status(
                application_id=app.id,
                industry_user_id=malicious_industry_user_id,
                payload=UpdateApplicationStatusRequest(status=ApplicationStatus.ACCEPTED),
            )
        assert exc_info.value.status_code == 403

    run_coro(_test())


# ── 5. Atomic Acceptance & Maximum Quota Tests ────────────────────────────────

def test_atomic_acceptance_and_quota_enforcement(mock_db, industry_user):
    async def _test():
        # Create opportunity with maxTeams = 1
        req_opp = CreateOpportunityRequest(
            title="Micro-Grant for Solar Heating",
            description="Grant for single winning university team to build pilot solar water heater.",
            type=OpportunityType.FUNDING,
            targetCategories=["Clean Energy"],
            resourcesOffered=["$3,000 Grant"],
            maxTeams=1,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)

        # Student 1 applies
        student_1 = {"_id": ObjectId(), "name": "Student One", "email": "s1@test.com", "role": "student"}
        app_1 = await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_1,
            payload=ApplyOpportunityRequest(teamName="Solar Team 1", message="We have prototype ready for deployment."),
        )

        # Student 2 applies
        student_2 = {"_id": ObjectId(), "name": "Student Two", "email": "s2@test.com", "role": "student"}
        app_2 = await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_2,
            payload=ApplyOpportunityRequest(teamName="Solar Team 2", message="We have alternative thermal model."),
        )

        # Accept Student 1 -> Success, acceptedTeamsCount becomes 1
        updated_1 = await partnership_service.update_application_status(
            application_id=app_1.id,
            industry_user_id=str(industry_user["_id"]),
            payload=UpdateApplicationStatusRequest(status=ApplicationStatus.ACCEPTED),
        )
        assert updated_1.status == ApplicationStatus.ACCEPTED

        # Opportunity now has acceptedTeamsCount = 1 == maxTeams
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 1

        # Attempt to accept Student 2 -> Must fail with HTTP 400 because maxTeams reached
        with pytest.raises(HTTPException) as exc_info:
            await partnership_service.update_application_status(
                application_id=app_2.id,
                industry_user_id=str(industry_user["_id"]),
                payload=UpdateApplicationStatusRequest(status=ApplicationStatus.ACCEPTED),
            )
        assert exc_info.value.status_code == 400
        assert "maximum accepted teams capacity" in exc_info.value.detail.lower()

        # Verify rollback: app_2 must still be Pending and acceptedTeamsCount must not exceed 1
        app_2_doc = await mock_db.partnership_applications.find_one({"_id": ObjectId(app_2.id)})
        assert app_2_doc["status"] == ApplicationStatus.PENDING.value
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 1

    run_coro(_test())


# ── 6. Status Reversion Counter Safety Tests ──────────────────────────────────

def test_rejection_decrements_accepted_counter(mock_db, industry_user, student_user):
    async def _test():
        req_opp = CreateOpportunityRequest(
            title="Civic Data Science Mentorship",
            description="Mentoring teams on analyzing public traffic and transit datasets.",
            type=OpportunityType.MENTORSHIP,
            targetCategories=["Smart Cities"],
            resourcesOffered=["Transit APIs"],
            maxTeams=2,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)
        app = await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_user,
            payload=ApplyOpportunityRequest(teamName="TransitFlow", message="Analyzing bus delays in Lahore."),
        )

        # 1. Accept application -> count becomes 1
        await partnership_service.update_application_status(
            application_id=app.id,
            industry_user_id=str(industry_user["_id"]),
            payload=UpdateApplicationStatusRequest(status=ApplicationStatus.ACCEPTED),
        )
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 1

        # 2. Reject accepted application -> count safely decrements back to 0
        await partnership_service.update_application_status(
            application_id=app.id,
            industry_user_id=str(industry_user["_id"]),
            payload=UpdateApplicationStatusRequest(status=ApplicationStatus.REJECTED, feedback="Change of scope."),
        )
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 0

        app_doc = await mock_db.partnership_applications.find_one({"_id": ObjectId(app.id)})
        assert app_doc["status"] == ApplicationStatus.REJECTED.value
        assert app_doc["feedback"] == "Change of scope."

    run_coro(_test())


# ── 7. Closed Opportunity & Concurrency Tests ─────────────────────────────────

def test_cannot_accept_application_for_closed_opportunity(mock_db, industry_user, student_user):
    """Verify an application cannot be accepted after its opportunity has been closed."""
    async def _test():
        # 1. Create opportunity and submit an application while active
        req_opp = CreateOpportunityRequest(
            title="Urban Solar Mapping",
            description="Mentorship on processing solar irradiance data.",
            type=OpportunityType.MENTORSHIP,
            targetCategories=["Energy & Sustainability"],
            resourcesOffered=["Cloud GPU"],
            maxTeams=2,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)
        app = await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_user,
            payload=ApplyOpportunityRequest(teamName="SolarTech", message="Interested in solar mapping."),
        )

        # 2. Industry partner closes the opportunity
        await partnership_service.update_opportunity_status(
            opportunity_id=opp.id,
            industry_user_id=str(industry_user["_id"]),
            new_status=OpportunityStatus.CLOSED,
        )

        # Verify opportunity is indeed closed
        closed_opp = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert closed_opp["status"] == OpportunityStatus.CLOSED.value

        # 3. Attempting to accept the application must fail with HTTP 400
        with pytest.raises(HTTPException) as exc_info:
            await partnership_service.update_application_status(
                application_id=app.id,
                industry_user_id=str(industry_user["_id"]),
                payload=UpdateApplicationStatusRequest(status=ApplicationStatus.ACCEPTED),
            )
        assert exc_info.value.status_code == 400
        assert "closed" in exc_info.value.detail.lower()

        # 4. Verify application remains Pending and counter remains 0
        app_doc = await mock_db.partnership_applications.find_one({"_id": ObjectId(app.id)})
        assert app_doc["status"] == ApplicationStatus.PENDING.value
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 0

    run_coro(_test())


def test_concurrent_status_cas_safety(mock_db, industry_user, student_user):
    """Verify Compare-And-Swap (CAS) prevents concurrent conflicting updates and preserves counter."""
    async def _test():
        req_opp = CreateOpportunityRequest(
            title="Smart Grid Innovation",
            description="Developing grid management tools.",
            type=OpportunityType.DATASET,
            targetCategories=["Smart Cities"],
            resourcesOffered=["Grid Telemetry"],
            maxTeams=1,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)
        app = await partnership_service.apply_to_opportunity(
            opportunity_id=opp.id,
            student_user=student_user,
            payload=ApplyOpportunityRequest(
                teamName="GridTeam",
                message="We specialize in grid telemetry analysis and AI routing.",
            ),
        )

        # Request A: Successfully Accepts the application
        res_a = await partnership_service.update_application_status(
            application_id=app.id,
            industry_user_id=str(industry_user["_id"]),
            payload=UpdateApplicationStatusRequest(status=ApplicationStatus.ACCEPTED),
        )
        assert res_a.status == ApplicationStatus.ACCEPTED
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 1

        # Request A2: Idempotent accept returns without double-incrementing counter
        res_a2 = await partnership_service.update_application_status(
            application_id=app.id,
            industry_user_id=str(industry_user["_id"]),
            payload=UpdateApplicationStatusRequest(status=ApplicationStatus.ACCEPTED),
        )
        assert res_a2.status == ApplicationStatus.ACCEPTED
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 1

        # Simulate concurrent race: Request B was dispatched when status was 'Pending',
        # but executes after Request A has already committed 'Accepted'.
        real_find_one = mock_db.partnership_applications.find_one
        async def stale_find_one(query):
            doc = await real_find_one(query)
            if doc and "_id" in query and query["_id"] == ObjectId(app.id):
                doc_copy = dict(doc)
                doc_copy["status"] = ApplicationStatus.PENDING.value
                return doc_copy
            return doc

        mock_db.partnership_applications.find_one = stale_find_one

        # Concurrent Request B attempts to Reject expecting Pending:
        # CAS matching fails because database status is actually Accepted
        with pytest.raises(HTTPException) as exc_info:
            await partnership_service.update_application_status(
                application_id=app.id,
                industry_user_id=str(industry_user["_id"]),
                payload=UpdateApplicationStatusRequest(status=ApplicationStatus.REJECTED),
            )
        assert exc_info.value.status_code == 409
        assert "modified concurrently" in exc_info.value.detail.lower()

        # Restore real find_one
        mock_db.partnership_applications.find_one = real_find_one

        # Verify counter was never corrupted and remains exactly 1
        opp_doc = await mock_db.partnerships.find_one({"_id": ObjectId(opp.id)})
        assert opp_doc["acceptedTeamsCount"] == 1

    run_coro(_test())


def test_apply_duplicate_key_error_caught(mock_db, industry_user, student_user):
    """Verify PyMongo DuplicateKeyError during insert_one is cleanly caught and returns HTTP 409."""
    async def _test():
        req_opp = CreateOpportunityRequest(
            title="Clean Water Initiative",
            description="Developing water quality sensors.",
            type=OpportunityType.FUNDING,
            targetCategories=["Health & Sanitation"],
            resourcesOffered=["$5,000 Grant"],
            maxTeams=2,
        )
        opp = await partnership_service.create_opportunity(user=industry_user, payload=req_opp)

        import pymongo.errors
        orig_insert = mock_db.partnership_applications.insert_one
        async def mock_insert_duplicate(doc, **kwargs):
            raise pymongo.errors.DuplicateKeyError("E11000 duplicate key error collection")

        mock_db.partnership_applications.insert_one = mock_insert_duplicate

        with pytest.raises(HTTPException) as exc_info:
            await partnership_service.apply_to_opportunity(
                opportunity_id=opp.id,
                student_user=student_user,
                payload=ApplyOpportunityRequest(
                    teamName="AquaSafe",
                    message="We have built working prototypes for low-cost water sensors.",
                ),
            )

        assert exc_info.value.status_code == 409
        assert "already submitted an application" in exc_info.value.detail.lower()

        mock_db.partnership_applications.insert_one = orig_insert

    run_coro(_test())


if __name__ == "__main__":
    def get_fresh_db():
        d = MockDatabase()
        partnership_service.get_database = lambda: d
        return d

    ind_user = {
        "_id": ObjectId(),
        "name": "Sarah Connor",
        "email": "sarah@cyberdyne.com",
        "role": "industry",
        "organization": {
            "name": "Cyberdyne Systems",
            "type": "company",
            "website": "https://cyberdyne.com",
        },
    }
    stu_user = {
        "_id": ObjectId(),
        "name": "John Connor",
        "email": "john@student.edu",
        "role": "student",
    }

    print("Running test 1: test_create_opportunity_success...")
    test_create_opportunity_success(get_fresh_db(), ind_user)
    print("Test 1 PASSED!")

    print("Running test 2: test_create_opportunity_validation_error...")
    test_create_opportunity_validation_error()
    print("Test 2 PASSED!")

    print("Running test 3: test_get_opportunities_filtering...")
    test_get_opportunities_filtering(get_fresh_db(), ind_user)
    print("Test 3 PASSED!")

    print("Running test 4: test_apply_to_opportunity_success...")
    test_apply_to_opportunity_success(get_fresh_db(), ind_user, stu_user)
    print("Test 4 PASSED!")

    print("Running test 5: test_apply_duplicate_prevention...")
    test_apply_duplicate_prevention(get_fresh_db(), ind_user, stu_user)
    print("Test 5 PASSED!")

    print("Running test 6: test_apply_to_closed_opportunity_rejected...")
    test_apply_to_closed_opportunity_rejected(get_fresh_db(), ind_user, stu_user)
    print("Test 6 PASSED!")

    print("Running test 7: test_unauthorized_review_rejected...")
    test_unauthorized_review_rejected(get_fresh_db(), ind_user, stu_user)
    print("Test 7 PASSED!")

    print("Running test 8: test_atomic_acceptance_and_quota_enforcement...")
    test_atomic_acceptance_and_quota_enforcement(get_fresh_db(), ind_user)
    print("Test 8 PASSED!")

    print("Running test 9: test_rejection_decrements_accepted_counter...")
    test_rejection_decrements_accepted_counter(get_fresh_db(), ind_user, stu_user)
    print("Test 9 PASSED!")

    print("Running test 10: test_cannot_accept_application_for_closed_opportunity...")
    test_cannot_accept_application_for_closed_opportunity(get_fresh_db(), ind_user, stu_user)
    print("Test 10 PASSED!")

    print("Running test 11: test_concurrent_status_cas_safety...")
    test_concurrent_status_cas_safety(get_fresh_db(), ind_user, stu_user)
    print("Test 11 PASSED!")

    print("Running test 12: test_apply_duplicate_key_error_caught...")
    test_apply_duplicate_key_error_caught(get_fresh_db(), ind_user, stu_user)
    print("Test 12 PASSED!")

    print("\nALL 12 UNIT & INTEGRATION TESTS PASSED PERFECTLY!")
