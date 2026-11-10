from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
import logging

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None
db = None


async def connect_to_mongo():
    """Create MongoDB Atlas connection on startup."""
    global client, db
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.DATABASE_NAME]

        # Verify connection
        await client.admin.command("ping")
        logger.info(f"✅ Connected to MongoDB Atlas – database: '{settings.DATABASE_NAME}'")

        # Create indexes
        await create_indexes()
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        raise e


async def close_mongo_connection():
    """Close MongoDB connection on shutdown."""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")


async def create_indexes():
    """Create required database indexes."""
    # Unique email index
    await db.users.create_index("email", unique=True)
    # Index for password reset tokens
    await db.users.create_index("reset_token")
    # Index for refresh tokens
    await db.refresh_tokens.create_index("token")
    await db.refresh_tokens.create_index(
        "expires_at", expireAfterSeconds=0
    )  # TTL index – auto-delete expired tokens

    # ── Module 6: Industry Partnerships ───────────────────────────────────
    await db.partnerships.create_index([("status", 1), ("type", 1)])
    await db.partnerships.create_index("industryUserId")
    await db.partnerships.create_index([("createdAt", -1)])

    # Application indexes
    # NOTE FOR MODULE 3 INTEGRATION:
    # Unique compound index on (partnershipId, applicantUserId) is currently enforced at the student level
    # as a temporary solution while Module 3 (Team Formation) is pending development.
    # When Module 3 is integrated, upgrade this index to (partnershipId, teamId).
    await db.partnership_applications.create_index(
        [("partnershipId", 1), ("applicantUserId", 1)],
        unique=True
    )
    await db.partnership_applications.create_index("partnershipId")
    await db.partnership_applications.create_index("applicantUserId")
    await db.partnership_applications.create_index("status")
    logger.info("✅ Database indexes created.")


def get_database():
    """Return the active database instance."""
    return db
