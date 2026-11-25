"""
Lightweight WebSocket connection manager for Module 4 real-time proposal notifications.
Reuses FastAPI/Starlette WebSockets without adding external frameworks.
"""
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ProposalNotificationWSManager:
    """Tracks active WebSocket connections keyed by MongoDB user ID."""

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)
        logger.debug("WebSocket connected for user %s (active=%d)", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, payload: Dict[str, Any]) -> None:
        sockets = list(self._connections.get(str(user_id), ()))
        if not sockets:
            return
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(str(user_id), ws)


proposal_ws_manager = ProposalNotificationWSManager()
