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
    logger.info("✅ Database indexes created.")


def get_database():
    """Return the active database instance."""
    return db
