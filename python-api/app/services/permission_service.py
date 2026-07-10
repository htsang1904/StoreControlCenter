from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission import Permission, RoleGroup, RolePermission

ROLE_VALUES = ("admin", "store", "handler", "qc")
DEFAULT_ROLES = {
    "admin": {"name": "Admin", "description": "Toàn quyền cấu hình và vận hành hệ thống."},
    "store": {"name": "Cửa hàng", "description": "Tạo và theo dõi ticket theo cửa hàng được gán."},
    "handler": {"name": "Bộ phận xử lý", "description": "Tiếp nhận, phản hồi và xử lý ticket."},
    "qc": {"name": "QC", "description": "Theo dõi và quản lý nghiệp vụ kiểm soát chất lượng."},
}

DEFAULT_PERMISSIONS = [
    {"code": "users.read", "name": "Xem nhân viên", "group": "Nhân viên"},
    {"code": "users.update", "name": "Cập nhật nhân viên", "group": "Nhân viên"},
    {"code": "users.delete", "name": "Xoá nhân viên", "group": "Nhân viên"},
    {"code": "departments.read", "name": "Xem bộ phận", "group": "Bộ phận"},
    {"code": "departments.manage", "name": "Quản lý bộ phận", "group": "Bộ phận"},
    {"code": "permissions.read", "name": "Xem quyền", "group": "Phân quyền"},
    {"code": "permissions.manage", "name": "Quản lý quyền", "group": "Phân quyền"},
    {"code": "stores.manage", "name": "Quản lý cửa hàng", "group": "Cửa hàng"},
    {"code": "tickets.manage", "name": "Quản lý ticket", "group": "Ticket"},
    {"code": "tickets.create", "name": "Tạo ticket", "group": "Ticket"},
    {"code": "tickets.read", "name": "Xem ticket", "group": "Ticket"},
    {"code": "tickets.reply", "name": "Phản hồi ticket", "group": "Ticket"},
    {"code": "tickets.claim", "name": "Nhận xử lý ticket", "group": "Ticket"},
    {"code": "tickets.resolve", "name": "Đánh dấu xử lý ticket", "group": "Ticket"},
    {"code": "tickets.reopen", "name": "Mở lại ticket", "group": "Ticket"},
    {"code": "qc.read", "name": "Xem QC", "group": "QC"},
    {"code": "qc.manage", "name": "Quản lý QC", "group": "QC"},
]

DEFAULT_ROLE_PERMISSIONS = {
    "admin": [permission["code"] for permission in DEFAULT_PERMISSIONS],
    "handler": ["tickets.read", "tickets.reply", "tickets.claim", "tickets.resolve"],
    "store": ["tickets.create", "tickets.read", "tickets.reply", "tickets.reopen"],
    "qc": ["qc.read", "qc.manage", "tickets.read"],
}


def normalize_role(role: str | None) -> str:
    value = getattr(role, "value", role)
    return str(value or "").strip().lower()


async def seed_default_permissions(session: AsyncSession) -> bool:
    changed = False
    existing_result = await session.execute(select(Permission))
    existing_by_code = {permission.code: permission for permission in existing_result.scalars().all()}

    for item in DEFAULT_PERMISSIONS:
        permission = existing_by_code.get(item["code"])
        if not permission:
            session.add(Permission(
                code=item["code"],
                name=item["name"],
                group=item["group"],
                description=item.get("description"),
                is_active=True,
            ))
            changed = True
        else:
            if permission.name != item["name"] or permission.group != item["group"]:
                permission.name = item["name"]
                permission.group = item["group"]
                session.add(permission)
                changed = True

    role_permission_result = await session.execute(select(RolePermission))
    existing_pairs = {
        (normalize_role(row.role), row.permission_code)
        for row in role_permission_result.scalars().all()
    }

    for role, permission_codes in DEFAULT_ROLE_PERMISSIONS.items():
        for permission_code in permission_codes:
            pair = (role, permission_code)
            if pair in existing_pairs:
                continue
            session.add(RolePermission(role=role, permission_code=permission_code))
            changed = True

    role_result = await session.execute(select(RoleGroup))
    existing_roles = {role.code: role for role in role_result.scalars().all()}
    for code, meta in DEFAULT_ROLES.items():
        role = existing_roles.get(code)
        if not role:
            session.add(RoleGroup(code=code, name=meta["name"], description=meta["description"], is_active=True))
            changed = True
        elif role.name != meta["name"] or role.description != meta["description"]:
            role.name = meta["name"]
            role.description = meta["description"]
            session.add(role)
            changed = True

    if changed:
        await session.commit()
    return changed


async def get_role_permissions(session: AsyncSession, role: str | None) -> list[str]:
    normalized_role = normalize_role(role)
    if not normalized_role:
        return []

    result = await session.execute(
        select(RolePermission.permission_code)
        .join(Permission, Permission.code == RolePermission.permission_code)
        .where(RolePermission.role == normalized_role, Permission.is_active == True)
    )
    permission_codes = [str(row[0]) for row in result.all()]
    if permission_codes:
        return permission_codes
    return list(DEFAULT_ROLE_PERMISSIONS.get(normalized_role, []))


async def user_has_permission(session: AsyncSession, user, permission_code: str) -> bool:
    role = normalize_role(getattr(user, "role", None))
    if role == "admin":
        return True
    return permission_code in await get_role_permissions(session, role)


async def replace_role_permissions(session: AsyncSession, role: str, permission_codes: list[str]) -> list[str]:
    normalized_role = normalize_role(role)
    if not normalized_role:
        raise ValueError("role không hợp lệ")

    unique_codes = []
    seen = set()
    for code in permission_codes:
        normalized_code = str(code or "").strip()
        if not normalized_code or normalized_code in seen:
            continue
        seen.add(normalized_code)
        unique_codes.append(normalized_code)

    if normalized_role == "admin" and "permissions.manage" not in unique_codes:
        unique_codes.append("permissions.manage")

    if unique_codes:
        result = await session.execute(select(Permission.code).where(Permission.code.in_(unique_codes)))
        existing_codes = {row[0] for row in result.all()}
        missing_codes = [code for code in unique_codes if code not in existing_codes]
        if missing_codes:
            raise ValueError(f"Quyền không tồn tại: {', '.join(missing_codes)}")

    await session.execute(delete(RolePermission).where(RolePermission.role == normalized_role))
    for code in unique_codes:
        session.add(RolePermission(role=normalized_role, permission_code=code))
    await session.commit()
    return unique_codes
