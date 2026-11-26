from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config.settings import settings
from app.config.database import connect_to_mongo, close_mongo_connection
from app.config.firebase import init_firebase
from app.routes.auth_routes import router as auth_router
from app.routes.user_routes import router as user_router
from app.routes.challenge_routes import router as challenge_router
from app.routes.proposal_routes import router as proposal_router
from app.modules.team_collaboration.router import router as team_collaboration_router
from app.modules.team_collaboration.routers.join_request_router import router as join_request_router
from app.routes.admin_routes import router as admin_router
from app.routes.dashboard_routes import router as dashboard_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
os.makedirs("uploads/avatars", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SocioSolve-AI backend...")
    init_firebase()
    await connect_to_mongo()

    # Ensure upload directories exist
    os.makedirs("uploads/avatars", exist_ok=True)
    os.makedirs("uploads/proposals", exist_ok=True)
    os.makedirs("uploads/challenges", exist_ok=True)

    yield
    await close_mongo_connection()


app = FastAPI(
    title="SocioSolve-AI API",
    description="Authentication & User Management – Module 1 | Team Formation & Collaboration – Module 3 | Solution Proposals & Evaluation – Module 4",
    version="2.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Bearer tokens & cross-origin frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list or ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (uploaded avatars & proposal documents) ───────────────────
os.makedirs("uploads/avatars", exist_ok=True)
os.makedirs("uploads/proposals", exist_ok=True)
os.makedirs("uploads/challenges", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user_router, prefix="/api/users", tags=["Users"])
app.include_router(
    challenge_router,
    prefix="/api/challenges",
    tags=["Module 2 – Societal Challenges"],
)
app.include_router(
    team_collaboration_router,
    prefix="/api/teams",
    tags=["Module 3 – Teams"],
)
app.include_router(
    team_collaboration_router,
    prefix="/api/team-collaboration",
    tags=["Module 3 – Team Collaboration"],
)
app.include_router(
    join_request_router,
    prefix="/api/join-requests",
    tags=["Module 3 – Join Requests"],
)
app.include_router(
    proposal_router,
    prefix="/api/proposals",
    tags=["Module 4 - Proposals & Evaluation"],
)
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboards"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])


@app.get("/", tags=["Health"])
async def root():
    return {"app": settings.APP_NAME, "status": "running", "docs": "/docs"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
