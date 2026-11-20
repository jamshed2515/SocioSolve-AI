"""
Service layer for Module 3 – Team Formation & Collaboration.
"""
from app.modules.team_collaboration.services.database_service import (
    check_database_readiness,
    get_collection,
    get_module_database,
)

__all__ = [
    "check_database_readiness",
    "get_collection",
    "get_module_database",
]

