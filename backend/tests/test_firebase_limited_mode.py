"""
Local "limited mode": the backend runs without the Firebase service-account key
(DEBUG=True only). Sign-in still works; admin-API operations are skipped or refused.
"""
import pytest
from firebase_admin import auth as fb_auth

from app.config import firebase as firebase_config
from app.config.settings import settings
from app.utils import firebase_token as ft
from tests.conftest import TOKENS, auth, make_claims


def register(client, token, uid, email, role):
    TOKENS[token] = make_claims(uid, email)
    r = client.post("/api/auth/sync-user", headers=auth(token), json={"requestedRole": role, "name": "Test User"})
    assert r.status_code == 200, r.text
    return r


@pytest.fixture
def fresh_firebase(monkeypatch):
    """Let init_firebase() run from scratch, then restore the global state."""
    monkeypatch.setattr(firebase_config.firebase_admin, "_apps", {})
    created = {}

    def fake_initialize_app(cred, options=None):
        created["cred"], created["options"] = cred, options

        class App:
            project_id = (options or {}).get("projectId")
        return App()

    monkeypatch.setattr(firebase_config.firebase_admin, "initialize_app", fake_initialize_app)
    monkeypatch.setattr(settings, "FIREBASE_SERVICE_ACCOUNT_JSON", "")
    monkeypatch.setattr(settings, "FIREBASE_SERVICE_ACCOUNT_PATH", "./secrets/does-not-exist.json")
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
    return created


def test_missing_key_in_debug_starts_limited_mode(fresh_firebase, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)
    firebase_config.init_firebase()
    assert firebase_config.has_admin_credentials() is False
    assert isinstance(fresh_firebase["cred"], firebase_config._PublicCertsOnlyCredential)
    assert fresh_firebase["options"] == {"projectId": settings.FIREBASE_PROJECT_ID}


def test_missing_key_in_production_refuses_to_start(fresh_firebase, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", False)
    with pytest.raises(RuntimeError, match="FIREBASE_SERVICE_ACCOUNT_PATH not found"):
        firebase_config.init_firebase()


def test_invalid_json_key_is_reported(fresh_firebase, monkeypatch):
    monkeypatch.setattr(settings, "FIREBASE_SERVICE_ACCOUNT_JSON", "not-json-or-base64!")
    with pytest.raises(RuntimeError, match="FIREBASE_SERVICE_ACCOUNT_JSON"):
        firebase_config.init_firebase()


def test_verifier_skips_revocation_check_without_key(no_firebase_key, monkeypatch):
    seen = {}
    monkeypatch.setattr(fb_auth, "verify_id_token", lambda t, **k: seen.update(k) or {"uid": "u"})
    ft.verify_firebase_token("tok")
    assert seen["check_revoked"] is False


def test_logout_works_without_key(client, no_firebase_key, monkeypatch):
    def boom(uid):
        raise AssertionError("revoke_refresh_tokens must not be called without a key")
    monkeypatch.setattr(fb_auth, "revoke_refresh_tokens", boom)
    register(client, "t", "u", "a@x.com", "citizen")
    assert client.post("/api/auth/logout", headers=auth("t")).status_code == 200


def test_change_password_explains_missing_key(client, no_firebase_key):
    register(client, "t", "u", "a@x.com", "student")
    ok = {"newPassword": "NewPass123", "confirmPassword": "NewPass123"}
    r = client.put("/api/users/change-password", headers=auth("t"), json=ok)
    assert r.status_code == 503
    assert "Firebase admin key" in r.json()["detail"]
