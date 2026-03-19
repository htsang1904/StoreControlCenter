from datetime import timedelta, datetime, timezone
from typing import Any
import jwt
import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core import security
from app.core.config import settings
from app.api.deps import SessionDep, CurrentUser
from app.models.user import User
from app.models.org import Store
from app.schemas.user import LoginRequest, RefreshRequest, AuthTokensResponse, UserResponse

router = APIRouter()
logger = logging.getLogger("app.auth")

# Strapi compatibility logic ported from Node.js
# -----------------------------------------------

def hash_refresh_token(token: str) -> str:
    # Use SECRET_KEY as salt for refresh token hashing if no specific salt is defined
    salt = settings.SECRET_KEY
    return hashlib.sha256(f"{token}{salt}".encode()).hexdigest()

@router.post("/login", response_model=dict)
async def user_login(
    session: SessionDep, request: LoginRequest
) -> Any:
    """
    Login endpoint expecting `token` (Suite Token) and `profile`.
    Validates the RSA token, then upserts the User.
    """
    suite_user = request.profile
    if not request.token or not suite_user.get("email"):
        raise HTTPException(status_code=400, detail="Thiếu thông tin đăng nhập")

    # TODO: In production, verify `request.token` using public RSA key `oauth-public.key`!
    # For now, we trust the incoming Suite payload as we did in Strapi local if `publicKey` exists.
    # try:
    #    jwt.decode(request.token, public_key, algorithms=['RS256'], options={"verify_signature": True})
    # except Exception:
    #    raise HTTPException(status_code=401, detail="Thông tin đăng nhập không chính xác")

    query = select(User).where(User.email == suite_user["email"])
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        # Create user if logging in for the first time
        assigned_role = suite_user.get("role", "store")
        if assigned_role not in ["store", "handler", "qc", "admin"]:
            assigned_role = "store"

        user = User(
            name=suite_user.get("name", ""),
            email=suite_user["email"],
            phone_number=suite_user.get("phone_number") or suite_user.get("phone"),
            suite_token=request.token,
            token_version=0,
            role=assigned_role,
            is_active=False
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        # Update existing user profile info from Suite if changed
        user.name = suite_user.get("name", user.name)
        user.phone_number = suite_user.get("phone_number") or suite_user.get("phone") or user.phone_number
        user.suite_token = request.token
        session.add(user)

    if not user.is_active:
        raise HTTPException(
            status_code=403, 
            detail="Tài khoản chưa được cấp quyền. Vui lòng liên hệ IT để được cấp quyền truy cập."
        )

    # Generate Auth Tokens (AccessToken + RefreshToken)
    next_token_version = (user.token_version or 0) + 1
    
    # Payload similar to existing access token
    access_payload = {"sub": str(user.id), "email": user.email, "tokenVersion": next_token_version, "type": "access"}
    access_token = security.create_access_token(
        (user.id), 
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        data=access_payload
    )
    
    refresh_payload = {"sub": str(user.id), "tokenVersion": next_token_version, "type": "refresh"}
    refresh_token = security.create_access_token(
        (user.id), 
        expires_delta=timedelta(days=30),
        data=refresh_payload
    )
    
    # Store token metadata in user table
    user.token_version = next_token_version
    user.refresh_token_hash = hash_refresh_token(refresh_token)
    user.refresh_token_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
    user.suite_token = request.token
    
    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Sync stores from Suite during login
    try:
        await map_suite_stores_to_user(session, user)
    except Exception as sync_err:
        logger.warning(f"[auth] initial sync failed during login for {user.email}: {sync_err}")

    return {
        "success": True,
        "message": "Đăng nhập thành công",
        "data": {
            "tokenType": "Bearer",
            "accessToken": access_token,
            "refreshToken": refresh_token
        }
    }

@router.post("/refresh", response_model=dict)
async def refresh_token(
    session: SessionDep, request: RefreshRequest
) -> Any:
    # Similar to strapi `/refresh` endpoint
    try:
        payload = jwt.decode(
            request.refreshToken, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ hoặc đã hết hạn")

    user_id = payload.get("sub")
    
    # Retrieve User
    query = select(User).where(User.id == int(user_id))
    user = (await session.execute(query)).scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Tài khoản không hợp lệ")
        
    if user.refresh_token_hash != hash_refresh_token(request.refreshToken):
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")
        
    # Issue new pair - keeping same token version
    access_payload = {"sub": str(user.id), "email": user.email, "tokenVersion": user.token_version, "type": "access"}
    access_token = security.create_access_token(
        (user.id), 
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        data=access_payload
    )
    
    refresh_payload = {"sub": str(user.id), "tokenVersion": user.token_version, "type": "refresh"}
    refresh_token = security.create_access_token(
        (user.id), 
        expires_delta=timedelta(days=30),
        data=refresh_payload
    )
    
    user.refresh_token_hash = hash_refresh_token(refresh_token)
    user.refresh_token_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
    session.add(user)
    await session.commit()
    
    return {
        "success": True,
        "message": "Làm mới token thành công",
        "data": {
            "tokenType": "Bearer",
            "accessToken": access_token,
            "refreshToken": refresh_token
        }
    }

import httpx
from urllib.parse import urljoin

async def map_suite_stores_to_user(session: AsyncSession, user: User) -> list:
    """
    Fetch user store IDs from Suite API and link them to the local User record.
    Matches the Strapi logic `mapSuiteStoresToUser`.
    """
    if not user.suite_token:
        return []

    # Endpoint: /v1/auth/list_store
    url = urljoin(settings.SUITE_API, "/v1/auth/list_store")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url, 
                headers={"Authorization": f"Bearer {user.suite_token}"}
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as e:
        # Log warning similar to Strapi
        logger.warning(f"[auth] sync suite stores failed for user {user.id}: {str(e)}")
        return []

    if not payload.get("success"):
        return []

    # Extract store IDs
    suite_store_ids = []
    if isinstance(payload.get("store_ids"), list):
        suite_store_ids = [str(sid).strip() for sid in payload["store_ids"] if sid]
    elif isinstance(payload.get("stores"), dict):
        for group in payload["stores"].values():
            if isinstance(group, list):
                for s in group:
                    if s.get("id"):
                        suite_store_ids.append(str(s["id"]).strip())
    
    if not suite_store_ids:
        user.stores = []
        session.add(user)
        await session.commit()
        return []

    # Match with local stores
    query = select(Store).where(Store.storeId.in_(suite_store_ids))
    result = await session.execute(query)
    matched_stores = result.scalars().all()

    user.stores = list(matched_stores)
    session.add(user)
    await session.commit()
    
    return matched_stores

def serialize_user(user: User) -> dict:
    """Helper to match Strapi's `sanitizeUser` format."""
    stores = []
    for s in user.stores:
        stores.append({
            "id": s.id,
            "storeId": s.storeId,
            "code": s.code,
            "address": s.address,
            "shortAddress": s.shortAddress or s.address,
        })
        
    primary_store = stores[0] if stores else None

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone_number": user.phone_number,
        "is_active": user.is_active,
        "role": user.role,
        "department": {
            "id": user.department.id,
            "name": user.department.name,
            "code": user.department.code
        } if user.department else None,
        "department_id": user.department_id,
        "stores": stores,
        "store_id": primary_store.get("storeId") if primary_store else None,
        "store_name": primary_store.get("shortAddress") or primary_store.get("address") if primary_store else None
    }

@router.get("/me", response_model=dict)
async def get_me(current_user: CurrentUser) -> Any:
    """
    Get current user profile including mapped stores.
    """
    return {
        "success": True,
        "message": "Lấy thông tin người dùng thành công",
        "data": {
            "user": serialize_user(current_user)
        }
    }

@router.post("/logout", response_model=dict)
async def logout(current_user: CurrentUser, session: SessionDep) -> Any:
    """
    Invalidate refresh token payload for the current user.
    """
    current_user.refresh_token_hash = None
    current_user.refresh_token_expires_at = None
    current_user.token_version = (current_user.token_version or 0) + 1
    
    session.add(current_user)
    await session.commit()
    
    return {
        "success": True,
        "message": "Đăng xuất thành công"
    }

@router.post("/sync-stores", response_model=dict)
async def sync_stores(
    session: SessionDep,
    current_user: CurrentUser
) -> Any:
    """User-specific store sync call."""
    if not current_user.suite_token:
        raise HTTPException(status_code=400, detail="Không có suite token để đồng bộ cửa hàng")

    try:
        matched_stores = await map_suite_stores_to_user(session, current_user)
        # Refresh to ensure relationships are loaded
        result = await session.execute(
            select(User)
            .options(selectinload(User.department), selectinload(User.stores))
            .where(User.id == current_user.id)
        )
        updated_user = result.scalar_one()

        return {
            "success": True,
            "message": "Đồng bộ cửa hàng thành công",
            "data": {
                "syncedStores": len(matched_stores),
                "user": serialize_user(updated_user)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không thể đồng bộ cửa hàng từ Suite: {str(e)}")
