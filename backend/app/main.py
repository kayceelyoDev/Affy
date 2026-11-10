import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.core.logging import configure_logging, logger
from backend.app.core.database import engine, Base
from backend.app.core.security import verify_csrf
from backend.app.services.scheduler import app_scheduler
from backend.app.api.auth import router as auth_router
from backend.app.api.settings import router as settings_router
from backend.app.api.schedules import router as schedules_router
from backend.app.api.runs import router as runs_router

configure_logging(debug=settings.DEBUG)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Affiliate Autopilot backend...", version=settings.PROJECT_VERSION)
    
    # Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema initialized.")

    # Initialize and start scheduler
    await app_scheduler.init_schedules()
    app_scheduler.start()

    yield

    # Shutdown
    app_scheduler.shutdown()
    await engine.dispose()
    logger.info("Affiliate Autopilot backend shutdown complete.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging & CSRF verification middleware
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    start_time = time.time()
    
    # Check CSRF on API mutating requests (skip login/auth initialization endpoints)
    if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/auth/"):
        try:
            verify_csrf(request)
        except Exception as e:
            return JSONResponse(status_code=403, content={"detail": str(e)})

    response = await call_next(request)
    duration = time.time() - start_time
    
    if not request.url.path.startswith("/api/runs") and not "stream" in request.url.path:
        logger.info(
            "HTTP request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(duration * 1000, 2),
        )
    return response

# Register API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(schedules_router, prefix="/api")
app.include_router(runs_router, prefix="/api")

@app.get("/health")
async def health():
    return {
        "ok": True,
        "name": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "environment": settings.ENVIRONMENT,
    }
