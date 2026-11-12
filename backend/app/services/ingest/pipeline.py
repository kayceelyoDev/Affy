import hashlib
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import structlog

from backend.app.models.models import Upload, Extraction, Order, Product, Alias
from backend.app.services.ai.gateway import AIGateway
from backend.app.services.ai.prompts.orders_vision import PROMPT_VERSION
from backend.app.services.ingest.classifier import classify_file
from backend.app.services.ingest.validators import validate_order_id, validate_commission_tolerance, normalize_stage
from backend.app.core.config import settings
from backend.app.services.ingest.spreadsheet import parse_orders_spreadsheet
from backend.app.services.catalog.service import CatalogService

logger = structlog.get_logger()

class IngestPipeline:
    def __init__(
        self,
        ai_gateway: AIGateway,
        catalog_service: CatalogService,
        upload_dir: Optional[str] = None,
        batch_size: int = 5,
    ):
        self.ai_gateway = ai_gateway
        self.catalog_service = catalog_service
        self.upload_dir = upload_dir or str(settings.DATA_DIR / "archive" / "uploads")
        self.batch_size = batch_size
        try:
            os.makedirs(self.upload_dir, exist_ok=True)
        except Exception as e:
            logger.warn("could_not_create_upload_dir", dir=self.upload_dir, error=str(e))

    async def ingest_file(
        self,
        db: AsyncSession,
        filename: str,
        file_bytes: bytes,
    ) -> Tuple[Upload, bool]:
        """
        Deduplicates by file hash. If duplicate, returns (existing_upload, is_new=False).
        Otherwise saves file, classifies type, and registers pending Upload record.
        """
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        # Deduplication check
        existing_stmt = select(Upload).where(Upload.file_hash == file_hash)
        existing = (await db.execute(existing_stmt)).scalars().first()
        if existing:
            logger.info("file_upload_deduplicated", filename=filename, file_hash=file_hash)
            return existing, False

        file_type = classify_file(filename, file_bytes)
        ext = os.path.splitext(filename)[1] or ".bin"
        storage_path = os.path.join(self.upload_dir, f"{file_hash}{ext}")

        with open(storage_path, "wb") as f:
            f.write(file_bytes)

        upload = Upload(
            file_hash=file_hash,
            filename=filename,
            file_type=file_type,
            storage_path=storage_path,
            status="pending",
        )
        db.add(upload)
        await db.commit()
        await db.refresh(upload)

        return upload, True

    async def process_batch_uploads(
        self,
        db: AsyncSession,
        upload_ids: List[int],
    ) -> Dict[str, Any]:
        """
        Process a list of pending uploads:
        - Spreadsheets handled deterministically without AI.
        - Images grouped into batches of 4-6 per Gemini request.
        """
        uploads_stmt = select(Upload).where(Upload.id.in_(upload_ids))
        uploads = list((await db.execute(uploads_stmt)).scalars().all())

        images_to_process: List[Upload] = []
        spreadsheets_to_process: List[Upload] = []

        for u in uploads:
            if "spreadsheet" in u.file_type:
                spreadsheets_to_process.append(u)
            else:
                images_to_process.append(u)

        # 1. Deterministic Spreadsheets
        spreadsheet_orders_count = 0
        for u in spreadsheets_to_process:
            try:
                with open(u.storage_path, "rb") as f:
                    content = f.read()
                items = parse_orders_spreadsheet(content, u.filename)
                for item in items:
                    await self._upsert_order(db, item, upload_id=u.id)
                u.status = "completed"
                u.completed_at = datetime.utcnow()
                spreadsheet_orders_count += len(items)
            except Exception as e:
                logger.error("spreadsheet_ingest_failed", upload_id=u.id, error=str(e))
                u.status = "failed"
                u.error_message = str(e)

        # 2. Batched Images (4 to 6 per Gemini request)
        total_ai_calls_before = self.ai_gateway.call_count
        image_orders_count = 0
        review_required_count = 0

        for i in range(0, len(images_to_process), self.batch_size):
            chunk = images_to_process[i:i + self.batch_size]
            chunk_bytes = []
            for u in chunk:
                with open(u.storage_path, "rb") as f:
                    chunk_bytes.append(f.read())

            try:
                batched_extraction = await self.ai_gateway.extract_orders_from_batch(
                    image_bytes_list=chunk_bytes,
                    task="vision_extraction",
                )

                for idx, single_ext in enumerate(batched_extraction.results):
                    u = chunk[idx]
                    any_review_needed = False

                    # Link Alias for products
                    for order_item in single_ext.orders:
                        is_valid_id, clean_id, reason = validate_order_id(order_item.order_id)
                        comm_valid = validate_commission_tolerance(
                            order_item.price, order_item.quantity, order_item.commission_rate, order_item.est_commission
                        )

                        alias = await self.catalog_service.resolve_alias(db, order_item.product_name_raw)
                        order_item.order_id = clean_id if is_valid_id else order_item.order_id

                        # Check if review queue routing required
                        needs_review = (
                            not is_valid_id
                            or not comm_valid
                            or order_item.confidence < 0.85
                            or len(order_item.uncertain_fields) > 0
                        )

                        linked_product_id = alias.product_id if (alias and alias.status == "linked") else None

                        if needs_review:
                            any_review_needed = True
                            review_status = "pending_review"
                            review_required_count += 1
                        else:
                            review_status = "auto_approved"
                            await self._upsert_order(
                                db,
                                order_item,
                                upload_id=u.id,
                                product_id=linked_product_id,
                            )
                            image_orders_count += 1

                        # Save Extraction Record
                        ext_rec = Extraction(
                            upload_id=u.id,
                            image_index=idx,
                            model_used=self.ai_gateway.task_routing["vision_extraction"][0],
                            prompt_version=PROMPT_VERSION,
                            raw_json=order_item.model_dump_json(),
                            confidence=order_item.confidence,
                            review_status=review_status,
                            order_id_extracted=order_item.order_id,
                        )
                        db.add(ext_rec)

                    u.status = "review_required" if any_review_needed else "completed"
                    u.completed_at = datetime.utcnow()

            except Exception as e:
                logger.error("image_batch_processing_failed", error=str(e))
                for u in chunk:
                    u.status = "failed"
                    u.error_message = str(e)

        await db.commit()

        ai_calls_made = self.ai_gateway.call_count - total_ai_calls_before
        return {
            "processed_uploads": len(uploads),
            "spreadsheet_orders_ingested": spreadsheet_orders_count,
            "image_orders_auto_approved": image_orders_count,
            "items_queued_for_review": review_required_count,
            "ai_api_calls_made": ai_calls_made,
        }

    async def _upsert_order(
        self,
        db: AsyncSession,
        item: Any,
        upload_id: int,
        product_id: Optional[int] = None,
    ) -> Order:
        """Upsert order by order_id: tracks settle_date_changes, updates status and commission."""
        stmt = select(Order).where(Order.order_id == item.order_id)
        existing = (await db.execute(stmt)).scalars().first()

        norm_status = normalize_stage(item.status_stage)

        if existing:
            # Check if settle date changed
            if item.settle_date_est and existing.settle_date_est and item.settle_date_est != existing.settle_date_est:
                existing.settle_date_changes += 1

            existing.status_stage = norm_status
            if item.actual_commission is not None:
                existing.actual_commission = item.actual_commission
            if item.est_commission is not None:
                existing.est_commission = item.est_commission
            if item.settle_date_est:
                existing.settle_date_est = item.settle_date_est
            if product_id:
                existing.product_id = product_id
            existing.updated_at = datetime.utcnow()
            return existing
        else:
            new_order = Order(
                order_id=item.order_id,
                status_stage=norm_status,
                product_id=product_id,
                product_name_raw=item.product_name_raw,
                price=item.price,
                quantity=item.quantity,
                gmv=item.gmv,
                commission_rate=item.commission_rate,
                est_commission=item.est_commission,
                actual_commission=item.actual_commission,
                settle_date_est=item.settle_date_est,
                settle_date_changes=0,
                is_shop_ads=item.is_shop_ads,
                confidence=item.confidence,
                order_date=item.order_date,
            )
            db.add(new_order)
            return new_order
