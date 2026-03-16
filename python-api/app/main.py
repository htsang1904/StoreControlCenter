from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.api import api_router
from sqladmin import Admin
from app.db.database import engine
from app.admin.views import UserAdmin, StoreAdmin, DepartmentAdmin

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Python FastAPI backend migrating from Strapi v4",
    version=settings.VERSION
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Welcome to Store Control Center Python API"}

# Setup SQLAdmin
admin = Admin(app, engine)
admin.add_view(UserAdmin)
admin.add_view(StoreAdmin)
admin.add_view(DepartmentAdmin)
