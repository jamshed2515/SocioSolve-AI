"""
Firebase Admin SDK initialisation (backend only).

The service account JSON must never be shipped to the frontend or committed to Git.
"""
import logging
import os

import firebase_admin
from firebase_admin import credentials

from app.config.settings import settings

logger = logging.getLogger(__name__)


def init_firebase() -> firebase_admin.App:
    """Initialise the default Firebase app once (idempotent)."""
    if firebase_admin._apps:
        return firebase_admin.get_app()

    options = {"projectId": settings.FIREBASE_PROJECT_ID} if settings.FIREBASE_PROJECT_ID else None
    path = settings.FIREBASE_SERVICE_ACCOUNT_PATH

    if path:
        if not os.path.isfile(path):
            raise RuntimeError(f"FIREBASE_SERVICE_ACCOUNT_PATH not found: {path}")
        cred = credentials.Certificate(path)
    else:
        # Falls back to GOOGLE_APPLICATION_CREDENTIALS / workload identity
        cred = credentials.ApplicationDefault()

    app = firebase_admin.initialize_app(cred, options)
    logger.info("Firebase Admin SDK initialised (project: %s)", app.project_id)
    return app
