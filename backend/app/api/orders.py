from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from backend.app.core.database import get_db
from backend.app.models.models import Order, Product

router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.get("")
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    product_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Order, Product.name.label("product_name")).outerjoin(Product, Order.product_id == Product.id)

    filters = []
    if status:
        filters.append(Order.status_stage == status)
    if product_id:
        filters.append(Order.product_id == product_id)
    if search:
        search_filter = (Order.order_id.contains(search)) | (Order.product_name_raw.contains(search))
        filters.append(search_filter)

    if filters:
        stmt = stmt.where(and_(*filters))

    # Total count
    count_stmt = select(func.count(Order.id))
    if filters:
        count_stmt = count_stmt.where(and_(*filters))
    total_count = (await db.execute(count_stmt)).scalar() or 0

    # Paginated results
    stmt = stmt.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    items = []
    for order, prod_name in rows:
        items.append({
            "id": order.id,
            "order_id": order.order_id,
            "status_stage": order.status_stage,
            "product_id": order.product_id,
            "product_name": prod_name or order.product_name_raw,
            "product_name_raw": order.product_name_raw,
            "price": order.price,
            "quantity": order.quantity,
            "gmv": order.gmv,
            "commission_rate": order.commission_rate,
            "est_commission": order.est_commission,
            "actual_commission": order.actual_commission,
            "settle_date_est": order.settle_date_est,
            "settle_date_changes": order.settle_date_changes,
            "is_shop_ads": order.is_shop_ads,
            "order_date": order.order_date,
            "confidence": order.confidence,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
    }

@router.get("/summary")
async def get_orders_summary(
    db: AsyncSession = Depends(get_db),
):
    total_orders_stmt = select(func.count(Order.id))
    total_orders = (await db.execute(total_orders_stmt)).scalar() or 0

    total_gmv_stmt = select(func.sum(Order.gmv))
    total_gmv = (await db.execute(total_gmv_stmt)).scalar() or 0.0

    est_comm_stmt = select(func.sum(Order.est_commission)).where(Order.status_stage != "cancelled")
    est_comm = (await db.execute(est_comm_stmt)).scalar() or 0.0

    settled_comm_stmt = select(func.sum(Order.actual_commission)).where(Order.status_stage == "settled")
    settled_comm = (await db.execute(settled_comm_stmt)).scalar() or 0.0

    return {
        "total_orders": total_orders,
        "total_gmv": round(total_gmv, 2),
        "total_est_commission": round(est_comm, 2),
        "total_settled_commission": round(settled_comm, 2),
    }
