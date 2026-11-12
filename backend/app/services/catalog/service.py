import os
import re
import json
import shutil
import subprocess
import difflib
from pathlib import Path
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from backend.app.models.models import Product, Clip, Alias, ClipTag
from backend.app.services.storage.base import StorageProvider
from backend.app.core.logging import logger

def normalize_title(title: str) -> str:
    """Normalize product name/alias by lowercasing, stripping emojis, punctuation and hashtags."""
    if not title:
        return ""
    # Remove hashtags and leading/trailing emojis
    clean = re.sub(r"#\S+", "", title)
    clean = re.sub(r"[^\w\s-]", " ", clean)
    clean = re.sub(r"\s+", " ", clean).strip().lower()
    return clean

def compute_similarity(str1: str, str2: str) -> float:
    """Computes similarity ratio using token sorting and sequence matching."""
    norm1 = normalize_title(str1)
    norm2 = normalize_title(str2)
    if not norm1 or not norm2:
        return 0.0
    if norm1 == norm2:
        return 1.0

    # Direct Levenshtein sequence ratio
    seq_ratio = difflib.SequenceMatcher(None, norm1, norm2).ratio()

    # Token sort ratio (order-independent word matching)
    tokens1 = sorted(norm1.split())
    tokens2 = sorted(norm2.split())
    token_str1 = " ".join(tokens1)
    token_str2 = " ".join(tokens2)
    token_ratio = difflib.SequenceMatcher(None, token_str1, token_str2).ratio()

    # Substring containment bonus
    if norm1 in norm2 or norm2 in norm1:
        return max(seq_ratio, token_ratio, 0.90)

    return max(seq_ratio, token_ratio)

def probe_video_file(file_path: str) -> dict:
    """Probe video file with ffprobe for duration, dimensions, fps, codec, HDR, and audio."""
    default_meta = {
        "width": 1080,
        "height": 1920,
        "duration": 5.0,
        "fps": 30.0,
        "codec": "h264",
        "is_hdr": False,
        "has_audio": True,
        "is_silent": False,
    }

    ffprobe = shutil.which("ffprobe")
    if not ffprobe or not os.path.exists(file_path):
        return default_meta

    cmd = [
        ffprobe,
        "-v", "error",
        "-show_entries", "stream=width,height,r_frame_rate,codec_name,color_space,color_transfer,codec_type",
        "-show_entries", "format=duration",
        "-of", "json",
        file_path,
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if res.returncode == 0:
            data = json.loads(res.stdout)
            format_info = data.get("format", {})
            streams = data.get("streams", [])

            dur = float(format_info.get("duration", 5.0))
            video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
            audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

            width = 1080
            height = 1920
            fps = 30.0
            codec = "h264"
            is_hdr = False

            if video_stream:
                width = int(video_stream.get("width", 1080))
                height = int(video_stream.get("height", 1920))
                codec = video_stream.get("codec_name", "h264")
                r_fps = video_stream.get("r_frame_rate", "30/1")
                if "/" in r_fps:
                    num, den = r_fps.split("/")
                    fps = round(float(num) / max(float(den), 1.0), 2)
                color_space = str(video_stream.get("color_space", "")).lower()
                color_transfer = str(video_stream.get("color_transfer", "")).lower()
                is_hdr = "bt2020" in color_space or "arib" in color_transfer or "smpte2084" in color_transfer

            return {
                "width": width,
                "height": height,
                "duration": dur,
                "fps": fps,
                "codec": codec,
                "is_hdr": is_hdr,
                "has_audio": audio_stream is not None,
                "is_silent": audio_stream is None,
            }
    except Exception as e:
        logger.warning("ffprobe execution error, falling back to defaults", error=str(e))

    return default_meta

class CatalogService:
    @staticmethod
    async def scan_clips_directory(db: AsyncSession, storage: StorageProvider) -> int:
        """Scan storage clips directory and auto-register products & clips.
        Supports both 1-level (clips/<ProductFolder>/<clip_files>) and 2-level (clips/<Category>/<ProductFolder>/<clip_files>).
        """
        logger.info("Scanning catalog clips from storage...")
        root_entries = await storage.list("clips")
        registered_clips = 0

        async def _process_product_dir(prod_path: str, prod_name: str, category_name: str = "Drive Folders"):
            nonlocal registered_clips
            # Find product by folder_path or by normalized name
            stmt = select(Product).where(Product.folder_path == prod_path)
            product = (await db.execute(stmt)).scalar_one_or_none()
            if not product:
                display_name = prod_name.replace("_", " ").strip()
                name_stmt = select(Product).where(Product.name == display_name)
                product = (await db.execute(name_stmt)).scalar_one_or_none()
            
            if not product:
                display_name = prod_name.replace("_", " ").strip()
                product = Product(
                    name=display_name,
                    category=category_name,
                    folder_path=prod_path,
                    commission_rate=0.15,
                    margin_rate=0.35,
                    active=True,
                )
                db.add(product)
                await db.flush()
            else:
                if product.folder_path != prod_path:
                    product.folder_path = prod_path
                    await db.flush()

            clip_files = await storage.list(prod_path)
            for clip_file in clip_files:
                if clip_file.is_dir or not clip_file.name.lower().endswith((".mp4", ".mov", ".mkv", ".webm")):
                    continue

                clip_stmt = select(Clip).where(Clip.file_path == clip_file.path)
                existing_clip = (await db.execute(clip_stmt)).scalar_one_or_none()
                if not existing_clip:
                    local_path = None
                    if hasattr(storage, "root"):
                        local_path = str(storage.root / clip_file.path)
                    meta = probe_video_file(local_path) if local_path else {
                        "width": 1080, "height": 1920, "duration": 5.0, "fps": 30.0, "codec": "h264", "is_hdr": False, "has_audio": True, "is_silent": False
                    }

                    new_clip = Clip(
                        product_id=product.id,
                        file_path=clip_file.path,
                        filename=clip_file.name,
                        size_bytes=clip_file.size_bytes,
                        duration_seconds=meta["duration"],
                        width=meta["width"],
                        height=meta["height"],
                        fps=meta["fps"],
                        codec=meta["codec"],
                        is_hdr=meta["is_hdr"],
                        has_audio=meta["has_audio"],
                        is_silent=meta["is_silent"],
                        status="usable",
                    )
                    db.add(new_clip)
                    registered_clips += 1

        for entry in root_entries:
            if not entry.is_dir:
                continue

            children = await storage.list(entry.path)
            has_videos = any(not c.is_dir and c.name.lower().endswith((".mp4", ".mov", ".mkv", ".webm")) for c in children)
            has_subdirs = any(c.is_dir for c in children)

            if has_videos or not has_subdirs:
                # Direct product folder (Drive subfolder)
                await _process_product_dir(entry.path, entry.name, category_name="Drive Folders")
            else:
                # Nested category folder
                for child in children:
                    if child.is_dir:
                        await _process_product_dir(child.path, child.name, category_name=entry.name)

        await db.commit()
        logger.info("Catalog scan completed", registered_clips=registered_clips)
        return registered_clips

    @staticmethod
    async def rename_product(db: AsyncSession, product_id: int, new_name: str, storage: StorageProvider) -> Product:
        """Renames a product in the database and renames its physical directory on disk."""
        stmt = select(Product).where(Product.id == product_id)
        product = (await db.execute(stmt)).scalar_one_or_none()
        if not product:
            raise FileNotFoundError(f"Product id {product_id} not found")

        old_folder = product.folder_path
        cat = product.category
        sanitized_new_folder = f"clips/{cat}/{new_name.replace(' ', '_')}"

        # 1. Rename on storage
        try:
            await storage.rename(old_folder, sanitized_new_folder)
        except Exception as e:
            logger.error("Failed to rename physical storage folder", old=old_folder, new=sanitized_new_folder, error=str(e))
            raise RuntimeError(f"Storage rename failed: {str(e)}")

        # 2. Update product record
        product.name = new_name
        product.folder_path = sanitized_new_folder

        # 3. Update all children clips paths
        clips_stmt = select(Clip).where(Clip.product_id == product_id)
        clips = (await db.execute(clips_stmt)).scalars().all()
        for c in clips:
            c.file_path = f"{sanitized_new_folder}/{c.filename}"

        await db.commit()
        logger.info("Product renamed successfully", id=product_id, name=new_name, new_folder=sanitized_new_folder)
        return product

    @staticmethod
    async def delete_product(db: AsyncSession, product_id: int) -> bool:
        """Deletes a product, strictly enforcing the delete guard if clips exist."""
        stmt = select(Product).where(Product.id == product_id)
        product = (await db.execute(stmt)).scalar_one_or_none()
        if not product:
            return False

        # DELETE GUARD CHECK
        clips_count_stmt = select(func.count(Clip.id)).where(Clip.product_id == product_id)
        count = (await db.execute(clips_count_stmt)).scalar() or 0
        if count > 0:
            raise ValueError(
                f"Delete guard triggered: cannot delete product '{product.name}' because it contains {count} active clips. Delete or archive clips first."
            )

        await db.delete(product)
        await db.commit()
        return True

    @staticmethod
    async def resolve_alias(db: AsyncSession, raw_alias: str, auto_link_threshold: float = 0.85) -> Alias:
        """Resolves alias: auto-links if confidence >= threshold, otherwise queues for review."""
        clean = normalize_title(raw_alias)

        # Check existing alias
        stmt = select(Alias).where(Alias.raw_alias == raw_alias)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing

        # Fetch all active products
        prod_stmt = select(Product)
        products = (await db.execute(prod_stmt)).scalars().all()

        best_score = 0.0
        best_product: Optional[Product] = None

        for p in products:
            score = compute_similarity(raw_alias, p.name)
            if score > best_score:
                best_score = score
                best_product = p

        status = "linked" if best_score >= auto_link_threshold and best_product else "pending_review"
        matched_id = best_product.id if (best_score >= auto_link_threshold and best_product) else None

        alias = Alias(
            raw_alias=raw_alias,
            normalized_alias=clean,
            product_id=matched_id,
            confidence=round(best_score, 3),
            status=status,
        )
        db.add(alias)
        await db.commit()

        logger.info(
            "Resolved product alias",
            raw=raw_alias,
            matched=best_product.name if best_product else None,
            score=alias.confidence,
            status=alias.status
        )
        return alias

catalog_service = CatalogService()
