from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import os

from app.config.settings import settings
from app.config.database import connect_to_mongo, close_mongo_connection
from app.routes.auth_routes import router as auth_router
from app.routes.user_routes import router as user_router
from app.routes.proposal_routes import router as proposal_router

limiter = Limiter(key_func=get_remote_address)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting SocioSolve-AI backend...")
    await connect_to_mongo()

    # Ensure upload directory exists
    os.makedirs("uploads/avatars", exist_ok=True)
    os.makedirs("uploads/proposals", exist_ok=True)

    yield

    logger.info("🛑 Shutting down SocioSolve-AI backend...")
    await close_mongo_connection()


# ── App instance ────────────────────────────────────────────────────────────
app = FastAPI(
    title="SocioSolve-AI API",
    description="Authentication & User Management – Module 1 | Solution Proposals & Evaluation – Module 4",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (uploaded avatars & proposal documents) ───────────────────
os.makedirs("uploads/avatars", exist_ok=True)
os.makedirs("uploads/proposals", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(user_router, prefix="/api/users", tags=["Users"])
app.include_router(proposal_router, prefix="/api/proposals", tags=["Module 4 - Proposals & Evaluation"])


# ── Root health check ───────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.APP_NAME,
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
