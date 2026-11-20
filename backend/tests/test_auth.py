import pytest
from fastapi import HTTPException
from firebase_admin import auth as fb_auth

from app.utils import firebase_token as ft
from tests.conftest import TOKENS, make_claims, auth


def register(client, token, uid, email, role, **body):
    TOKENS[token] = make_claims(uid, email)
    return client.post("/api/auth/sync-user", headers=auth(token), json={"requestedRole": role, "name": "Test User", **body})


# 1, 2 - self-service roles
@pytest.mark.parametrize("role", ["citizen", "student"])
def test_self_service_registration(client, role):
    r = register(client, "t1", "uid1", f"{role}@x.com", role)
    assert r.status_code == 200, r.text
    u = r.json()["user"]
    assert r.json()["created"] is True
    assert u["role"] == role and u["approvalStatus"] == "approved"
    assert u["dashboard"] == f"/dashboard/{role}"


# 3, 4 - approval flow
@pytest.mark.parametrize("role", ["university", "industry"])
def test_org_registration_requires_approval(client, db, role):
    assert register(client, "o", "org1", "org@x.com", role).status_code == 422  # org name required
    r = register(client, "o", "org1", "org@x.com", role, organization={"name": "ACME", "type": "hacked"})
    u = r.json()["user"]
    assert u["approvalStatus"] == "pending" and u["organization"]["type"] == role
    assert client.get(f"/api/dashboard/{role}", headers=auth("o")).status_code == 403

    # admin approves
    from app.models.user import new_user_document, UserRole
    import asyncio
    asyncio.run(db.users.insert_one(new_user_document("adm", "admin@x.com", "Admin", UserRole.ADMIN, True)))
    TOKENS["a"] = make_claims("adm", "admin@x.com")
    r = client.put(f"/api/admin/users/{u['id']}/approval", headers=auth("a"), json={"approve": True})
    assert r.status_code == 200 and r.json()["approvalStatus"] == "approved"
    assert client.get(f"/api/dashboard/{role}", headers=auth("o")).status_code == 200


# 5 - Google sign-in (new user must pick role, then idempotent re-sync)
def test_google_signin_flow(client, db):
    TOKENS["g"] = make_claims("guid", "g@gmail.com", provider="google.com", name="G User", picture="http://p")
    assert client.post("/api/auth/sync-user", headers=auth("g")).status_code == 422
    r = client.post("/api/auth/sync-user", headers=auth("g"), json={"requestedRole": "student"})
    assert r.json()["user"]["name"] == "G User" and r.json()["user"]["profileImage"] == "http://p"
    r2 = client.post("/api/auth/sync-user", headers=auth("g"), json={"requestedRole": "citizen"})
    assert r2.json()["created"] is False and r2.json()["user"]["role"] == "student"  # role not changeable
    assert len(db.users.docs) == 1  # no duplicates


# 6, 9 - login / persistence: /me works with token
def test_login_me(client):
    register(client, "t", "u", "a@x.com", "citizen")
    r = client.get("/api/auth/me", headers=auth("t"))
    assert r.status_code == 200 and r.json()["email"] == "a@x.com"
    assert "password" not in r.json()


# 8 - logout
def test_logout(client, monkeypatch):
    called = {}
    monkeypatch.setattr(fb_auth, "revoke_refresh_tokens", lambda uid: called.setdefault("uid", uid))
    register(client, "t", "u", "a@x.com", "citizen")
    assert client.post("/api/auth/logout", headers=auth("t")).status_code == 200
    assert called["uid"] == "u"


# 10, 11 - invalid / expired / revoked / missing
@pytest.mark.parametrize("token", ["garbage", "expired", "revoked"])
def test_bad_tokens(client, token):
    assert client.get("/api/auth/me", headers=auth(token)).status_code == 401


def test_missing_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_real_verifier_maps_firebase_errors(monkeypatch):
    for exc, code in [
        (fb_auth.ExpiredIdTokenError("x", None), 401),
        (fb_auth.RevokedIdTokenError("x"), 401),
        (fb_auth.InvalidIdTokenError("x"), 401),
        (fb_auth.UserDisabledError("x"), 403),
    ]:
        def boom(*a, _e=exc, **k):
            raise _e
        monkeypatch.setattr(fb_auth, "verify_id_token", boom)
        with pytest.raises(HTTPException) as ei:
            ft.verify_firebase_token("tok")
        assert ei.value.status_code == code


def test_verifier_checks_revocation(monkeypatch):
    seen = {}
    monkeypatch.setattr(fb_auth, "verify_id_token", lambda t, **k: seen.update(k) or {"uid": "u"})
    ft.verify_firebase_token("tok")
    assert seen["check_revoked"] is True


# 12 - wrong-role dashboard
def test_unauthorized_dashboard(client):
    register(client, "t", "u", "a@x.com", "student")
    assert client.get("/api/dashboard/student", headers=auth("t")).status_code == 200
    for other in ["citizen", "university", "industry", "admin"]:
        assert client.get(f"/api/dashboard/{other}", headers=auth("t")).status_code == 403


# 13 - admin cannot be self-assigned / escalated
def test_admin_privilege_protection(client):
    r = register(client, "t", "u", "a@x.com", "admin")
    assert r.status_code == 403
    register(client, "t", "u", "a@x.com", "citizen")
    r = client.put("/api/users/profile", headers=auth("t"), json={"name": "Hacker", "role": "admin", "is_active": True})
    assert r.status_code == 200 and r.json()["user"]["role"] == "citizen"
    assert client.get("/api/admin/users/pending", headers=auth("t")).status_code == 403


# 14 - profile update
def test_profile_update(client):
    register(client, "t", "u", "a@x.com", "student")
    r = client.put("/api/users/profile", headers=auth("t"),
                   json={"name": "New Name", "skills": ["Python", " python ", "Python"], "interests": ["AI"]})
    assert r.status_code == 200
    u = client.get("/api/users/profile", headers=auth("t")).json()
    assert u["name"] == "New Name" and u["skills"] == ["Python", "python"] and u["interests"] == ["AI"]


def test_change_password_rules(client):
    register(client, "t", "u", "a@x.com", "student")
    ok = {"newPassword": "NewPass123", "confirmPassword": "NewPass123"}
    assert client.put("/api/users/change-password", headers=auth("t"), json=ok).status_code == 200
    TOKENS["old"] = make_claims("u", "a@x.com", auth_time=1)
    assert client.put("/api/users/change-password", headers=auth("old"), json=ok).status_code == 401
    TOKENS["goog"] = make_claims("u", "a@x.com", provider="google.com")
    assert client.put("/api/users/change-password", headers=auth("goog"), json=ok).status_code == 400


# 15 - inactive user rejected (sync-user, /me, /profile, and admin deactivation)
def test_inactive_user_rejected(client, db):
    register(client, "t", "u", "a@x.com", "citizen")
    db.users.docs[0]["is_active"] = False
    assert client.post("/api/auth/sync-user", headers=auth("t"), json={}).status_code == 403
    assert client.get("/api/auth/me", headers=auth("t")).status_code == 403
    assert client.get("/api/users/profile", headers=auth("t")).status_code == 403


def test_admin_pending_list_and_rejection_flow(client, db):
    from app.models.user import new_user_document, UserRole
    import asyncio

    # Register pending industry user
    r = register(client, "ind", "ind1", "ind@x.com", "industry", organization={"name": "TechCorp"})
    assert r.status_code == 200
    ind_user = r.json()["user"]
    assert ind_user["approvalStatus"] == "pending"

    # Non-admin cannot view pending or reject
    assert client.get("/api/admin/users/pending", headers=auth("ind")).status_code == 403
    assert client.put(f"/api/admin/users/{ind_user['id']}/approval", headers=auth("ind"), json={"approve": True}).status_code == 403

    # Admin lists pending users & rejects
    asyncio.run(db.users.insert_one(new_user_document("adm", "admin@x.com", "Admin", UserRole.ADMIN, True)))
    TOKENS["a"] = make_claims("adm", "admin@x.com")
    pending = client.get("/api/admin/users/pending", headers=auth("a"))
    assert pending.status_code == 200
    assert any(u["id"] == ind_user["id"] for u in pending.json())

    rej = client.put(f"/api/admin/users/{ind_user['id']}/approval", headers=auth("a"), json={"approve": False})
    assert rej.status_code == 200 and rej.json()["approvalStatus"] == "rejected"
    assert client.get("/api/dashboard/industry", headers=auth("ind")).status_code == 403

    # Pending list no longer includes rejected user
    pending_after = client.get("/api/admin/users/pending", headers=auth("a"))
    assert pending_after.status_code == 200
    assert all(u["id"] != ind_user["id"] for u in pending_after.json())


def test_admin_deactivate_user_revokes_and_blocks(client, db, monkeypatch):
    from app.models.user import new_user_document, UserRole
    import asyncio

    revoked = []
    monkeypatch.setattr(fb_auth, "revoke_refresh_tokens", lambda uid: revoked.append(uid))

    r = register(client, "c", "cit1", "cit@x.com", "citizen")
    cit_id = r.json()["user"]["id"]
    asyncio.run(db.users.insert_one(new_user_document("adm", "admin@x.com", "Admin", UserRole.ADMIN, True)))
    TOKENS["a"] = make_claims("adm", "admin@x.com")

    res = client.put(f"/api/admin/users/{cit_id}/active", params={"active": False}, headers=auth("a"))
    assert res.status_code == 200 and res.json()["isActive"] is False
    assert "cit1" in revoked
    assert client.post("/api/auth/sync-user", headers=auth("c"), json={}).status_code == 403
    assert client.get("/api/auth/me", headers=auth("c")).status_code == 403


# Sync retry: Firebase account exists but first Mongo write failed
def test_sync_retry_after_db_failure(client, db, monkeypatch):
    TOKENS["t"] = make_claims("u", "a@x.com")
    orig = db.users.insert_one

    async def fail(doc):
        raise RuntimeError("Atlas down")
    monkeypatch.setattr(db.users, "insert_one", fail)
    with pytest.raises(RuntimeError):
        client.post("/api/auth/sync-user", headers=auth("t"), json={"requestedRole": "citizen"})
    monkeypatch.setattr(db.users, "insert_one", orig)
    r = client.post("/api/auth/sync-user", headers=auth("t"), json={"requestedRole": "citizen"})
    assert r.status_code == 200 and len(db.users.docs) == 1


def test_unverified_email_cannot_hijack_legacy_profile(client, db):
    import asyncio
    asyncio.run(db.users.insert_one({"email": "old@x.com", "role": "citizen", "name": "Old"}))
    TOKENS["t"] = make_claims("new", "old@x.com", verified=False)
    assert client.post("/api/auth/sync-user", headers=auth("t"), json={"requestedRole": "citizen"}).status_code == 409


def test_profile_image_uploads_to_cloudinary_when_configured(client, monkeypatch):
    from app.services import profile_service

    captured = {}

    async def fake_upload(contents, *, folder, public_id, resource_type="auto", filename=None):
        captured["folder"] = folder
        captured["resource_type"] = resource_type
        captured["size"] = len(contents)
        return f"https://res.cloudinary.com/drg63nu8h/image/upload/{folder}/{public_id}.png"

    monkeypatch.setattr(profile_service, "is_cloudinary_configured", lambda: True)
    monkeypatch.setattr(profile_service, "upload_bytes_to_cloudinary", fake_upload)

    register(client, "t", "u", "a@x.com", "citizen")
    r = client.put(
        "/api/users/profile-image",
        headers=auth("t"),
        files={"file": ("avatar.png", b"\x89PNG\r\n\x1a\nfakebytes", "image/png")},
    )
    assert r.status_code == 200, r.text
    url = r.json()["profileImageUrl"]
    assert url.startswith("https://res.cloudinary.com/drg63nu8h/image/upload/sociosolve/avatars/")
    assert captured["folder"] == "sociosolve/avatars"
    assert captured["resource_type"] == "image"
    prof = client.get("/api/users/profile", headers=auth("t")).json()
    assert prof["profileImage"] == url
