"""
Admin Departments Management APIs
Endpoints under /api/admin/departments for list/create/update departments.
"""
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.future import select

from app.api.deps import CurrentUser, SessionDep
from app.models.org import Department
from app.models.ticket import Ticket
from app.models.user import User

router = APIRouter()


def _require_admin(current_user: CurrentUser) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền quản lý bộ phận")


def _clean_text(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    return text or None


def _serialize_department(department: Department) -> dict:
    return {
        "id": department.id,
        "code": department.code,
        "name": department.name,
        "is_active": bool(department.is_active),
        "isActive": bool(department.is_active),
        "created_at": department.created_at.isoformat() if department.created_at else None,
        "updated_at": department.updated_at.isoformat() if department.updated_at else None,
    }


async def _count_department_references(session: SessionDep, department_id: int) -> dict:
    user_count = int((await session.execute(
        select(func.count())
        .select_from(User)
        .where(User.department_id == department_id)
    )).scalar() or 0)

    ticket_count = int((await session.execute(
        select(func.count())
        .select_from(Ticket)
        .where(Ticket.responsible_department_id == department_id)
    )).scalar() or 0)

    return {
        "users": user_count,
        "tickets": ticket_count,
    }


@router.get("/", response_model=dict)
async def list_admin_departments(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=500),
    q: Optional[str] = Query(None),
    isActive: Optional[bool] = Query(None),
) -> Any:
    _require_admin(current_user)

    skip = (page - 1) * pageSize
    filters: List[Any] = []

    if q and q.strip():
        keyword = f"%{q.strip()}%"
        filters.append(
            or_(
                Department.code.ilike(keyword),
                Department.name.ilike(keyword),
            )
        )

    if isActive is not None:
        filters.append(Department.is_active == bool(isActive))

    query = select(Department).order_by(Department.updated_at.desc(), Department.id.desc())
    count_query = select(func.count()).select_from(Department)

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = int((await session.execute(count_query)).scalar() or 0)
    page_count = (total + pageSize - 1) // pageSize if pageSize > 0 else 1

    result = await session.execute(query.offset(skip).limit(pageSize))
    departments = result.scalars().all()

    return {
        "success": True,
        "data": {
            "items": [_serialize_department(department) for department in departments],
            "pagination": {
                "page": page,
                "pageSize": pageSize,
                "total": total,
                "pageCount": page_count,
            },
        },
    }


@router.get("/{department_id}", response_model=dict)
async def get_admin_department_detail(
    department_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ phận")

    return {"success": True, "data": {"item": _serialize_department(department)}}


@router.post("/", response_model=dict)
async def create_admin_department(
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    name = _clean_text(payload.get("name"))
    code = _clean_text(payload.get("code"))

    if not name:
        raise HTTPException(status_code=400, detail="name là bắt buộc")
    if not code:
        raise HTTPException(status_code=400, detail="code là bắt buộc")

    code_result = await session.execute(select(Department).where(Department.code == code))
    if code_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Mã bộ phận '{code}' đã tồn tại")

    department = Department(
        name=name,
        code=code,
        is_active=bool(payload.get("is_active", payload.get("isActive", True))),
    )
    session.add(department)
    await session.commit()
    await session.refresh(department)

    return {"success": True, "data": {"item": _serialize_department(department)}}


@router.put("/{department_id}", response_model=dict)
async def update_admin_department(
    department_id: int,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ phận")

    if "code" in payload:
        code = _clean_text(payload.get("code"))
        if not code:
            raise HTTPException(status_code=400, detail="code không được để trống")

        code_result = await session.execute(
            select(Department).where(Department.code == code, Department.id != department.id)
        )
        if code_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Mã bộ phận '{code}' đã tồn tại")
        department.code = code

    if "name" in payload:
        name = _clean_text(payload.get("name"))
        if not name:
            raise HTTPException(status_code=400, detail="name không được để trống")
        department.name = name

    if "is_active" in payload:
        if not isinstance(payload.get("is_active"), bool):
            raise HTTPException(status_code=400, detail="is_active phải là boolean")
        department.is_active = payload["is_active"]
    elif "isActive" in payload:
        if not isinstance(payload.get("isActive"), bool):
            raise HTTPException(status_code=400, detail="isActive phải là boolean")
        department.is_active = payload["isActive"]

    session.add(department)
    await session.commit()
    await session.refresh(department)

    return {"success": True, "data": {"item": _serialize_department(department)}}


@router.delete("/{department_id}", response_model=dict)
async def delete_admin_department(
    department_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(Department).where(Department.id == department_id))
    department = result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ phận")

    reference_counts = await _count_department_references(session, department.id)
    if any(int(value or 0) > 0 for value in reference_counts.values()):
        department.is_active = False
        session.add(department)
        await session.commit()
        await session.refresh(department)
        return {
            "success": True,
            "message": "Bộ phận đang được sử dụng nên đã được chuyển sang trạng thái ngưng hoạt động",
            "data": {
                "item": _serialize_department(department),
                "references": reference_counts,
            },
        }

    await session.delete(department)
    await session.commit()

    return {"success": True, "message": "Đã xoá bộ phận"}
