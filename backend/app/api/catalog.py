from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.app.core.database import get_db
from backend.app.models.models import Product, Clip, Alias, User
from backend.app.services.catalog.service import catalog_service
from backend.app.services.storage.local import LocalStorageProvider
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/catalog", tags=["catalog"])
local_storage = LocalStorageProvider()

class ProductItem(BaseModel):
    id: int
    name: str
    category: str
    folder_path: str
    commission_rate: float
    margin_rate: float
    target_demographic: Optional[str] = None
    active: bool
    clip_count: int = 0
    usable_duration: float = 0.0

class ProductDetail(ProductItem):
    hook_ideas: Optional[str] = None
    clips: List[dict] = []
    aliases: List[dict] = []

class CreateProductRequest(BaseModel):
    name: str
    category: str = "General"
    commission_rate: float = 0.15
    margin_rate: float = 0.35
    target_demographic: Optional[str] = None

class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    commission_rate: Optional[float] = None
    margin_rate: Optional[float] = None
    target_demographic: Optional[str] = None
    active: Optional[bool] = None
    hook_ideas: Optional[str] = None

@router.get("/products", response_model=List[ProductItem])
async def list_products(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Product).order_by(Product.name)
    products = (await db.execute(stmt)).scalars().all()

    results: List[ProductItem] = []
    for p in products:
        # Calculate clip stats
        clip_stats_stmt = select(
            func.count(Clip.id),
            func.coalesce(func.sum(Clip.duration_seconds), 0.0)
        ).where(Clip.product_id == p.id, Clip.status == "usable")
        row = (await db.execute(clip_stats_stmt)).one()
        clip_count, usable_dur = row

        results.append(ProductItem(
            id=p.id,
            name=p.name,
            category=p.category,
            folder_path=p.folder_path,
            commission_rate=p.commission_rate,
            margin_rate=p.margin_rate,
            target_demographic=p.target_demographic,
            active=p.active,
            clip_count=clip_count,
            usable_duration=round(usable_dur, 1),
        ))
    return results

@router.get("/products/{product_id}", response_model=ProductDetail)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Product).where(Product.id == product_id)
    p = (await db.execute(stmt)).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    clips_stmt = select(Clip).where(Clip.product_id == product_id)
    clips = (await db.execute(clips_stmt)).scalars().all()

    aliases_stmt = select(Alias).where(Alias.product_id == product_id)
    aliases = (await db.execute(aliases_stmt)).scalars().all()

    usable_dur = sum(c.duration_seconds for c in clips if c.status == "usable")

    return ProductDetail(
        id=p.id,
        name=p.name,
        category=p.category,
        folder_path=p.folder_path,
        commission_rate=p.commission_rate,
        margin_rate=p.margin_rate,
        target_demographic=p.target_demographic,
        active=p.active,
        clip_count=len(clips),
        usable_duration=round(usable_dur, 1),
        hook_ideas=p.hook_ideas,
        clips=[{"id": c.id, "filename": c.filename, "duration": c.duration_seconds, "status": c.status} for c in clips],
        aliases=[{"id": a.id, "raw_alias": a.raw_alias, "confidence": a.confidence, "status": a.status} for a in aliases],
    )

@router.post("/products")
async def create_product(
    req: CreateProductRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    folder_path = f"clips/{req.category}/{req.name.replace(' ', '_')}"
    # Create folder on storage
    full_path = local_storage._resolve_safe(folder_path)
    full_path.mkdir(parents=True, exist_ok=True)

    product = Product(
        name=req.name,
        category=req.category,
        folder_path=folder_path,
        commission_rate=req.commission_rate,
        margin_rate=req.margin_rate,
        target_demographic=req.target_demographic,
        active=True,
    )
    db.add(product)
    await db.commit()
    return product

@router.put("/products/{product_id}")
async def update_product(
    product_id: int,
    req: UpdateProductRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Product).where(Product.id == product_id)
    p = (await db.execute(stmt)).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if req.name and req.name != p.name:
        p = await catalog_service.rename_product(db, product_id, req.name, local_storage)

    if req.category is not None:
        p.category = req.category
    if req.commission_rate is not None:
        p.commission_rate = req.commission_rate
    if req.margin_rate is not None:
        p.margin_rate = req.margin_rate
    if req.target_demographic is not None:
        p.target_demographic = req.target_demographic
    if req.active is not None:
        p.active = req.active
    if req.hook_ideas is not None:
        p.hook_ideas = req.hook_ideas

    await db.commit()
    return p

@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    try:
        deleted = await catalog_service.delete_product(db, product_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return {"ok": True, "deleted_id": product_id}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/aliases")
async def list_aliases(
    status_filter: Optional[str] = Query(default=None, description="Filter by status e.g. pending_review, linked"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    stmt = select(Alias)
    if status_filter:
        stmt = stmt.where(Alias.status == status_filter)
    stmt = stmt.order_by(Alias.created_at.desc())
    aliases = (await db.execute(stmt)).scalars().all()
    return aliases

@router.post("/aliases/{alias_id}/link")
async def link_alias_to_product(
    alias_id: int,
    product_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    alias_stmt = select(Alias).where(Alias.id == alias_id)
    alias = (await db.execute(alias_stmt)).scalar_one_or_none()
    if not alias:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alias not found")

    prod_stmt = select(Product).where(Product.id == product_id)
    prod = (await db.execute(prod_stmt)).scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    alias.product_id = product_id
    alias.status = "linked"
    alias.confidence = 1.0
    await db.commit()
    return {"ok": True, "alias_id": alias.id, "linked_to": prod.name}

@router.post("/catalog/rescan")
async def rescan_catalog_clips(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user)
):
    count = await catalog_service.scan_clips_directory(db, local_storage)
    return {"ok": True, "registered_clips": count}
