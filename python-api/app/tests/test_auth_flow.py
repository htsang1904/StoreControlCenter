import pytest
import jwt
from datetime import datetime, timedelta, timezone
from app.core import security
from app.core.config import settings

def test_create_access_token_with_payload():
    subject = 123
    data = {"email": "test@example.com", "tokenVersion": 5}
    token = security.create_access_token(subject, data=data)
    
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == str(subject)
    assert payload["email"] == "test@example.com"
    assert payload["tokenVersion"] == 5
    assert "exp" in payload

def test_hash_refresh_token_logic():
    from app.api.routers.auth import hash_refresh_token
    token = "some_random_token"
    h1 = hash_refresh_token(token)
    h2 = hash_refresh_token(token)
    assert h1 == h2
    assert len(h1) == 64 # SHA256

def test_suite_staff_id_from_profile():
    from app.api.routers.auth import suite_staff_id_from_profile

    assert suite_staff_id_from_profile({"id": 100}) == "100"
    assert suite_staff_id_from_profile({"staff_id": "ABC"}) == "ABC"
    assert suite_staff_id_from_profile({"email": "same@example.com"}) == ""

@pytest.mark.anyio
async def test_auth_router_mock_login(monkeypatch):
    from app.api.routers.auth import user_login
    from app.schemas.user import LoginRequest
    from unittest.mock import AsyncMock, MagicMock
    
    # Mock database session
    mock_session = AsyncMock()
    mock_session.add = MagicMock()
    mock_user = MagicMock()
    mock_user.id = 1
    mock_user.email = "marketing@gutacafe.com"
    mock_user.suite_staff_id = "staff-1"
    mock_user.token_version = 1
    mock_user.is_active = True
    mock_user.name = "Test User"
    mock_user.phone_number = None
    
    # Mock session results
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user
    mock_session.execute.return_value = mock_result
    
    # Mock Suite sync
    async def mock_sync(*args, **kwargs):
        return []
    monkeypatch.setattr("app.api.routers.auth.map_suite_stores_to_user", mock_sync)
    
    request = LoginRequest(
        token="suite_token_xyz",
        profile={
            "id": "staff-1",
            "email": "marketing@gutacafe.com",
            "name": "Updated Name",
            "phone": "0987654321"
        }
    )
    
    response = await user_login(mock_session, request)
    
    assert response["success"] is True
    assert "accessToken" in response["data"]
    
    # Verify phone_number was updated
    assert mock_user.phone_number == "0987654321"
    assert mock_user.name == "Updated Name"
    
    # Verify JWT payload contains tokenVersion
    payload = jwt.decode(response["data"]["accessToken"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["tokenVersion"] == 2 # 1 + 1
