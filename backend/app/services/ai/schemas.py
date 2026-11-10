from typing import Optional, List
from pydantic import BaseModel, Field

class ExtractedOrderItem(BaseModel):
    order_id: str = Field(description="Order ID string, copied digit for digit (10-22 digits)")
    status_stage: str = Field(default="unpaid", description="Status e.g. Awaiting payment, In transit, Delivered, Settled/Completed, Cancelled, Refunded")
    product_name_raw: str = Field(description="Raw product title shown in the screenshot")
    price: float = Field(default=0.0, description="Product price per unit")
    quantity: int = Field(default=1, description="Quantity of items in this order")
    gmv: float = Field(default=0.0, description="Gross Merchandise Value (price * quantity)")
    commission_rate: float = Field(default=0.10, description="Commission rate as decimal (e.g. 0.10 for 10%)")
    est_commission: Optional[float] = Field(default=None, description="Estimated commission")
    actual_commission: Optional[float] = Field(default=None, description="Actual settled commission, null if unsettled or '-'")
    settle_date_est: Optional[str] = Field(default=None, description="Estimated settlement date if visible")
    is_shop_ads: bool = Field(default=False, description="True if marked as shop ads or paid traffic")
    order_date: Optional[str] = Field(default=None, description="Date of order placement if visible")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score of OCR extraction")
    uncertain_fields: List[str] = Field(default_factory=list, description="List of fields with uncertain characters")

class SingleImageExtraction(BaseModel):
    image_index: int = Field(description="Zero-based index of the image in the batch")
    screen_type: str = Field(default="affiliate_orders", description="Type of screen: affiliate_orders, product_overview, other")
    orders: List[ExtractedOrderItem] = Field(default_factory=list, description="List of extracted orders from this screenshot")
    notes: Optional[str] = Field(default=None, description="Any warnings or parsing notes")

class BatchedOrdersExtraction(BaseModel):
    results: List[SingleImageExtraction] = Field(default_factory=list, description="Extraction results per image index in the batch")
