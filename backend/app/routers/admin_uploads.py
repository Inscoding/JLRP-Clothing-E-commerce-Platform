# app/routers/admin_uploads.py
"""
Admin image upload router (async + DB + auth).
- Uses aiofiles to save files (async-friendly).
- Validates mime/extension/size and uses imghdr to confirm actual image type.
- Persists metadata into `images` collection in MongoDB.
- Protected by get_current_admin dependency (JWT).
- Adds listing and delete endpoints for admin management.
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Request, Query
from pydantic import BaseModel
from typing import Optional, List, Any
import os
import uuid
import imghdr
from datetime import datetime
import aiofiles

from app.dependencies.db import get_db
from app.dependencies.auth import get_current_admin

# bson for ObjectId handling
from bson import ObjectId
from bson.errors import InvalidId

UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXT = {"jpeg", "jpg", "png", "gif", "webp"}

os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/admin", tags=["admin"])


class UploadResponse(BaseModel):
    _id: Optional[str]
    filename: str
    url: str
    content_type: str
    size: int
    uploaded_at: datetime
    title: Optional[str] = None
    description: Optional[str] = None


def is_allowed_extension(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    return ext in ALLOWED_EXT


def generate_filename(original_filename: str) -> str:
    ext = os.path.splitext(original_filename)[1].lower()
    if ext == "":
        ext = ".jpg"
    return f"{uuid.uuid4().hex}{ext}"


async def save_file_aio(upload_file: UploadFile, destination: str) -> int:
    # rewind in case someone already read the file
    await upload_file.seek(0)
    async with aiofiles.open(destination, "wb") as out_file:
        while True:
            chunk = await upload_file.read(1024 * 1024)
            if not chunk:
                break
            await out_file.write(chunk)
    try:
        await upload_file.close()
    except Exception:
        pass
    return os.path.getsize(destination)


def _objectid_to_str(value: Any) -> Any:
    """Convert ObjectId to string, leave other values unchanged."""
    if isinstance(value, ObjectId):
        return str(value)
    return value


def _normalize_doc_for_json(doc: dict) -> dict:
    """
    Convert ObjectId fields to strings and prepare doc for JSON response.
    This mutates a shallow copy and returns it.
    """
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, dict):
            # shallow convert nested ObjectIds at one level
            nested = {}
            for nk, nv in v.items():
                nested[nk] = str(nv) if isinstance(nv, ObjectId) else nv
            out[k] = nested
        else:
            out[k] = v
    return out


@router.post("/upload-image", response_model=UploadResponse)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = None,
    description: Optional[str] = None,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    # Normalize title/description: treat empty strings as None
    title = title.strip() if isinstance(title, str) and title.strip() != "" else None
    description = description.strip() if isinstance(description, str) and description.strip() != "" else None

    # 1) Basic content-type check
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are allowed")

    # 2) Extension check
    if not is_allowed_extension(file.filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file extension")

    # 3) Save with a unique name
    generated_name = generate_filename(file.filename)
    dest_path = os.path.join(UPLOAD_DIR, generated_name)

    size = await save_file_aio(file, dest_path)

    # 4) Size limit enforcement
    if size > MAX_FILE_SIZE:
        try:
            os.remove(dest_path)
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File too large. Max allowed: {MAX_FILE_SIZE} bytes")

    # 5) Verify actual image file type using imghdr
    detected = imghdr.what(dest_path)
    if detected is None:
        try:
            os.remove(dest_path)
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is not a valid image")

    # 6) Build public URL (uses request.base_url)
    base = str(request.base_url).rstrip("/")
    file_url = f"{base}/uploads/{generated_name}"

    # 7) Persist metadata to DB
    # ensure uploaded_by is stored as a string (either email or stringified id)
    uploaded_by = None
    if isinstance(current_admin, dict):
        # prefer to store string id if present, else email
        uploaded_by = str(current_admin.get("_id")) if current_admin.get("_id") is not None else current_admin.get("email")
    else:
        uploaded_by = str(current_admin)

    saved_doc = {
        "filename": generated_name,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": size,
        "title": title,
        "description": description,
        "uploaded_by": uploaded_by,
        "uploaded_at": datetime.utcnow(),
        "url": file_url,
    }

    # Insert into images collection
    result = await db.get_collection("images").insert_one(saved_doc)
    saved_doc["_id"] = str(result.inserted_id)

    response = UploadResponse(
        _id=saved_doc["_id"],
        filename=generated_name,
        url=file_url,
        content_type=file.content_type,
        size=size,
        uploaded_at=saved_doc["uploaded_at"],
        title=title,
        description=description,
    )
    return response


@router.get("/images")
async def list_images(
    db=Depends(get_db),
    current_admin=Depends(get_current_admin),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    q: Optional[str] = Query(None, description="Optional text to search in title"),
):
    """
    Return a paginated list of images (most recent first).
    Optional `q` will fuzzy-search the title (case-insensitive substring).
    """
    coll = db.get_collection("images")
    query = {}
    if q:
        # case-insensitive substring match on title
        query["title"] = {"$regex": q, "$options": "i"}

    cursor = coll.find(query).sort("uploaded_at", -1).skip(skip).limit(limit)
    items: List[dict] = []
    async for doc in cursor:
        # normalize ObjectId and other non-jsonable fields
        norm = _normalize_doc_for_json(doc)
        # ensure _id is string (in case normalization missed it)
        norm["_id"] = str(doc.get("_id"))
        items.append(norm)

    # total count for this query (could be expensive for large collections; consider caching)
    total = await coll.count_documents(query)
    return {"items": items, "count": len(items), "total": total, "limit": limit, "skip": skip}


@router.delete("/image/{image_id}")
async def delete_image(
    image_id: str,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin),
):
    """
    Delete image document and remove the file from disk.
    Only admins can call this.
    """
    # validate ObjectId
    try:
        oid = ObjectId(image_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid image id")

    coll = db.get_collection("images")
    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")

    # remove file from disk if present
    filename = doc.get("filename")
    if filename:
        path = os.path.join(UPLOAD_DIR, filename)
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            # log error but continue to remove DB doc
            print("[delete_image] failed to remove file", path, e)

    # remove DB doc
    await coll.delete_one({"_id": oid})
    return {"ok": True, "deleted_id": image_id}
