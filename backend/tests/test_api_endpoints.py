"""
Route handler integration test suite for Module 6: Industry Partnerships.
Invokes each route function directly with payload validation, ObjectId parsing, and response modeling.
Avoids Windows IOCP blocking by using the pure coroutine driver run_coro.
"""
import sys
from unittest.mock import MagicMock
from bson import ObjectId

for mod in ["motor", "motor.motor_asyncio", "jose", "passlib", "passlib.context", "slowapi", "slowapi.util", "slowapi.errors"]:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

from app.routes.partnership_routes import (
    create_opportunity,
    list_opportunities,
    get_opportunity,
    get_my_opportunities,
    get_my_incoming_applications,
    get_my_applications,
    update_opportunity_status,
    apply_to_opportunity,
    get_opportunity_applications,
    update_application_status,
)
from app.schemas.partnership_schema import (
    CreateOpportunityRequest,
    OpportunityType,
    OpportunityStatus,
    OpportunityStatusUpdateRequest,
    ApplyOpportunityRequest,
    UpdateApplicationStatusRequest,
    ApplicationStatus,
)
from app.services import partnership_service
from tests.test_industry_partnerships import MockDatabase, run_coro


def test_routes_end_to_end():
    db = MockDatabase()
    partnership_service.get_database = lambda: db

    ind_id = ObjectId()
    ind_user = {
        "_id": ind_id,
        "name": "Acme Corp",
        "email": "partner@acme.com",
        "role": "industry",
        "organization": {"name": "Acme Corp", "website": "https://acme.com"},
    }

    stu_id = ObjectId()
    stu_user = {
        "_id": stu_id,
        "name": "Jane Student",
        "email": "jane@student.edu",
        "role": "student",
    }

    # 1. POST /api/partnerships -> create_opportunity
    create_req = CreateOpportunityRequest(
        title="Smart Cities IoT Grant & Cloud Infrastructure",
        description="Funding and cloud infrastructure for teams building traffic optimization models.",
        type=OpportunityType.FUNDING,
        targetCategories=["Infrastructure", "Smart Cities"],
        resourcesOffered=["$5,000 Cloud Credits", "Technical Architecture Reviews"],
        maxTeams=2,
    )
    opp = run_coro(create_opportunity(payload=create_req, current_user=ind_user))
    opp_id = opp.id
    assert opp.title == create_req.title
    assert opp.status == OpportunityStatus.ACTIVE
    print("Endpoint 1: POST /api/partnerships -> create_opportunity PASSED!")

    # 2. GET /api/partnerships -> list_opportunities
    listed = run_coro(list_opportunities(type=None, category=None, status=None, search=None, current_user=ind_user))
    assert listed.total == 1
    assert listed.opportunities[0].id == opp_id
    print("Endpoint 2: GET /api/partnerships -> list_opportunities PASSED!")

    # 3. GET /api/partnerships/{id} -> get_opportunity
    single = run_coro(get_opportunity(opportunity_id=opp_id, current_user=ind_user))
    assert single.id == opp_id
    assert single.organizationName == "Acme Corp"
    print("Endpoint 3: GET /api/partnerships/{id} -> get_opportunity PASSED!")

    # 4. GET /api/partnerships/my/opportunities -> get_my_opportunities
    my_opps = run_coro(get_my_opportunities(current_user=ind_user))
    assert my_opps.total == 1
    assert my_opps.opportunities[0].id == opp_id
    print("Endpoint 4: GET /api/partnerships/my/opportunities -> get_my_opportunities PASSED!")

    # 5. POST /api/partnerships/{id}/apply -> apply_to_opportunity
    apply_req = ApplyOpportunityRequest(
        teamName="UrbanFlow",
        message="Our student team has deployed road sensors and needs cloud credits for processing.",
    )
    app_res = run_coro(apply_to_opportunity(opportunity_id=opp_id, payload=apply_req, current_user=stu_user))
    app_id = app_res.id
    assert app_res.status == ApplicationStatus.PENDING
    assert app_res.teamName == "UrbanFlow"
    print("Endpoint 5: POST /api/partnerships/{id}/apply -> apply_to_opportunity PASSED!")

    # 6. GET /api/partnerships/my/applications -> get_my_applications
    my_apps = run_coro(get_my_applications(current_user=stu_user))
    assert my_apps.total == 1
    assert my_apps.applications[0].id == app_id
    print("Endpoint 6: GET /api/partnerships/my/applications -> get_my_applications PASSED!")

    # 7. GET /api/partnerships/my/incoming-applications -> get_my_incoming_applications
    incoming = run_coro(get_my_incoming_applications(current_user=ind_user))
    assert incoming.total == 1
    assert incoming.applications[0].id == app_id
    print("Endpoint 7: GET /api/partnerships/my/incoming-applications -> get_my_incoming_applications PASSED!")

    # 8. GET /api/partnerships/{id}/applications -> get_opportunity_applications
    opp_apps = run_coro(get_opportunity_applications(opportunity_id=opp_id, current_user=ind_user))
    assert opp_apps.total == 1
    assert opp_apps.applications[0].id == app_id
    print("Endpoint 8: GET /api/partnerships/{id}/applications -> get_opportunity_applications PASSED!")

    # 9. PATCH /api/partnerships/applications/{id}/status -> update_application_status
    accept_req = UpdateApplicationStatusRequest(
        status=ApplicationStatus.ACCEPTED,
        feedback="Welcome to the cloud cohort!",
    )
    updated_app = run_coro(update_application_status(application_id=app_id, payload=accept_req, current_user=ind_user))
    assert updated_app.status == ApplicationStatus.ACCEPTED
    assert updated_app.feedback == "Welcome to the cloud cohort!"
    print("Endpoint 9: PATCH /api/partnerships/applications/{id}/status -> update_application_status PASSED!")

    # 10. PATCH /api/partnerships/{id}/status -> update_opportunity_status
    toggle_req = OpportunityStatusUpdateRequest(status=OpportunityStatus.CLOSED)
    closed_opp = run_coro(update_opportunity_status(opportunity_id=opp_id, payload=toggle_req, current_user=ind_user))
    assert closed_opp.status == OpportunityStatus.CLOSED
    print("Endpoint 10: PATCH /api/partnerships/{id}/status -> update_opportunity_status PASSED!")

    print("\n" + "=" * 65)
    print("ALL 10 API ROUTE ENDPOINTS TESTED & PASSED WITH 100% SUCCESS!")
    print("=" * 65)


if __name__ == "__main__":
    test_routes_end_to_end()
