from fastapi import APIRouter
from .routers import (
    admin_qc,
    admin_stores,
    admin_users,
    auth,
    dashboard,
    departments,
    notifications,
    qc,
    qc_findings,
    stores,
    ticket_logs,
    tickets,
)

api_router = APIRouter()
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(stores.router, prefix="/stores", tags=["Stores"])
api_router.include_router(departments.router, prefix="/departments", tags=["Departments"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["Tickets"])
api_router.include_router(ticket_logs.router, prefix="/ticket-logs", tags=["Ticket Logs"])
api_router.include_router(qc.router, prefix="/qc", tags=["QC"])
api_router.include_router(qc_findings.router, prefix="/qc/findings", tags=["QC Findings"])
# Legacy alias kept for backward compatibility, hidden from OpenAPI to avoid duplicate operation IDs.
api_router.include_router(
    qc_findings.router,
    prefix="/qc-findings",
    tags=["QC Findings"],
    include_in_schema=False,
)
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(admin_qc.router, prefix="/admin/qc", tags=["Admin QC"])
api_router.include_router(admin_users.router, prefix="/admin/users", tags=["Admin Users"])
api_router.include_router(admin_stores.router, prefix="/admin/stores", tags=["Admin Stores"])
