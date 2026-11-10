import os
from typing import Dict, Any, Optional

def classify_file(filename: str, file_bytes: bytes) -> str:
    """
    Classify file type without AI:
    - spreadsheet_orders
    - spreadsheet_content
    - image_orders
    - unknown
    """
    ext = os.path.splitext(filename)[1].lower()

    if ext in [".png", ".jpg", ".jpeg", ".webp"]:
        # Image screenshot - default to affiliate orders screen
        return "image_orders"

    if ext in [".csv", ".xlsx", ".xls"]:
        # Inspect content header without full parsing
        content_sample = file_bytes[:4096].decode("utf-8", errors="ignore").lower()
        
        # Check Content Log indicators
        if "buffer_post_id" in content_sample or "hook_style" in content_sample or "content_log" in content_sample:
            return "spreadsheet_content"

        # Check Orders indicators
        if "order id" in content_sample or "order_id" in content_sample or "sku id" in content_sample or "commission" in content_sample:
            return "spreadsheet_orders"

        # Check Sales Daily Log
        if "sales_log" in content_sample or "settled_orders" in content_sample:
            return "spreadsheet_sales"

        return "spreadsheet_orders" # default spreadsheet assumption

    return "unknown"
