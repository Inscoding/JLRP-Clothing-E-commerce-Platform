# inspect_user.py
import asyncio
from app.db import get_client

async def inspect(email="test@example.com"):
    db = get_client()
    user = await db["users"].find_one({"email": email})
    print("\nUSER RECORD:")
    print(user)

if __name__ == "__main__":
    asyncio.run(inspect())
