import secrets
from fastapi import Request
from sqladmin.authentication import AuthenticationBackend

from app.core.config import settings


class AdminAuthBackend(AuthenticationBackend):
    """
    Simple credential-based authentication backend for SQLAdmin.
    Credentials are provided via environment variables.
    """

    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = str(form.get("username") or "")
        password = str(form.get("password") or "")

        expected_user = settings.SQLADMIN_USERNAME
        expected_pass = settings.SQLADMIN_PASSWORD
        if not expected_user or not expected_pass:
            return False

        is_valid = secrets.compare_digest(username, expected_user) and secrets.compare_digest(password, expected_pass)
        if is_valid:
            request.session.update({"sqladmin_authenticated": True})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get("sqladmin_authenticated"))
