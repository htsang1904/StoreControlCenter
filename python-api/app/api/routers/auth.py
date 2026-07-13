from datetime import timedelta
from typing import Any
import jwt
import hashlib
import logging
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete as sa_delete, insert as sa_insert
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core import security
from app.core.config import settings
from app.core.datetime_utils import utc_now_naive
from app.api.deps import SessionDep, CurrentUser
from app.models.user import User, user_stores
from app.models.org import Store
from app.schemas.user import LoginRequest, RefreshRequest, SsoCallbackRequest, AuthTokensResponse, UserResponse
from app.services.permission_service import DEFAULT_ROLE_PERMISSIONS, get_role_permissions, normalize_role

router = APIRouter()
logger = logging.getLogger("app.auth")

# Strapi compatibility logic ported from Node.js
# -----------------------------------------------

def hash_refresh_token(token: str) -> str:
    # Use SECRET_KEY as salt for refresh token hashing if no specific salt is defined
    salt = settings.SECRET_KEY
    return hashlib.sha256(f"{token}{salt}".encode()).hexdigest()

def resolve_staff_role(staff: dict) -> str:
    roles = staff.get("roles") if isinstance(staff.get("roles"), list) else []
    permissions = staff.get("permissions") if isinstance(staff.get("permissions"), list) else []
    normalized_roles = set()
    for role in roles:
        if isinstance(role, dict):
            value = role.get("code") or role.get("name") or role.get("role") or role.get("key") or role.get("slug")
        else:
            value = role
        if value:
            normalized_roles.add(str(value).strip().lower())
    normalized_permissions = {str(permission).strip().lower() for permission in permissions if permission}
    explicit_role = str(staff.get("role") or "").strip().lower()
    if explicit_role in {"admin", "qc", "handler", "store"}:
        return explicit_role
    if "admin" in explicit_role:
        return "admin"
    for role in ("admin", "qc", "handler", "store"):
        if any(item == role or item.endswith(f".{role}") or role in item for item in normalized_roles):
            return role
    if any("admin" in permission for permission in normalized_permissions):
        return "admin"
    return "store"

def serialize_role(role: object) -> str:
    return str(role.value if hasattr(role, "value") else role).strip().lower()

def suite_staff_id_from_profile(profile: dict) -> str:
    return str(profile.get("id") or profile.get("staff_id") or "").strip()

def suite_staff_ref_from_profile(profile: dict) -> str | None:
    staff_id = str(profile.get("id") or profile.get("staff_id") or "").strip()
    return f"staff:{staff_id}" if staff_id else None

async def issue_auth_tokens(session: AsyncSession, user: User) -> dict:
    next_token_version = (user.token_version or 0) + 1
    access_payload = {"sub": str(user.id), "email": user.email, "tokenVersion": next_token_version, "type": "access"}
    access_token = security.create_access_token(
        user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        data=access_payload,
    )
    refresh_payload = {"sub": str(user.id), "tokenVersion": next_token_version, "type": "refresh"}
    refresh_token = security.create_access_token(
        user.id,
        expires_delta=timedelta(days=30),
        data=refresh_payload,
    )

    user.token_version = next_token_version
    user.refresh_token_hash = hash_refresh_token(refresh_token)
    user.refresh_token_expires_at = utc_now_naive() + timedelta(days=30)
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return {
        "tokenType": "Bearer",
        "accessToken": access_token,
        "refreshToken": refresh_token,
    }

async def map_staff_stores_to_user(session: AsyncSession, user: User, stores_payload: list | None) -> list:
    if not isinstance(stores_payload, list):
        return []

    suite_store_refs = []
    for store in stores_payload:
        if not isinstance(store, dict):
            continue
        for key in ("id", "storeId", "store_id", "code"):
            value = store.get(key)
            if value:
                suite_store_refs.append(str(value).strip())

    if not suite_store_refs:
        await session.execute(sa_delete(user_stores).where(user_stores.c.user_id == user.id))
        await session.commit()
        return []

    query = select(Store).where(
        (Store.storeId.in_(suite_store_refs)) |
        (Store.code.in_(suite_store_refs))
    )
    result = await session.execute(query)
    matched_stores = result.scalars().all()
    await session.execute(sa_delete(user_stores).where(user_stores.c.user_id == user.id))
    if matched_stores:
        await session.execute(
            sa_insert(user_stores),
            [{"user_id": user.id, "store_id": store.id} for store in matched_stores],
        )
    await session.commit()
    return matched_stores

async def upsert_staff_user(session: AsyncSession, staff: dict, suite_token: str | None = None) -> User:
    email = str(staff.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="SSO staff thiếu email")

    suite_staff_id = suite_staff_id_from_profile(staff)
    suite_staff_ref = suite_staff_ref_from_profile(staff)

    if not suite_staff_id:
        raise HTTPException(status_code=400, detail="SSO staff thiếu mã nhân viên")

    result = await session.execute(select(User).where(User.suite_staff_id == suite_staff_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            name=staff.get("name") or staff.get("username") or email,
            email=email,
            suite_staff_id=suite_staff_id,
            phone_number=staff.get("phone_number") or staff.get("phone"),
            suite_token=suite_staff_ref or suite_token,
            token_version=0,
            role="store",
            is_active=False,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    else:
        user.name = staff.get("name") or user.name
        user.email = email
        user.suite_staff_id = suite_staff_id
        user.phone_number = staff.get("phone_number") or staff.get("phone") or user.phone_number
        user.suite_token = suite_staff_ref or suite_token or user.suite_token
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return user

def verify_suite_token_if_enabled(token: str) -> None:
    """
    Verify Suite token signature when security hardening is enabled.
    Disabled by default for compatibility with legacy local environments.
    """
    if not settings.SUITE_VERIFY_TOKEN:
        return

    key_file = settings.SUITE_PUBLIC_KEY_FILE.strip()
    if not key_file:
        raise HTTPException(
            status_code=500,
            detail="Thiếu cấu hình SUITE_PUBLIC_KEY_FILE khi bật SUITE_VERIFY_TOKEN",
        )

    try:
        public_key = Path(key_file).read_text(encoding="utf-8")
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="Không thể đọc public key của Suite",
        )

    try:
        jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_signature": True, "verify_aud": False},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Thông tin đăng nhập không chính xác")

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

    verify_suite_token_if_enabled(request.token)

    email = str(suite_user.get("email") or "").strip().lower()
    suite_staff_id = suite_staff_id_from_profile(suite_user)
    suite_staff_ref = suite_staff_ref_from_profile(suite_user)
    if not suite_staff_id:
        raise HTTPException(status_code=400, detail="Thiếu mã nhân viên từ Suite")

    query = select(User).where(User.suite_staff_id == suite_staff_id)
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        # Create user if logging in for the first time
        assigned_role = suite_user.get("role", "store")
        if assigned_role not in ["store", "handler", "qc", "admin"]:
            assigned_role = "store"

        user = User(
            name=suite_user.get("name", ""),
            email=email,
            suite_staff_id=suite_staff_id,
            phone_number=suite_user.get("phone_number") or suite_user.get("phone"),
            suite_token=suite_staff_ref or request.token,
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
        user.email = email
        user.suite_staff_id = suite_staff_id
        user.phone_number = suite_user.get("phone_number") or suite_user.get("phone") or user.phone_number
        user.suite_token = suite_staff_ref or request.token
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
    user.refresh_token_expires_at = utc_now_naive() + timedelta(days=30)
    user.suite_token = suite_staff_ref or request.token
    
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

@router.post("/sso/callback", response_model=dict)
async def sso_callback(
    session: SessionDep,
    request: SsoCallbackRequest,
) -> Any:
    """Exchange a single-use Suite SSO ticket for local auth tokens."""
    ticket = str(request.ticket or "").strip()
    if not ticket:
        raise HTTPException(status_code=400, detail="Thiếu SSO ticket")
    if not settings.SUITE_PLATFORM_TOKEN:
        raise HTTPException(status_code=500, detail="Thiếu cấu hình SUITE_PLATFORM_TOKEN")

    verify_url = urljoin(settings.SUITE_API, "/platform/v1/sso/verify")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                verify_url,
                json={"ticket": ticket},
                headers={"Authorization": f"Bearer {settings.SUITE_PLATFORM_TOKEN}"},
            )
            payload = response.json()
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.json().get("message") if exc.response.content else None
        raise HTTPException(status_code=400, detail=detail or "SSO ticket không hợp lệ hoặc đã hết hạn")
    except Exception as exc:
        logger.warning(f"[auth] SSO verify failed: {exc}")
        raise HTTPException(status_code=502, detail="Không thể xác thực SSO với Suite")

    if not payload.get("success"):
        raise HTTPException(status_code=400, detail=payload.get("message") or "SSO ticket không hợp lệ hoặc đã hết hạn")

    staff = payload.get("staff") or payload.get("data") or {}
    if not isinstance(staff, dict):
        raise HTTPException(status_code=400, detail="Dữ liệu staff SSO không hợp lệ")

    user = await upsert_staff_user(session, staff)
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Tài khoản chưa được cấp quyền. Vui lòng liên hệ IT để được cấp quyền truy cập.",
        )

    await map_staff_stores_to_user(session, user, staff.get("stores"))
    tokens = await issue_auth_tokens(session, user)

    return {
        "success": True,
        "message": "Đăng nhập thành công",
        "data": tokens,
    }

@router.post("/refresh", response_model=dict)
async def refresh_token(
    session: SessionDep, request: RefreshRequest
) -> Any:
    # Similar to strapi `/refresh` endpoint
    try:
        payload = jwt.decode(
            request.refreshToken,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ hoặc đã hết hạn")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token không đúng loại refresh token")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")
    
    # Retrieve User
    query = select(User).where(User.id == user_id)
    user = (await session.execute(query)).scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Tài khoản không hợp lệ")
        
    if user.refresh_token_hash != hash_refresh_token(request.refreshToken):
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")
    if user.refresh_token_expires_at and user.refresh_token_expires_at < utc_now_naive():
        raise HTTPException(status_code=401, detail="Refresh token đã hết hạn")

    token_version = payload.get("tokenVersion")
    if token_version is not None and user.token_version is not None:
        try:
            token_version = int(token_version)
        except (TypeError, ValueError):
            raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")
        if token_version != int(user.token_version):
            raise HTTPException(status_code=401, detail="Refresh token đã bị vô hiệu hóa")
        
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
    user.refresh_token_expires_at = utc_now_naive() + timedelta(days=30)
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
    Fetch current staff stores from Suite Platform API and link them to the local User record.
    """
    suite_staff_ref = str(user.suite_token or "").strip()
    staff_id = suite_staff_ref.removeprefix("staff:").strip() if suite_staff_ref.startswith("staff:") else ""
    if not staff_id:
        logger.warning(f"[auth] sync suite stores skipped for user {user.id}: missing Suite staff id")
        return []
    if not settings.SUITE_PLATFORM_TOKEN:
        raise HTTPException(status_code=500, detail="Thiếu cấu hình SUITE_PLATFORM_TOKEN")

    url = urljoin(settings.SUITE_API, f"/platform/v1/staffs/{staff_id}/stores")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {settings.SUITE_PLATFORM_TOKEN}"}
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as e:
        # Log warning similar to Strapi
        logger.warning(f"[auth] sync suite stores failed for user {user.id}: {str(e)}")
        return []

    if not payload.get("success"):
        return []

    stores_payload = payload.get("stores") if isinstance(payload.get("stores"), list) else []
    matched_stores = await map_staff_stores_to_user(session, user, stores_payload)
    if not matched_stores:
        user.stores = []
        session.add(user)
        await session.commit()
    return matched_stores

def serialize_user(user: User, permissions: list[str] | None = None) -> dict:
    """Helper to match Strapi's `sanitizeUser` format."""
    role = serialize_role(user.role)
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
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "role": role,
        "permissions": permissions if permissions is not None else list(DEFAULT_ROLE_PERMISSIONS.get(normalize_role(role), [])),
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
async def get_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get current user profile including mapped stores.
    """
    permissions = await get_role_permissions(session, serialize_role(current_user.role))
    return {
        "success": True,
        "message": "Lấy thông tin người dùng thành công",
        "data": {
            "user": serialize_user(current_user, permissions)
        }
    }

@router.post("/me/avatar", response_model=dict)
async def update_my_avatar(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Avatar phải là file ảnh JPG, PNG, WEBP hoặc GIF")

    contents = await file.read()
    max_size = 5 * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="Avatar tối đa 5MB")

    extension = Path(file.filename or "avatar").suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        extension = ".jpg"

    upload_dir = "static/uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"user-{current_user.id}-{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as output:
        output.write(contents)

    current_user.avatar_url = f"/static/uploads/avatars/{filename}"
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    permissions = await get_role_permissions(session, serialize_role(current_user.role))
    return {
        "success": True,
        "message": "Cập nhật avatar thành công",
        "data": {
            "user": serialize_user(current_user, permissions),
        },
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
    suite_staff_ref = str(current_user.suite_token or "").strip()
    if not suite_staff_ref.startswith("staff:"):
        raise HTTPException(status_code=400, detail="Không có Suite staff id để đồng bộ cửa hàng")

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
                "user": serialize_user(updated_user, await get_role_permissions(session, serialize_role(updated_user.role)))
            }
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không thể đồng bộ cửa hàng từ Suite: {str(e)}")
