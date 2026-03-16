from fastapi import APIRouter
from app.api.routers import auth, stores, departments, tickets, qc, ticket_logs, notifications

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(auth.router, prefix="/user-info", tags=["Auth (Legacy)"])
api_router.include_router(stores.router, prefix="/stores", tags=["Stores"])
api_router.include_router(departments.router, prefix="/departments", tags=["Departments"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["Tickets"])
api_router.include_router(ticket_logs.router, prefix="/ticket-logs", tags=["Ticket Logs"])
api_router.include_router(qc.router, prefix="/qc", tags=["QC"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
