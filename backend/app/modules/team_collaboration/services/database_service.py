"""
Database access layer for Module 3 (Team Formation & Collaboration).

Strictly reuses the existing MongoDB Atlas async connection managed by
`app.config.database` – does NOT create a second client or connection pool,
and does NOT create collections or insert records in Phase 1.
"""
import logging
from typing import Any

from app.config.database import get_database
from app.config.settings import settings
from app.modules.team_collaboration.models.collections import TeamCollaborationCollections
from app.modules.team_collaboration.schemas.common import DatabaseStatus

logger = logging.getLogger(__name__)


def get_module_database() -> Any:
    """
    Return the shared active MongoDB database instance from `app.config.database`.
    Raises RuntimeError if called before FastAPI startup initializes the connection.
    """
    db = get_database()
    if db is None:
        raise RuntimeError(
            "MongoDB connection is not initialized. Ensure FastAPI lifespan startup completed."
        )
    return db


def get_collection(collection: TeamCollaborationCollections) -> Any:
    """
    Lazy collection accessor for future phases (Phase 2+).
    MongoDB creates collections lazily on first write, so calling this helper
    does not materialize collections in Phase 1.
    """
    db = get_module_database()
    return db[collection.value]


async def check_database_readiness() -> DatabaseStatus:
    """
    Verify connectivity to the shared MongoDB instance using a lightweight ping.
    Never creates collections or modifies existing database state.
    """
    db = get_database()
    if db is None:
        return DatabaseStatus(
            connected=False,
            database_name=settings.DATABASE_NAME,
            message="Shared MongoDB connection has not been initialized.",
        )

    try:
        await db.client.admin.command("ping")
        return DatabaseStatus(
            connected=True,
            database_name=settings.DATABASE_NAME,
            message="Connected via shared MongoDB Atlas async client.",
        )
    except Exception as exc:
        logger.warning("Module 3 DB readiness check failed: %s", exc)
        return DatabaseStatus(
            connected=False,
            database_name=settings.DATABASE_NAME,
            message="Shared MongoDB client is currently unreachable.",
        )

