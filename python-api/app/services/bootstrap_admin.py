from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole

logger = logging.getLogger("app.bootstrap_admin")


def _normalize_email(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


async def ensure_bootstrap_admin_account(
    session: AsyncSession,
    *,
    email: str,
    name: str,
    phone_number: str | None = None,
) -> bool:
    """
    Ensure there is always at least one admin account in DB.

    Behavior:
    - If any admin user already exists -> no-op.
    - If no admin exists:
      - Promote existing user by bootstrap email to admin + active, OR
      - Create a new active admin user with bootstrap profile.
    """
    normalized_email = _normalize_email(email)
    if not normalized_email:
        logger.warning("Skipped bootstrap admin because BOOTSTRAP_ADMIN_EMAIL is empty.")
        return False

    admin_count_result = await session.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.admin)
    )
    admin_count = admin_count_result.scalar() or 0
    if admin_count > 0:
        return False

    existing_result = await session.execute(
        select(User).where(func.lower(User.email) == normalized_email)
    )
    existing_user = existing_result.scalar_one_or_none()

    if existing_user:
        existing_user.role = UserRole.admin
        existing_user.is_active = True
        if not existing_user.name:
            existing_user.name = (name or "").strip() or "System Administrator"
        if phone_number and not existing_user.phone_number:
            existing_user.phone_number = phone_number
        session.add(existing_user)
        await session.commit()
        logger.warning(
            "Bootstrap admin promoted existing account to admin: email=%s, user_id=%s",
            normalized_email,
            existing_user.id,
        )
        return True

    bootstrap_admin = User(
        name=(name or "").strip() or "System Administrator",
        email=normalized_email,
        phone_number=(phone_number or "").strip() or None,
        role=UserRole.admin,
        is_active=True,
        token_version=0,
    )
    session.add(bootstrap_admin)
    await session.commit()
    await session.refresh(bootstrap_admin)
    logger.warning(
        "Bootstrap admin account created: email=%s, user_id=%s",
        normalized_email,
        bootstrap_admin.id,
    )
    return True
