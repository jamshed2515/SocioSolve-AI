"""
Test fixtures: in-memory fake MongoDB + mocked Firebase token verification.
No network, no real Firebase project or Atlas cluster required.
"""
import copy
import os
import sys

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient  # noqa: E402
from firebase_admin import auth as fb_auth  # noqa: E402

from app.config import database  # noqa: E402
from app.main import app  # noqa: E402
from app.utils import firebase_token  # noqa: E402


def _match(doc, flt):
    return all(doc.get(k) == v for k, v in flt.items())


class _Cursor:
    def __init__(self, docs):
        self._docs = docs

    def limit(self, n):
        return _Cursor(self._docs[:n])

    def __aiter__(self):
        self._it = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return copy.deepcopy(next(self._it))
        except StopIteration:
            raise StopAsyncIteration


class FakeCollection:
    unique = ("firebase_uid", "email")

    def __init__(self):
        self.docs = []

    async def find_one(self, flt):
        for d in self.docs:
            if _match(d, flt):
                return copy.deepcopy(d)
        return None

    def find(self, flt):
        return _Cursor([d for d in self.docs if _match(d, flt)])

    async def insert_one(self, doc):
        for key in self.unique:
            if doc.get(key) and any(d.get(key) == doc[key] for d in self.docs):
                raise DuplicateKeyError(f"dup {key}")
        doc = copy.deepcopy(doc)
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)

        class R:
            inserted_id = doc["_id"]
        return R()

    async def update_one(self, flt, update):
        for d in self.docs:
            if _match(d, flt):
                d.update(update.get("$set", {}))
                for k in update.get("$unset", {}):
                    d.pop(k, None)
                return


class FakeDB:
    def __init__(self):
        self.users = FakeCollection()


TOKENS = {}  # token string -> claims


def make_claims(uid, email, provider="password", verified=True, auth_time=None, **extra):
    import time
    return {
        "uid": uid, "sub": uid, "email": email, "email_verified": verified,
        "auth_time": auth_time or int(time.time()),
        "firebase": {"sign_in_provider": provider}, **extra,
    }


def fake_verify(token):
    if token == "expired":
        raise HTTPException(401, "Authentication token expired.")
    if token == "revoked":
        raise HTTPException(401, "Authentication token revoked. Please sign in again.")
    if token not in TOKENS:
        raise HTTPException(401, "Invalid authentication token.")
    return TOKENS[token]


@pytest.fixture
def db(monkeypatch):
    fake = FakeDB()
    monkeypatch.setattr(database, "db", fake)
    monkeypatch.setattr(firebase_token, "verify_firebase_token", fake_verify)
    monkeypatch.setattr(fb_auth, "revoke_refresh_tokens", lambda uid: None)
    monkeypatch.setattr(fb_auth, "update_user", lambda uid, **kw: None)
    TOKENS.clear()
    return fake


@pytest.fixture
def client(db):
    return TestClient(app)


def auth(token):
    return {"Authorization": f"Bearer {token}"}
