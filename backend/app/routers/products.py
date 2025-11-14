"""
products.py

Products router for JLRP:
- Men/Women validation
- Category + subcategory validation
- Price validation
- Image upload handling (saves to uploads/)
- Create / Update / Delete / List / Fetch
- Uses shared products_collection if injected by app.main, with local fallback
- JWT admin dependency protects admin endpoints (is_admin claim required)
- Deletes product images from uploads/ when a product is deleted
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal, Any, Dict
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from jose import jwt, JWTError
import os
import shutil
import uuid
import datetime
import urllib.parse

# ----------------------
# Configuration (env or defaults)
# ----------------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "jlrp")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")  # relative to project root
SITE_URL = os.getenv("SITE_URL", "http://localhost:8000")  # for building absolute image URLs
MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", 5 * 1024 * 1024))  # 5 MB default
ALLOWED_IMAGE_MIMES = ("image/jpeg", "image/png", "image/webp")

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ----------------------
# Allowed taxonomy
# ----------------------
GENDERS = ("men", "women")

ALLOWED_CATEGORIES: Dict[str, List[str]] = {
    "clothing": ["tshirt", "jeans", "kurti", "saree", "jacket", "shirt", "trouser", "shorts", "kurta"],
}

for k in list(ALLOWED_CATEGORIES.keys()):
    ALLOWED_CATEGORIES[k] = [s.lower() for s in ALLOWED_CATEGORIES[k]]

# ----------------------
# Collection placeholder
# ----------------------
# app.main should inject app.state.db.get_collection("products") into this variable at startup.
# If not injected, we create a local client on demand (fallback for testing).
products_collection = None  # type: ignore

_local_client: Optional[AsyncIOMotorClient] = None


def _init_local_client_if_needed():
    """
    Fallback: create a local motor client (used only if main app didn't inject a collection).
    """
    global _local_client, products_collection
    if products_collection is None:
        _local_client = AsyncIOMotorClient(MONGO_URI)
        db = _local_client[DB_NAME]
        products_collection = db.get_collection("products")
    return products_collection


# ----------------------
# Pydantic + helpers
# ----------------------
class ProductBase(BaseModel):
    title: str = Field(..., min_length=1)
    gender: Literal["men", "women"] = Field(..., description="men or women")
    category: str = Field(..., description="Primary category, e.g. clothing")
    subcategory: str = Field(..., description="tshirt, jeans, kurti, saree, etc.")
    price: float = Field(..., ge=0)
    description: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    available: bool = True
    created_at: Optional[datetime.datetime] = None

    @validator("category")
    def validate_category(cls, v):
        v_norm = v.strip().lower()
        if v_norm not in ALLOWED_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(ALLOWED_CATEGORIES.keys())}")
        return v_norm

    @validator("subcategory")
    def validate_subcategory(cls, v, values):
        v_norm = v.strip().lower()
        category = values.get("category")
        if category:
            allowed = ALLOWED_CATEGORIES.get(category)
            if not allowed or v_norm not in allowed:
                raise ValueError(f"subcategory must be one of: {', '.join(allowed or [])}")
        return v_norm


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    title: Optional[str]
    gender: Optional[Literal["men", "women"]]
    category: Optional[str]
    subcategory: Optional[str]
    price: Optional[float]
    description: Optional[str]
    images: Optional[List[str]]
    available: Optional[bool]

    @validator("category")
    def validate_category_update(cls, v):
        if v is None:
            return v
        v_norm = v.strip().lower()
        if v_norm not in ALLOWED_CATEGORIES:
            raise ValueError(f"category must be one of: {', '.join(ALLOWED_CATEGORIES.keys())}")
        return v_norm

    @validator("subcategory")
    def validate_subcategory_update(cls, v, values):
        if v is None:
            return v
        v_norm = v.strip().lower()
        category = values.get("category")
        if category:
            allowed = ALLOWED_CATEGORIES.get(category)
            if not allowed or v_norm not in allowed:
                raise ValueError(f"subcategory must be one of: {', '.join(allowed or [])}")
        return v_norm


class ProductInDB(ProductBase):
    id: str = Field(..., alias="_id")

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: lambda oid: str(oid), datetime.datetime: lambda dt: dt.isoformat()},
    }


# ----------------------
# Router
# ----------------------
router = APIRouter(prefix="/products", tags=["products"])

# ---------- JWT admin dependency ----------
security = HTTPBearer(auto_error=False)
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


async def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Protects admin endpoints. Expects header: Authorization: Bearer <token>
    Token must include claim: is_admin: True
    Returns token payload if valid.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid auth token")

    if not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    return payload


# ----------------------
# file helpers
# ----------------------
def _is_allowed_image(upload: UploadFile) -> bool:
    if upload.content_type not in ALLOWED_IMAGE_MIMES:
        return False
    return True


def save_upload_file(upload_file: UploadFile, dest_folder: str = UPLOAD_DIR) -> str:
    # basic size check
    upload_file.file.seek(0, os.SEEK_END)
    size = upload_file.file.tell()
    upload_file.file.seek(0)
    if size > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_IMAGE_SIZE_BYTES} bytes")
    if not _is_allowed_image(upload_file):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {upload_file.content_type}")

    ext = os.path.splitext(upload_file.filename)[1] or ""
    filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(dest_folder, filename)
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(upload_file.file, f)
    return filename


def _delete_file_by_url(url: str):
    """
    Given a URL like http://host/uploads/<filename> or /uploads/<filename>,
    delete the corresponding file from UPLOAD_DIR if it exists.
    """
    if not url:
        return
    parsed = urllib.parse.urlparse(url)
    path = parsed.path  # e.g. /uploads/<filename>
    if path.startswith(f"/{UPLOAD_DIR}/"):
        filename = path[len(f"/{UPLOAD_DIR}/") :]
    elif path.startswith(UPLOAD_DIR + "/"):
        filename = path[len(UPLOAD_DIR + "/") :]
    else:
        # try last part
        filename = os.path.basename(path)
    if filename:
        local = os.path.join(UPLOAD_DIR, filename)
        try:
            if os.path.exists(local):
                os.remove(local)
        except Exception:
            # swallow errors — deletion is best-effort
            pass


# ----------------------
# Endpoints
# ----------------------
@router.post("/", response_model=ProductInDB, status_code=status.HTTP_201_CREATED)
async def create_product(payload: ProductCreate, _=Depends(require_admin)):
    global products_collection
    if products_collection is None:
        _init_local_client_if_needed()
    doc = payload.dict()
    doc["created_at"] = datetime.datetime.utcnow()
    res = await products_collection.insert_one(doc)
    created = await products_collection.find_one({"_id": res.inserted_id})
    if not created:
        raise HTTPException(500, "Failed to create product")
    created["_id"] = str(created["_id"])
    return created


@router.post("/create-with-images", status_code=status.HTTP_201_CREATED)
async def create_product_with_images(
    title: str = Form(...),
    gender: str = Form(...),
    category: str = Form(...),
    subcategory: str = Form(...),
    price: float = Form(...),
    description: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    _=Depends(require_admin),
):
    images_urls: List[str] = []
    if files:
        for f in files:
            filename = save_upload_file(f)
            url = f"{SITE_URL}/{UPLOAD_DIR}/{filename}"
            images_urls.append(url)

    payload = ProductCreate(
        title=title,
        gender=gender,
        category=category,
        subcategory=subcategory,
        price=price,
        description=description,
        images=images_urls,
        available=True,
    )
    return await create_product(payload)


@router.post("/upload-image", status_code=201)
async def upload_image(file: UploadFile = File(...), _=Depends(require_admin)):
    filename = save_upload_file(file)
    url = f"{SITE_URL}/{UPLOAD_DIR}/{filename}"
    return {"filename": filename, "url": url}


@router.get("/", response_model=List[ProductInDB])
async def list_products(
    gender: Optional[str] = None,
    subcategory: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    skip: int = 0,
    limit: int = 25,
    sort_by: str = "created_at",
    sort_dir: int = -1,
):
    global products_collection
    if products_collection is None:
        _init_local_client_if_needed()

    query: Dict[str, Any] = {}
    if gender:
        g = gender.strip().lower()
        if g not in GENDERS:
            raise HTTPException(400, detail="gender must be 'men' or 'women'")
        query["gender"] = g
    if subcategory:
        query["subcategory"] = subcategory.strip().lower()
    if min_price is not None or max_price is not None:
        price_q: Dict[str, Any] = {}
        if min_price is not None:
            price_q["$gte"] = min_price
        if max_price is not None:
            price_q["$lte"] = max_price
        query["price"] = price_q

    cursor = products_collection.find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
    items: List[Dict[str, Any]] = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return items


@router.get("/{product_id}", response_model=ProductInDB)
async def get_product(product_id: str):
    global products_collection
    if products_collection is None:
        _init_local_client_if_needed()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(400, "Invalid product id")
    doc = await products_collection.find_one({"_id": ObjectId(product_id)})
    if not doc:
        raise HTTPException(404, "Product not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.put("/{product_id}", response_model=ProductInDB)
async def update_product(product_id: str, payload: ProductUpdate, _=Depends(require_admin)):
    global products_collection
    if products_collection is None:
        _init_local_client_if_needed()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(400, "Invalid product id")
    update_doc = {k: v for k, v in payload.dict().items() if v is not None}
    # If category/subcategory provided, validate subcategory membership
    if "category" in update_doc and "subcategory" in update_doc:
        cat = update_doc["category"]
        sub = update_doc["subcategory"]
        allowed = ALLOWED_CATEGORIES.get(cat)
        if not allowed or sub not in allowed:
            raise HTTPException(400, detail=f"subcategory must be one of: {', '.join(allowed or [])}")

    if not update_doc:
        raise HTTPException(400, "No fields to update")
    await products_collection.update_one({"_id": ObjectId(product_id)}, {"$set": update_doc})
    doc = await products_collection.find_one({"_id": ObjectId(product_id)})
    doc["_id"] = str(doc["_id"])
    return doc


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, _=Depends(require_admin)):
    """
    Delete product document and remove associated image files from uploads/ (best-effort).
    """
    global products_collection
    if products_collection is None:
        _init_local_client_if_needed()
    if not ObjectId.is_valid(product_id):
        raise HTTPException(400, "Invalid product id")

    # fetch document first to find images
    doc = await products_collection.find_one({"_id": ObjectId(product_id)})
    if not doc:
        raise HTTPException(404, "Product not found")

    images = doc.get("images", []) or []
    # attempt to delete files
    for img in images:
        try:
            _delete_file_by_url(img)
        except Exception:
            pass

    res = await products_collection.delete_one({"_id": ObjectId(product_id)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return JSONResponse(status_code=204, content=None)


# ----------------------
# Index creation helper
# ----------------------
async def ensure_indexes():
    global products_collection
    if products_collection is None:
        _init_local_client_if_needed()
    await products_collection.create_index([("gender", 1), ("subcategory", 1)])
    await products_collection.create_index("price")
    await products_collection.create_index("created_at")
    await products_collection.create_index([("title", "text"), ("description", "text")])


# ----------------------
# Minimal main app (for quick testing)
# ----------------------
app = FastAPI(title="Products Service (demo)")
app.include_router(router)
app.mount(f"/{UPLOAD_DIR}", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup_event():
    # ensure indexes if this module is run standalone
    try:
        await ensure_indexes()
    except Exception as e:
        print("Index creation failed:", e)
