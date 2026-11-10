import re
from typing import Tuple, Optional, Any

def validate_order_id(order_id_raw: Any) -> Tuple[bool, str, Optional[str]]:
    """
    Validates TikTok Shop order ID string:
    - Must be strictly text
    - Must be between 10 and 22 digits
    - Disallows scientific notation or floating point rounding (e.g. '5.78912E+17' or ending with '.0')
    Returns: (is_valid, cleaned_id, error_reason)
    """
    if order_id_raw is None:
        return False, "", "Order ID is empty"

    order_str = str(order_id_raw).strip()

    if not order_str:
        return False, "", "Order ID is empty string"

    # Detect floating point truncation or scientific notation
    if "e+" in order_str.lower() or "e-" in order_str.lower():
        return False, order_str, "Order ID contains scientific notation (precision lost from numeric conversion)"

    if order_str.endswith(".0"):
        return False, order_str, "Order ID was converted to float with trailing .0"

    # Must be 10 to 22 digits
    if not re.match(r"^\d{10,22}$", order_str):
        return False, order_str, f"Order ID length must be 10-22 digits, got {len(order_str)} chars: '{order_str}'"

    return True, order_str, None

def normalize_stage(raw_stage: str) -> str:
    """
    Map various TikTok Shop display labels to canonical stage enums:
    'unpaid', 'to_ship', 'shipped', 'delivered', 'settled', 'cancelled', 'refunded'
    """
    stage_lower = raw_stage.lower().strip()
    
    if any(k in stage_lower for k in ["awaiting payment", "unpaid", "pending payment"]):
        return "unpaid"
    if any(k in stage_lower for k in ["to ship", "awaiting shipment", "processing"]):
        return "to_ship"
    if any(k in stage_lower for k in ["in transit", "shipped", "shipping", "on the way"]):
        return "shipped"
    if any(k in stage_lower for k in ["delivered"]):
        return "delivered"
    if any(k in stage_lower for k in ["completed", "settled", "paid out"]):
        return "settled"
    if any(k in stage_lower for k in ["cancelled", "canceled"]):
        return "cancelled"
    if any(k in stage_lower for k in ["refunded", "returned", "return"]):
        return "refunded"

    return "unpaid"

def validate_commission_tolerance(
    price: float,
    quantity: int,
    commission_rate: float,
    est_commission: Optional[float],
    tolerance_pct: float = 0.25,
) -> bool:
    """
    Verify estimated commission is roughly (price * quantity * commission_rate)
    within tolerance (e.g. 25% accounting for discounts/coupons/shipping subsidies).
    """
    if est_commission is None or est_commission <= 0:
        return True

    expected = price * quantity * commission_rate
    if expected <= 0:
        return True

    ratio = abs(est_commission - expected) / expected
    return ratio <= tolerance_pct
