"""
Admin Permissions Management APIs.
"""
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy.future import select

from app.api.deps import CurrentUser, SessionDep
from app.models.permission import Permission, RoleGroup, RolePermission
from app.services.permission_service import get_role_permissions, replace_role_permissions

router = APIRouter()


def _require_admin(current_user: CurrentUser) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền quản lý phân quyền")


def _serialize_permission(permission: Permission) -> dict:
    return {
        "id": permission.id,
        "code": permission.code,
        "name": permission.name,
        "group": permission.group,
        "description": permission.description,
        "is_active": bool(permission.is_active),
        "isActive": bool(permission.is_active),
    }

def _serialize_role(role: RoleGroup, permissions: list[str] | None = None) -> dict:
    return {
        "id": role.id,
        "code": role.code,
        "name": role.name,
        "description": role.description,
        "is_active": bool(role.is_active),
        "isActive": bool(role.is_active),
        "permissions": permissions or [],
    }


@router.get("/", response_model=dict)
async def list_admin_permissions(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(
        select(Permission).order_by(Permission.group.asc(), Permission.code.asc())
    )
    permissions = result.scalars().all()

    return {
        "success": True,
        "data": {
            "items": [_serialize_permission(permission) for permission in permissions],
        },
    }


@router.post("/", response_model=dict)
async def create_admin_permission(
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    code = str(payload.get("code") or "").strip()
    name = str(payload.get("name") or "").strip()
    group = str(payload.get("group") or "").strip()
    description = str(payload.get("description") or "").strip() or None

    if not code:
        raise HTTPException(status_code=400, detail="code là bắt buộc")
    if not name:
        raise HTTPException(status_code=400, detail="name là bắt buộc")
    if not group:
        raise HTTPException(status_code=400, detail="group là bắt buộc")

    existing = await session.execute(select(Permission).where(Permission.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Mã quyền '{code}' đã tồn tại")

    permission = Permission(
        code=code,
        name=name,
        group=group,
        description=description,
        is_active=bool(payload.get("is_active", payload.get("isActive", True))),
    )
    session.add(permission)
    roles = payload.get("roles") if isinstance(payload.get("roles"), list) else []
    for role in roles:
        normalized_role = str(role or "").strip().lower()
        session.add(RolePermission(role=normalized_role, permission_code=code))
    await session.commit()
    await session.refresh(permission)

    return {"success": True, "data": {"item": _serialize_permission(permission)}}


@router.put("/actions/{permission_id}", response_model=dict)
async def update_admin_permission(
    permission_id: int,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(Permission).where(Permission.id == permission_id))
    permission = result.scalar_one_or_none()
    if not permission:
        raise HTTPException(status_code=404, detail="Không tìm thấy quyền")

    if "code" in payload:
        code = str(payload.get("code") or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="code không được để trống")
        existing = await session.execute(
            select(Permission).where(Permission.code == code, Permission.id != permission.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Mã quyền '{code}' đã tồn tại")
        old_code = permission.code
        permission.code = code
        await session.flush()
        role_permission_result = await session.execute(
            select(RolePermission).where(RolePermission.permission_code == old_code)
        )
        for row in role_permission_result.scalars().all():
            row.permission_code = code
            session.add(row)

    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="name không được để trống")
        permission.name = name

    if "group" in payload:
        group = str(payload.get("group") or "").strip()
        if not group:
            raise HTTPException(status_code=400, detail="group không được để trống")
        permission.group = group

    if "description" in payload:
        permission.description = str(payload.get("description") or "").strip() or None

    if "is_active" in payload:
        if not isinstance(payload.get("is_active"), bool):
            raise HTTPException(status_code=400, detail="is_active phải là boolean")
        permission.is_active = payload["is_active"]
    elif "isActive" in payload:
        if not isinstance(payload.get("isActive"), bool):
            raise HTTPException(status_code=400, detail="isActive phải là boolean")
        permission.is_active = payload["isActive"]

    session.add(permission)
    await session.commit()
    await session.refresh(permission)

    return {"success": True, "data": {"item": _serialize_permission(permission)}}


@router.get("/roles", response_model=dict)
async def list_admin_role_permissions(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(RoleGroup).order_by(RoleGroup.id.asc()))
    role_items = result.scalars().all()
    roles = {}
    items = []
    for role in role_items:
        permissions = await get_role_permissions(session, role.code)
        roles[role.code] = permissions
        items.append(_serialize_role(role, permissions))

    if not role_items:
        for role in ("admin", "store", "handler", "qc"):
            roles[role] = await get_role_permissions(session, role)

    return {"success": True, "data": {"roles": roles, "items": items}}


@router.post("/roles", response_model=dict)
async def create_admin_role(
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    code = str(payload.get("code") or "").strip().lower()
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip() or None
    permission_codes = payload.get("permissions") if isinstance(payload.get("permissions"), list) else []

    if not code:
        raise HTTPException(status_code=400, detail="code là bắt buộc")
    if not name:
        raise HTTPException(status_code=400, detail="name là bắt buộc")

    existing = await session.execute(select(RoleGroup).where(RoleGroup.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Mã nhóm quyền '{code}' đã tồn tại")

    role = RoleGroup(code=code, name=name, description=description, is_active=bool(payload.get("is_active", payload.get("isActive", True))))
    session.add(role)
    await session.flush()
    permissions = await replace_role_permissions(session, code, permission_codes)
    await session.refresh(role)

    return {"success": True, "data": {"item": _serialize_role(role, permissions)}}


@router.put("/roles/{role}", response_model=dict)
async def update_admin_role_permissions(
    role: str,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    normalized_role = str(role or "").strip().lower()
    role_result = await session.execute(select(RoleGroup).where(RoleGroup.code == normalized_role))
    role_item = role_result.scalar_one_or_none()
    if not role_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhóm quyền")

    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="name không được để trống")
        role_item.name = name
    if "description" in payload:
        role_item.description = str(payload.get("description") or "").strip() or None
    if "is_active" in payload:
        role_item.is_active = bool(payload.get("is_active"))

    permission_codes = payload.get("permissions") if isinstance(payload.get("permissions"), list) else None

    try:
        next_permissions = await replace_role_permissions(session, normalized_role, permission_codes) if permission_codes is not None else await get_role_permissions(session, normalized_role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    session.add(role_item)
    await session.commit()

    return {
        "success": True,
        "message": "Đã cập nhật quyền",
        "data": {
            "role": normalized_role,
            "permissions": next_permissions,
            "item": _serialize_role(role_item, next_permissions),
        },
    }
