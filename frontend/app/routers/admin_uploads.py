# app/routers/admin_uploads.py
"""
Admin image upload router (Cloudinary version).
TEMP: upload endpoints do NOT require auth (for development).
- Uses Cloudinary to store images (no local disk storage).
- Validates mime/extension/size.
- Persists metadata into `images` collection in MongoDB.
"""

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    HTTPException,
    status,
    Request,
    Query,
)
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
import os
import uuid

from app.dependencies.db import get_db
from app.dependencies.auth import get_current_admin  # still used for list/delete

from bson import ObjectId
from bson.errors import InvalidId

import cloudinary
from cloudinary.uploader import upload as cloudinary_upload, destroy as cloudinary_destroy

# ---------- Cloudinary config ----------
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

CLOUDINARY_UPLOAD_FOLDER = os.getenv("CLOUDINARY_UPLOAD_FOLDER", "jlrp/products")

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXT = {"jpeg", "jpg", "png", "gif", "webp"}

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


def _objectid_to_str(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    return value


def _normalize_doc_for_json(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, dict):
            nested = {}
            for nk, nv in v.items():
                nested[nk] = str(nv) if isinstance(nv, ObjectId) else nv
            out[k] = nested
        else:
            out[k] = v
    return out


async def _upload_single_file_to_cloudinary(
    file: UploadFile,
    db,
    current_admin: Any | None = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
) -> UploadResponse:
    # Normalize title/description
    title = title.strip() if isinstance(title, str) and title.strip() != "" else None
    description = (
        description.strip()
        if isinstance(description, str) and description.strip() != ""
        else None
    )

    # 1) content-type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed",
        )

    # 2) extension
    if not is_allowed_extension(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension",
        )

    # 3) read file for size + upload
    contents = await file.read()
    size = len(contents)
    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file uploaded"
        )
    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max allowed: {MAX_FILE_SIZE} bytes",
        )

    # 4) upload to Cloudinary
    try:
        unique_suffix = uuid.uuid4().hex[:8]
        public_id_prefix = os.path.splitext(file.filename)[0].replace(" ", "_")
        result = cloudinary_upload(
            contents,
            folder=CLOUDINARY_UPLOAD_FOLDER,
            public_id=f"{public_id_prefix}_{unique_suffix}",
            resource_type="image",
        )
    except Exception as e:
        print("Cloudinary upload error:", repr(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload image {file.filename}",
        )

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    format_ = result.get("format")
    bytes_ = result.get("bytes", size)
    original_filename = (
        result.get("original_filename") or file.filename or "uploaded_image"
    )

    if not secure_url or not public_id:
        raise HTTPException(
            status_code=500,
            detail="Cloudinary did not return URL or public_id",
        )

    # 5) uploaded_by (TEMP: no auth)
    if isinstance(current_admin, dict):
        uploaded_by = (
            str(current_admin.get("_id"))
            if current_admin.get("_id") is not None
            else current_admin.get("email")
        )
    elif current_admin is None:
        uploaded_by = "dev-admin"  # temp fallback for development
    else:
        uploaded_by = str(current_admin)

    now = datetime.utcnow()

    saved_doc = {
        "filename": original_filename,
        "public_id": public_id,
        "url": secure_url,
        "content_type": file.content_type,
        "size": bytes_,
        "format": format_,
        "title": title,
        "description": description,
        "uploaded_by": uploaded_by,
        "uploaded_at": now,
        "cloudinary_raw": {
            "asset_id": result.get("asset_id"),
            "version": result.get("version"),
        },
    }

    result_insert = await db.get_collection("images").insert_one(saved_doc)
    saved_doc["_id"] = str(result_insert.inserted_id)

    try:
        await file.close()
    except Exception:
        pass

    return UploadResponse(
        _id=saved_doc["_id"],
        filename=original_filename,
        url=secure_url,
        content_type=file.content_type,
        size=bytes_,
        uploaded_at=now,
        title=title,
        description=description,
    )


@router.post("/upload-image", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    description: Optional[str] = None,
    db=Depends(get_db),
    # current_admin=Depends(get_current_admin),  # TEMP disabled
):
    """
    Upload a single image to Cloudinary and save metadata in `images` collection.
    TEMP: no auth for development.
    """
    return await _upload_single_file_to_cloudinary(
        file=file,
        db=db,
        current_admin=None,
        title=title,
        description=description,
    )


@router.post("/uploads/images")
async def upload_product_images(
    files: List[UploadFile] = File(...),
    db=Depends(get_db),
    # current_admin=Depends(get_current_admin),  # TEMP disabled
):
    """
    Upload one or more product images to Cloudinary.
    Returns list of secure URLs. Also stores each in the `images` collection.
    TEMP: no auth for development.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    uploaded_urls: List[str] = []

    for f in files:
        resp = await _upload_single_file_to_cloudinary(
            file=f,
            db=db,
            current_admin=None,
            title=None,
            description=None,
        )
        uploaded_urls.append(resp.url)

    return {"urls": uploaded_urls}


@router.get("/images")
async def list_images(
    db=Depends(get_db),
    current_admin=Depends(get_current_admin),  # list still protected
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
        query["title"] = {"$regex": q, "$options": "i"}

    cursor = coll.find(query).sort("uploaded_at", -1).skip(skip).limit(limit)
    items: List[dict] = []
    async for doc in cursor:
        norm = _normalize_doc_for_json(doc)
        norm["_id"] = str(doc.get("_id"))
        items.append(norm)

    total = await coll.count_documents(query)
    return {
        "items": items,
        "count": len(items),
        "total": total,
        "limit": limit,
        "skip": skip,
    }


@router.delete("/image/{image_id}")
async def delete_image(
    image_id: str,
    db=Depends(get_db),
    current_admin=Depends(get_current_admin),  # delete still protected
):
    """
    Delete image document and remove the asset from Cloudinary.
    Only admins can call this.
    """
    try:
        oid = ObjectId(image_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid image id")

    coll = db.get_collection("images")
    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Image not found")

    public_id = doc.get("public_id")

    # 1) Remove from Cloudinary
    if public_id:
        try:
            cloudinary_destroy(public_id, invalidate=True)
        except Exception as e:
            print("[delete_image] Cloudinary destroy failed:", repr(e))

    # 2) Remove from DB
    await coll.delete_one({"_id": oid})
    return {"ok": True, "deleted_id": image_id}
