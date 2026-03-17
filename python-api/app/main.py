import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.api import api_router
from sqladmin import Admin
from app.db.database import engine
from app.admin.views import UserAdmin, StoreAdmin, DepartmentAdmin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
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

# Global Error Handler — prevents leaking internal details
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Lỗi hệ thống. Vui lòng thử lại sau."}
    )

# API Routes
app.include_router(api_router, prefix="/api")

# Static Files (for uploaded attachments)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return {"message": "Welcome to Store Control Center Python API"}

# Setup SQLAdmin
admin = Admin(app, engine)
admin.add_view(UserAdmin)
admin.add_view(StoreAdmin)
admin.add_view(DepartmentAdmin)
