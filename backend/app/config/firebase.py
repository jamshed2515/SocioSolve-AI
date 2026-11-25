"""
Firebase Admin SDK initialisation (backend only).

The service account key must never be shipped to the frontend or committed to Git.

Where the key can come from (first match wins):
  1. FIREBASE_SERVICE_ACCOUNT_JSON  - the key's JSON (raw or base64) in one env var
  2. FIREBASE_SERVICE_ACCOUNT_PATH  - path to the downloaded key file
  3. GOOGLE_APPLICATION_CREDENTIALS - standard Google application-default credentials

Local development without a key ("limited mode", DEBUG=True only):
  Sign-in still works because ID tokens are verified against Google's *public*
  certificates, which needs only the project ID. Operations that call Firebase's
  admin API (revoking sessions, changing a password from the backend) are
  skipped or refused with a clear message. Production must always have a key.
"""
import base64
import binascii
import json
import logging
import os

import firebase_admin
from firebase_admin import credentials
from google.auth.credentials import AnonymousCredentials

from app.config.settings import settings

logger = logging.getLogger(__name__)

_has_admin_credentials = False


class _PublicCertsOnlyCredential(credentials.Base):
    """Credential for limited mode: lets the SDK fetch Google's public certs, nothing else."""

    def get_credential(self):
        return AnonymousCredentials()


def has_admin_credentials() -> bool:
    """True when a real service-account key is loaded (admin API calls are possible)."""
    return _has_admin_credentials


def _credential_from_json_env(raw: str) -> credentials.Certificate:
    raw = raw.strip()
    if not raw.startswith("{"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError) as exc:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is neither JSON nor base64-encoded JSON.") from exc
    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.") from exc
    return credentials.Certificate(info)


def _load_admin_credential():
    """Return (credential, source) for a real key, or (None, reason) when none is available."""
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        return _credential_from_json_env(settings.FIREBASE_SERVICE_ACCOUNT_JSON), "FIREBASE_SERVICE_ACCOUNT_JSON"

    path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    if path:
        if os.path.isfile(path):
            return credentials.Certificate(path), path
        if not settings.DEBUG:
            raise RuntimeError(f"FIREBASE_SERVICE_ACCOUNT_PATH not found: {path}")
        return None, f"key file not found at {path}"

    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return credentials.ApplicationDefault(), "GOOGLE_APPLICATION_CREDENTIALS"

    return None, "no service-account key configured"


def init_firebase() -> firebase_admin.App:
    """Initialise the default Firebase app once (idempotent)."""
    global _has_admin_credentials
    if firebase_admin._apps:
        return firebase_admin.get_app()

    options = {"projectId": settings.FIREBASE_PROJECT_ID} if settings.FIREBASE_PROJECT_ID else None
    cred, source = _load_admin_credential()

    if cred is not None:
        app = firebase_admin.initialize_app(cred, options)
        _has_admin_credentials = True
        logger.info("Firebase Admin SDK initialised (project: %s, key: %s)", app.project_id, source)
        return app

    if not settings.DEBUG:
        raise RuntimeError(
            "Firebase service-account key is required when DEBUG=False "
            "(set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH)."
        )
    if not settings.FIREBASE_PROJECT_ID:
        raise RuntimeError("FIREBASE_PROJECT_ID must be set to verify sign-in tokens.")

    app = firebase_admin.initialize_app(_PublicCertsOnlyCredential(), options)
    _has_admin_credentials = False
    logger.warning(
        "Firebase running in LIMITED local mode (%s). Sign-in works; session revocation and "
        "backend password changes are disabled. Add the service-account key to enable them.",
        source,
    )
    return app
