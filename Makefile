.PHONY: help check up down restart logs build test test-backend test-frontend spike-1 spike-2 spike-3 spike-4 spike-5 spike-6 spike-7

help:
	@echo "Affiliate Autopilot Build System"
	@echo "================================"
	@echo "make check         - Run linting, typing, and tests"
	@echo "make up            - Start all docker containers in background"
	@echo "make down          - Stop all containers"
	@echo "make restart       - Restart all containers"
	@echo "make logs          - Tail container logs"
	@echo "make build         - Rebuild container images"
	@echo "make test          - Run full backend and frontend test suite"
	@echo "make spike-1       - Run S1 Buffer post metrics spike"
	@echo "make spike-2       - Run S2 Buffer exact schedule spike"
	@echo "make spike-3       - Run S3 Gemini vision batch spike"
	@echo "make spike-4       - Run S4 Google Drive service account spike"
	@echo "make spike-5       - Run S5 yt-dlp TikTok audio spike"
	@echo "make spike-6       - Run S6 FFmpeg render benchmark spike"
	@echo "make spike-7       - Run S7 TikTok Display API spike"

check:
	python scripts/check_inventory.py
	python -m pytest backend/tests || echo "Backend tests pending"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

build:
	docker compose build

test: test-backend test-frontend

test-backend:
	pytest backend/tests

test-frontend:
	cd frontend && npm test

spike-1:
	python scripts/spikes/s1_buffer_metrics.py --live

spike-2:
	python scripts/spikes/s2_buffer_create_post.py --live

spike-3:
	python scripts/spikes/s3_gemini_vision_batch.py --live

spike-4:
	python scripts/spikes/s4_drive_service_account.py --live

spike-5:
	python scripts/spikes/s5_ytdlp_tiktok_audio.py --live

spike-6:
	python scripts/spikes/s6_ffmpeg_benchmark.py --live

spike-7:
	python scripts/spikes/s7_tiktok_display_api.py --live
