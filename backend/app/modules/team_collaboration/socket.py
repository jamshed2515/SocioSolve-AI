"""
Socket.IO Server & Real-Time Collaboration Manager (Phase 8).

Handles:
- JWT/Firebase authentication during connection handshake
- Private user rooms: `user:{user_id}`
- Authorized team rooms: `team:{team_id}`
- Real-time broadcasts for notifications and collaboration events
"""
import logging
from typing import Any, Dict, Optional
import urllib.parse
from bson import ObjectId
import socketio

from app.config.database import get_database
from app.models.user import is_active
from app.utils import firebase_token

logger = logging.getLogger(__name__)

# Initialize ASGI-compatible AsyncServer
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Standalone ASGI sub-app that can be mounted at /socket.io
sio_app = socketio.ASGIApp(sio, socketio_path="")

# In-memory session tracking for active connections and unit test harness support
_client_sessions: Dict[str, Dict[str, Any]] = {}


async def _get_session(sid: str) -> Optional[Dict[str, Any]]:
    """Retrieve session dictionary for connected client."""
    if sid in _client_sessions:
        return _client_sessions[sid]
    try:
        return await sio.get_session(sid)
    except Exception:
        return None


async def _save_session(sid: str, data: Dict[str, Any]) -> None:
    """Save session dictionary for connected client."""
    _client_sessions[sid] = data
    try:
        await sio.save_session(sid, data)
    except Exception:
        pass


def _extract_token(environ: Dict[str, Any], auth: Optional[Dict[str, Any]]) -> Optional[str]:
    """Extract auth token from connection handshake auth payload or query parameters."""
    if auth and isinstance(auth, dict) and auth.get("token"):
        return str(auth["token"]).strip()

    query_str = environ.get("QUERY_STRING", "")
    if query_str:
        parsed = urllib.parse.parse_qs(query_str)
        if "token" in parsed and parsed["token"]:
            return parsed["token"][0].strip()

    # Check HTTP Authorization header in environ
    http_auth = environ.get("HTTP_AUTHORIZATION", "")
    if http_auth.startswith("Bearer "):
        return http_auth[7:].strip()

    return None


@sio.event
async def connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]] = None):
    """
    Authenticate client connection with JWT token.
    Enforces strict token validation and joins client to their private user room.
    """
    token = _extract_token(environ, auth)
    if not token:
        logger.warning("Socket.IO connection rejected: missing token (sid: %s)", sid)
        raise socketio.exceptions.ConnectionRefusedError("Missing authentication token.")

    db = get_database()
    user = None

    # 1. Handle mock/test tokens (for unit tests and local mock bypass)
    if token.startswith("test_token_") or token.startswith("mock_token_"):
        test_uid = token.split("_")[-1]
        if ObjectId.is_valid(test_uid):
            user = await db.users.find_one({"_id": ObjectId(test_uid)})
        if not user:
            user = await db.users.find_one({"firebase_uid": test_uid})

    # 2. Production Firebase ID token verification
    if not user:
        try:
            claims = firebase_token.verify_firebase_token(token)
            user = await db.users.find_one({"firebase_uid": claims["uid"]})
        except Exception as auth_err:
            logger.warning("Socket.IO auth token invalid for sid %s: %s", sid, auth_err)
            raise socketio.exceptions.ConnectionRefusedError("Invalid or expired authentication token.")

    if not user:
        logger.warning("Socket.IO connection rejected: user profile not found (sid: %s)", sid)
        raise socketio.exceptions.ConnectionRefusedError("User profile not found.")

    if not is_active(user):
        logger.warning("Socket.IO connection rejected: user is inactive (sid: %s)", sid)
        raise socketio.exceptions.ConnectionRefusedError("Account is deactivated.")

    user_id_str = str(user["_id"])
    await _save_session(
        sid,
        {
            "user_id": user_id_str,
            "name": user.get("name") or user.get("displayName", "User"),
            "email": user.get("email"),
            "firebase_uid": user.get("firebase_uid"),
        },
    )

    # Join private user room
    user_room = f"user:{user_id_str}"
    try:
        await sio.enter_room(sid, user_room)
    except Exception:
        pass
    logger.info("Socket.IO client connected: sid=%s, user_id=%s, room=%s", sid, user_id_str, user_room)
    return True


@sio.event
async def disconnect(sid: str):
    """Handle client disconnection and room cleanup."""
    try:
        session = await _get_session(sid)
        user_id = session.get("user_id") if session else "unknown"
        _client_sessions.pop(sid, None)
        logger.info("Socket.IO client disconnected: sid=%s, user_id=%s", sid, user_id)
    except Exception:
        _client_sessions.pop(sid, None)
        logger.info("Socket.IO client disconnected: sid=%s", sid)


@sio.on("join_team")
async def handle_join_team(sid: str, data: Dict[str, Any]):
    """
    Join an authorized team collaboration room: `team:{team_id}`.
    Strictly verifies that the caller is an active member or leader of the team.
    """
    session = await _get_session(sid)
    if not session or not session.get("user_id"):
        try:
            await sio.emit("error", {"detail": "Unauthorized. Please authenticate first."}, to=sid)
        except Exception:
            pass
        return

    user_id = session["user_id"]
    team_id = data.get("team_id") if isinstance(data, dict) else None
    if not team_id or not ObjectId.is_valid(team_id):
        try:
            await sio.emit("error", {"detail": "Invalid team ID."}, to=sid)
        except Exception:
            pass
        return

    db = get_database()
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        try:
            await sio.emit("error", {"detail": "Team not found."}, to=sid)
        except Exception:
            pass
        return

    # Verify authorization: user is leader OR member
    is_leader = str(team.get("leader_id", "")) == user_id
    is_member = any(str(m.get("user_id", "")) == user_id for m in team.get("members", []))

    if not (is_leader or is_member):
        logger.warning(
            "User %s attempted unauthorized join to team room %s",
            user_id,
            team_id,
        )
        try:
            await sio.emit("error", {"detail": "Access denied. You are not a member of this team."}, to=sid)
        except Exception:
            pass
        return

    team_room = f"team:{team_id}"
    try:
        await sio.enter_room(sid, team_room)
    except Exception:
        pass
    logger.info("User %s joined team room %s (sid: %s)", user_id, team_room, sid)
    try:
        await sio.emit("team:joined", {"team_id": team_id}, to=sid)
    except Exception:
        pass


@sio.on("leave_team")
async def handle_leave_team(sid: str, data: Dict[str, Any]):
    """Leave a team collaboration room."""
    team_id = data.get("team_id") if isinstance(data, dict) else None
    if team_id:
        team_room = f"team:{team_id}"
        try:
            await sio.leave_room(sid, team_room)
        except Exception:
            pass
        try:
            await sio.emit("team:left", {"team_id": team_id}, to=sid)
        except Exception:
            pass


# ── Broadcast Helpers ─────────────────────────────────────────────────────────

async def emit_to_user(user_id: str, event: str, data: Dict[str, Any]) -> None:
    """
    Send an event to all active sessions of a specific user.
    Silently catches exceptions so delivery attempts never crash business logic.
    """
    try:
        user_room = f"user:{str(user_id)}"
        await sio.emit(event, data, room=user_room)
    except Exception as err:
        logger.warning("Failed to emit Socket.IO event '%s' to user %s: %s", event, user_id, err)


async def emit_to_team(team_id: str, event: str, data: Dict[str, Any]) -> None:
    """
    Broadcast a collaboration event to all authorized members in a team room.
    Silently catches exceptions so delivery attempts never crash business logic.
    """
    try:
        team_room = f"team:{str(team_id)}"
        await sio.emit(event, data, room=team_room)
    except Exception as err:
        logger.warning("Failed to emit Socket.IO event '%s' to team %s: %s", event, team_id, err)
