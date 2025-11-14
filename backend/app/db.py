# app/db.py
import os
from typing import Optional
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorDatabase,
    AsyncIOMotorCollection,
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB", "jlrp")

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def get_client() -> AsyncIOMotorDatabase:
    """
    Return the AsyncIOMotorDatabase instance.
    Lazily create the Motor client and database object.
    """
    global _client, _db
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
        _db = _client[DB_NAME]
    return _db


async def close_client() -> None:
    """Close the Motor client on shutdown."""
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None


def get_users_collection() -> AsyncIOMotorCollection:
    """
    Return the users collection (AsyncIOMotorCollection).
    Uses the same lazy DB client defined above.
    """
    db = get_client()
    return db["users"]


# Exported module-level collection so other modules can do:
# from app.db import users_collection
# This will initialize the client lazily (via get_client) when the module is imported.
users_collection: AsyncIOMotorCollection = get_users_collection()
