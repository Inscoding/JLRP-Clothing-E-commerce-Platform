from fastapi import Request, HTTPException

async def get_db(request: Request):
    """
    Return motor db attached to app.state by app.main startup.
    Usage: db = Depends(get_db)
    """
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db
