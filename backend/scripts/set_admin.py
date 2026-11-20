"""
Trusted administrative process: grant (or revoke) the admin role.

Run on the server with backend credentials (never exposed via an API):
    python -m scripts.set_admin someone@example.com          # grant admin
    python -m scripts.set_admin someone@example.com --revoke # back to citizen

The person must have signed in once so their Firebase account exists.
"""
import argparse
import asyncio
from datetime import datetime, timezone

from firebase_admin import auth as fb_auth

from app.config import database
from app.config.firebase import init_firebase
from app.models.user import new_user_document, UserRole


async def main(email: str, revoke: bool) -> None:
    init_firebase()
    await database.connect_to_mongo()
    db = database.get_database()
    fb_user = fb_auth.get_user_by_email(email)
    now = datetime.now(timezone.utc)
    role = UserRole.CITIZEN if revoke else UserRole.ADMIN

    existing = await db.users.find_one({"firebase_uid": fb_user.uid})
    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"role": role.value, "approval_status": "approved", "is_active": True, "updated_at": now}},
        )
    else:
        doc = new_user_document(
            fb_user.uid, fb_user.email, fb_user.display_name or email.split("@")[0],
            role, fb_user.email_verified,
        )
        await db.users.insert_one(doc)

    # Force re-login so the new privileges are picked up cleanly
    fb_auth.revoke_refresh_tokens(fb_user.uid)
    print(f"{email} -> role={role.value}")
    await database.close_mongo_connection()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("email")
    p.add_argument("--revoke", action="store_true")
    a = p.parse_args()
    asyncio.run(main(a.email, a.revoke))
