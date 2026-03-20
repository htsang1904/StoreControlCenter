from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.user import UserRole
from app.services.bootstrap_admin import ensure_bootstrap_admin_account


def _mock_scalar_result(value):
    result = MagicMock()
    result.scalar.return_value = value
    return result


def _mock_one_result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.anyio
async def test_bootstrap_admin_skips_when_admin_exists():
    session = AsyncMock()
    session.add = MagicMock()
    session.execute.return_value = _mock_scalar_result(1)

    changed = await ensure_bootstrap_admin_account(
        session,
        email="admin@example.com",
        name="Admin",
    )

    assert changed is False
    assert session.add.call_count == 0
    assert session.commit.call_count == 0


@pytest.mark.anyio
async def test_bootstrap_admin_promotes_existing_user():
    session = AsyncMock()
    session.add = MagicMock()
    existing_user = MagicMock()
    existing_user.id = 10
    existing_user.email = "admin@example.com"
    existing_user.name = ""
    existing_user.phone_number = None
    existing_user.role = UserRole.store
    existing_user.is_active = False

    session.execute.side_effect = [
        _mock_scalar_result(0),      # admin count
        _mock_one_result(existing_user),  # existing user by email
    ]

    changed = await ensure_bootstrap_admin_account(
        session,
        email="admin@example.com",
        name="System Admin",
        phone_number="0900000000",
    )

    assert changed is True
    assert existing_user.role == UserRole.admin
    assert existing_user.is_active is True
    assert existing_user.name == "System Admin"
    assert existing_user.phone_number == "0900000000"
    assert session.add.call_count == 1
    assert session.commit.call_count == 1


@pytest.mark.anyio
async def test_bootstrap_admin_creates_new_user_if_missing():
    session = AsyncMock()
    session.add = MagicMock()
    session.execute.side_effect = [
        _mock_scalar_result(0),    # admin count
        _mock_one_result(None),    # existing user by email
    ]

    changed = await ensure_bootstrap_admin_account(
        session,
        email="admin@example.com",
        name="System Admin",
    )

    assert changed is True
    assert session.add.call_count == 1
    created_user = session.add.call_args.args[0]
    assert created_user.email == "admin@example.com"
    assert created_user.role == UserRole.admin
    assert created_user.is_active is True
    assert session.commit.call_count == 1
