import io
import os
from typing import List, Dict, Any, Optional
import pandas as pd
from backend.app.services.ai.schemas import ExtractedOrderItem
from backend.app.services.ingest.validators import validate_order_id, normalize_stage

def parse_orders_spreadsheet(file_bytes: bytes, filename: str) -> List[ExtractedOrderItem]:
    """
    Deterministic spreadsheet parser for TikTok Shop orders.
    Zero AI cost, strictly preserves order ID strings.
    """
    ext = os.path.splitext(filename)[1].lower()
    bio = io.BytesIO(file_bytes)

    # Force string dtype on potential order ID columns to prevent float roundoff
    str_cols = ["Order ID", "order_id", "Order id", "SKU ID", "sku_id", "Order Number"]
    dtype_dict = {col: str for col in str_cols}

    if ext == ".csv":
        df = pd.read_csv(bio, dtype=str)
    else:
        df = pd.read_excel(bio, dtype=str)

    # Normalize column names to lowercase snake_case
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("-", "_") for c in df.columns]

    items: List[ExtractedOrderItem] = []

    # Map candidate columns
    id_col = next((c for c in df.columns if "order_id" in c or "order_no" in c or c == "id"), None)
    status_col = next((c for c in df.columns if "status" in c or "stage" in c), None)
    product_col = next((c for c in df.columns if "product" in c or "item" in c or "title" in c), None)
    price_col = next((c for c in df.columns if "price" in c or "amount" in c or "unit_price" in c), None)
    qty_col = next((c for c in df.columns if "qty" in c or "quantity" in c or "count" in c), None)
    rate_col = next((c for c in df.columns if "commission_rate" in c or "rate" in c), None)
    est_comm_col = next((c for c in df.columns if "est_commission" in c or "estimated_commission" in c), None)
    act_comm_col = next((c for c in df.columns if "actual_commission" in c or "settled_commission" in c), None)
    settle_date_col = next((c for c in df.columns if "settle" in c or "settlement" in c), None)
    order_date_col = next((c for c in df.columns if "order_date" in c or "created" in c or "date" in c), None)

    for _, row in df.iterrows():
        raw_id = str(row.get(id_col, "")).strip() if id_col else ""
        is_valid, cleaned_id, _ = validate_order_id(raw_id)
        if not is_valid:
            continue

        raw_status = str(row.get(status_col, "unpaid")) if status_col else "unpaid"
        norm_status = normalize_stage(raw_status)

        prod_name = str(row.get(product_col, "Unknown Product")) if product_col else "Unknown Product"

        # Numerics
        try:
            price_val = float(row.get(price_col, 0.0))
        except (ValueError, TypeError):
            price_val = 0.0

        try:
            qty_val = int(float(row.get(qty_col, 1)))
        except (ValueError, TypeError):
            qty_val = 1

        try:
            rate_val = float(str(row.get(rate_col, 0.10)).replace("%", ""))
            if rate_val > 1.0:
                rate_val = rate_val / 100.0
        except (ValueError, TypeError):
            rate_val = 0.10

        est_comm = None
        if est_comm_col and pd.notna(row.get(est_comm_col)):
            try:
                est_comm = float(str(row.get(est_comm_col)).replace("$", "").replace("₱", ""))
            except (ValueError, TypeError):
                est_comm = None

        act_comm = None
        if act_comm_col and pd.notna(row.get(act_comm_col)):
            try:
                val = str(row.get(act_comm_col)).replace("$", "").replace("₱", "").strip()
                if val and val != "-":
                    act_comm = float(val)
            except (ValueError, TypeError):
                act_comm = None

        settle_date = str(row.get(settle_date_col, "")) if settle_date_col and pd.notna(row.get(settle_date_col)) else None
        order_date = str(row.get(order_date_col, "")) if order_date_col and pd.notna(row.get(order_date_col)) else None

        items.append(
            ExtractedOrderItem(
                order_id=cleaned_id,
                status_stage=norm_status,
                product_name_raw=prod_name,
                price=price_val,
                quantity=qty_val,
                gmv=round(price_val * qty_val, 2),
                commission_rate=rate_val,
                est_commission=est_comm,
                actual_commission=act_comm,
                settle_date_est=settle_date,
                is_shop_ads=False,
                order_date=order_date,
                confidence=1.0,
                uncertain_fields=[],
            )
        )

    return items
