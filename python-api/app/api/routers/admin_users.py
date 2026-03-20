"""
Admin Users Management APIs
Endpoints under /api/admin/users for listing and updating user accounts.
"""
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, SessionDep
from app.models.org import Department, Store
from app.models.user import User, UserRole

router = APIRouter()

ROLE_VALUES = {"admin", "store", "handler", "qc"}


def _require_admin(current_user: CurrentUser) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền quản lý nhân viên")


def _normalize_role(role_value: Any) -> str:
    if isinstance(role_value, UserRole):
        return role_value.value
    return str(role_value or "").strip().lower()


def _serialize_user(user: User) -> dict:
    stores = [
        {
            "id": store.id,
            "code": store.code,
            "name": store.name,
            "address": store.address,
            "shortAddress": store.shortAddress,
            "storeId": store.storeId,
            "brandId": store.brandId,
            "is_active": bool(store.is_active),
            "isActive": bool(store.is_active),
        }
        for store in (user.stores or [])
    ]
    primary_store = stores[0] if stores else None
    department = None
    if user.department:
        department = {
            "id": user.department.id,
            "name": user.department.name,
            "code": user.department.code,
            "is_active": bool(user.department.is_active),
        }

    return {
        "id": user.id,
        "name": user.name or "",
        "email": user.email,
        "phone_number": user.phone_number,
        "is_active": bool(user.is_active),
        "role": _normalize_role(user.role),
        "department_id": user.department_id,
        "department": department,
        "stores": stores,
        "store_id": primary_store["storeId"] if primary_store else None,
        "store_name": primary_store["shortAddress"] if primary_store else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


async def _count_other_active_admins(session: SessionDep, excluded_user_id: int) -> int:
    count_result = await session.execute(
        select(func.count())
        .select_from(User)
        .where(
            User.role == UserRole.admin,
            User.is_active == True,
            User.id != excluded_user_id,
        )
    )
    return int(count_result.scalar() or 0)


@router.get("/", response_model=dict)
async def list_admin_users(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    pageSize: int = Query(12, ge=1, le=200),
    q: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    isActive: Optional[bool] = Query(None),
    departmentId: Optional[int] = Query(None),
) -> Any:
    _require_admin(current_user)

    skip = (page - 1) * pageSize
    filters: List[Any] = []

    if q and q.strip():
        keyword = f"%{q.strip()}%"
        filters.append(
            or_(
                User.name.ilike(keyword),
                User.email.ilike(keyword),
                User.phone_number.ilike(keyword),
            )
        )

    if role and role.strip():
        normalized_role = role.strip().lower()
        if normalized_role not in ROLE_VALUES:
            raise HTTPException(status_code=400, detail="role không hợp lệ")
        filters.append(User.role == normalized_role)

    if isActive is not None:
        filters.append(User.is_active == bool(isActive))

    if departmentId is not None:
        filters.append(User.department_id == departmentId)

    query = (
        select(User)
        .options(selectinload(User.department), selectinload(User.stores))
        .order_by(User.created_at.desc(), User.id.desc())
    )
    count_query = select(func.count()).select_from(User)

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = int((await session.execute(count_query)).scalar() or 0)
    page_count = (total + pageSize - 1) // pageSize if pageSize > 0 else 1

    result = await session.execute(query.offset(skip).limit(pageSize))
    users = result.scalars().all()

    return {
        "success": True,
        "data": {
            "items": [_serialize_user(user) for user in users],
            "pagination": {
                "page": page,
                "pageSize": pageSize,
                "total": total,
                "pageCount": page_count,
            },
        },
    }


@router.get("/{user_id}", response_model=dict)
async def get_admin_user_detail(
    user_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(
        select(User)
        .options(selectinload(User.department), selectinload(User.stores))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")

    return {"success": True, "data": {"item": _serialize_user(user)}}


@router.put("/{user_id}", response_model=dict)
async def update_admin_user(
    user_id: int,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(
        select(User)
        .options(selectinload(User.department), selectinload(User.stores))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên")

    next_role = _normalize_role(user.role)
    next_is_active = bool(user.is_active)

    if "role" in payload:
        candidate_role = _normalize_role(payload.get("role"))
        if candidate_role not in ROLE_VALUES:
            raise HTTPException(status_code=400, detail="role không hợp lệ")
        next_role = candidate_role

    if "is_active" in payload:
        if not isinstance(payload.get("is_active"), bool):
            raise HTTPException(status_code=400, detail="is_active phải là boolean")
        next_is_active = payload["is_active"]

    if user.role == UserRole.admin and (next_role != "admin" or not next_is_active):
        other_active_admins = await _count_other_active_admins(session, user.id)
        if other_active_admins <= 0:
            raise HTTPException(
                status_code=400,
                detail="Hệ thống phải luôn có ít nhất một admin đang hoạt động",
            )

    if "name" in payload:
        user.name = str(payload.get("name") or "").strip()

    if "phone_number" in payload:
        phone_number = str(payload.get("phone_number") or "").strip()
        user.phone_number = phone_number or None

    if "role" in payload:
        user.role = UserRole(next_role)

    if "is_active" in payload:
        user.is_active = next_is_active

    if "department_id" in payload:
        raw_department_id = payload.get("department_id")
        if raw_department_id in (None, "", 0):
            user.department_id = None
        else:
            try:
                department_id = int(raw_department_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="department_id không hợp lệ")

            department_result = await session.execute(
                select(Department).where(Department.id == department_id)
            )
            department = department_result.scalar_one_or_none()
            if not department:
                raise HTTPException(status_code=400, detail="Bộ phận không tồn tại")
            user.department_id = department.id

    if "store_ids" in payload:
        raw_store_ids = payload.get("store_ids")
        if not isinstance(raw_store_ids, list):
            raise HTTPException(status_code=400, detail="store_ids phải là mảng số")

        normalized_store_ids: List[int] = []
        seen = set()
        for item in raw_store_ids:
            try:
                store_id = int(item)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="store_ids chứa giá trị không hợp lệ")
            if store_id <= 0 or store_id in seen:
                continue
            seen.add(store_id)
            normalized_store_ids.append(store_id)

        if normalized_store_ids:
            stores_result = await session.execute(
                select(Store).where(Store.id.in_(normalized_store_ids))
            )
            stores = stores_result.scalars().all()
            matched_ids = {store.id for store in stores}
            missing_ids = [store_id for store_id in normalized_store_ids if store_id not in matched_ids]
            if missing_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cửa hàng không tồn tại: {', '.join(str(item) for item in missing_ids)}",
                )
            user.stores = list(stores)
        else:
            user.stores = []

    session.add(user)
    await session.commit()

    refresh_result = await session.execute(
        select(User)
        .options(selectinload(User.department), selectinload(User.stores))
        .where(User.id == user.id)
    )
    refreshed_user = refresh_result.scalar_one()

    return {"success": True, "data": {"item": _serialize_user(refreshed_user)}}
