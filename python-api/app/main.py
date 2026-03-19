import logging
import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.api.api import api_router
from sqladmin import Admin
from app.db.database import engine
from app.admin.views import UserAdmin, StoreAdmin, DepartmentAdmin

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
    allow_credentials=True,
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
    logger.info(
        f"{request.method} {request.url.path} - "
        f"{response.status_code} - "
        f"{process_time:.2f}ms"
    )
    return response

# Global Error Handler — prevents leaking internal details
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Determine if we should show traceback
    show_traceback = not isinstance(exc, (StarletteHTTPException))
    
    if show_traceback:
        logger.error(f"Critical Error: {request.method} {request.url.path} - {exc}", exc_info=True)
    else:
        logger.warning(f"Request Error: {request.method} {request.url.path} - {exc}")

    return JSONResponse(
        status_code=getattr(exc, "status_code", 400 if not show_traceback else 500),
        content={"success": False, "message": str(exc) if not show_traceback else "Lỗi hệ thống. Vui lòng thử lại sau."}
    )

# API Routes
app.include_router(api_router, prefix="/api")

# Static Files (for uploaded attachments)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return {"message": "Welcome to Store Control Center Python API"}

# Setup SQLAdmin
admin = Admin(app, engine)
admin.add_view(UserAdmin)
admin.add_view(StoreAdmin)
admin.add_view(DepartmentAdmin)
