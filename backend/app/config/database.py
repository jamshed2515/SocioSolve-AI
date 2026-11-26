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
        client = AsyncIOMotorClient(settings.mongodb_uri)
        db = client[settings.DATABASE_NAME]
        await client.admin.command("ping")
        logger.info("Connected to MongoDB - database: '%s'", settings.DATABASE_NAME)
        await create_indexes()
    except Exception as e:
        logger.error("MongoDB connection failed: %s", e)
        raise


async def close_mongo_connection():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")


async def create_indexes():
    """Create required database indexes."""
    # One MongoDB profile per Firebase account (partial: ignores legacy docs without a uid)
    await db.users.create_index(
        "firebase_uid",
        unique=True,
        partialFilterExpression={"firebase_uid": {"$type": "string"}},
    )
    await db.users.create_index("email", unique=True)
    await db.users.create_index([("role", 1), ("approval_status", 1)])
    # Index for password reset tokens
    await db.users.create_index("reset_token")
    # Index for refresh tokens
    await db.refresh_tokens.create_index("token")
    await db.refresh_tokens.create_index(
        "expires_at", expireAfterSeconds=0
    )  # TTL index – auto-delete expired tokens

    # Module 4 – Proposals, Reviews & Status History indexes
    await db.proposals.create_index("proposalCode", unique=True)
    await db.proposals.create_index("challengeId")
    await db.proposals.create_index("authorId")
    await db.proposals.create_index("status")
    await db.proposals.create_index("createdAt")
    await db.proposal_reviews.create_index([("proposalId", 1), ("reviewerId", 1)], unique=True)
    await db.proposal_status_history.create_index([("proposalId", 1), ("timestamp", 1)])
    await db.notifications.create_index([("userId", 1), ("createdAt", -1)])

    # Module 2 – Societal Challenges indexes
    await db.challenges.create_index([("title", "text"), ("description", "text")])
    await db.challenges.create_index("category")
    await db.challenges.create_index("status")
    await db.challenges.create_index("authorId")
    await db.challenges.create_index([("status", 1), ("createdAt", -1)])
    logger.info("✅ Database indexes created.")


def get_database():
    """Return the active database instance."""
    return db
