import logging
import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import ProgrammingError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.api.api import api_router
from sqladmin import Admin
from app.db.database import SessionLocal, engine
from app.admin.views import UserAdmin, StoreAdmin, DepartmentAdmin
from app.admin.auth import AdminAuthBackend
from app.services.bootstrap_admin import ensure_bootstrap_admin_account

# Configure logging to be more concise
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    force=True,
)
logger = logging.getLogger("app")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Python FastAPI backend migrating from Strapi v4",
    version=settings.VERSION
)

# CORS Configuration (reads from ALLOWED_ORIGINS env var)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    
    # Log: METHOD PATH - STATUS - TIME ms
    log_message = (
        f"{request.method} {request.url.path} - "
        f"{response.status_code} - "
        f"{process_time:.2f}ms"
    )
    if response.status_code >= 400:
        logger.warning(log_message)
    else:
        logger.info(log_message)
    return response

# Global Error Handler — prevents leaking internal details
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = getattr(exc, "detail", None) or str(exc)
    logger.warning(
        f"Request Error: {request.method} {request.url.path} - "
        f"{getattr(exc, 'status_code', 400)} - {detail}"
    )
    return JSONResponse(
        status_code=getattr(exc, "status_code", 400),
        content={"success": False, "detail": detail, "message": detail},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Determine if we should show traceback
    show_traceback = not isinstance(exc, (StarletteHTTPException))
    
    if show_traceback:
        logger.error(f"Critical Error: {request.method} {request.url.path} - {exc}", exc_info=True)
    else:
        logger.warning(f"Request Error: {request.method} {request.url.path} - {exc}")

    detail = getattr(exc, "detail", None)
    message = detail or str(exc)

    return JSONResponse(
        status_code=getattr(exc, "status_code", 400 if not show_traceback else 500),
        content={"success": False, "detail": message, "message": message if not show_traceback else "Lỗi hệ thống. Vui lòng thử lại sau."}
    )

# API Routes
app.include_router(api_router, prefix="/api")

# Static Files (for uploaded attachments)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return {"message": "Welcome to Store Control Center Python API"}


@app.on_event("startup")
async def bootstrap_admin_on_startup() -> None:
    if not settings.ENABLE_BOOTSTRAP_ADMIN:
        logger.info("Bootstrap admin is disabled (ENABLE_BOOTSTRAP_ADMIN=false).")
        return

    try:
        async with SessionLocal() as session:
            changed = await ensure_bootstrap_admin_account(
                session,
                email=settings.BOOTSTRAP_ADMIN_EMAIL,
                name=settings.BOOTSTRAP_ADMIN_NAME,
                phone_number=settings.BOOTSTRAP_ADMIN_PHONE_NUMBER,
            )
            if changed:
                logger.info("Bootstrap admin check completed with updates.")
            else:
                logger.info("Bootstrap admin check completed with no changes.")
    except (ProgrammingError, OperationalError) as exc:
        # DB may not be migrated yet; keep app booting and let migration run first.
        logger.warning("Skipped bootstrap admin due to database state: %s", exc)
    except Exception as exc:
        # Do not block server startup if bootstrap admin fails unexpectedly.
        logger.error("Bootstrap admin failed unexpectedly: %s", exc, exc_info=True)

# Setup SQLAdmin
if settings.ENABLE_SQLADMIN:
    if not settings.SQLADMIN_USERNAME or not settings.SQLADMIN_PASSWORD:
        logger.warning("SQLAdmin enabled but SQLADMIN_USERNAME/SQLADMIN_PASSWORD is missing. SQLAdmin is disabled.")
    else:
        auth_backend = AdminAuthBackend(
            secret_key=settings.SQLADMIN_SESSION_SECRET or settings.SECRET_KEY
        )
        admin = Admin(app, engine, authentication_backend=auth_backend)
        admin.add_view(UserAdmin)
        admin.add_view(StoreAdmin)
        admin.add_view(DepartmentAdmin)
else:
    logger.info("SQLAdmin is disabled. Set ENABLE_SQLADMIN=true to enable it.")
