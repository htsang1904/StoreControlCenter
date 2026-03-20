"""
Admin Stores Management APIs
Endpoints under /api/admin/stores for list/create/update stores.
"""
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, func, or_
from sqlalchemy.future import select

from app.api.deps import CurrentUser, SessionDep
from app.models.org import Store
from app.models.qc_session import QCDraft, QCFinding, QCSession
from app.models.ticket import Ticket
from app.models.user import user_stores

router = APIRouter()


def _require_admin(current_user: CurrentUser) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền quản lý cửa hàng")


def _clean_text(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    return text or None


def _serialize_store(store: Store) -> dict:
    return {
        "id": store.id,
        "code": store.code,
        "name": store.name,
        "address": store.address,
        "shortAddress": store.shortAddress,
        "storeId": store.storeId,
        "brandId": store.brandId,
        "is_active": bool(store.is_active),
        "isActive": bool(store.is_active),
        "created_at": store.created_at.isoformat() if store.created_at else None,
        "updated_at": store.updated_at.isoformat() if store.updated_at else None,
    }


async def _count_store_business_references(session: SessionDep, store_id: int) -> dict:
    ticket_count = int((await session.execute(
        select(func.count())
        .select_from(Ticket)
        .where(Ticket.store_id == store_id)
    )).scalar() or 0)

    qc_session_count = int((await session.execute(
        select(func.count())
        .select_from(QCSession)
        .where(QCSession.store_id == store_id)
    )).scalar() or 0)

    qc_draft_count = int((await session.execute(
        select(func.count())
        .select_from(QCDraft)
        .where(QCDraft.store_id == store_id)
    )).scalar() or 0)

    qc_finding_count = int((await session.execute(
        select(func.count())
        .select_from(QCFinding)
        .where(QCFinding.store_id == store_id)
    )).scalar() or 0)

    return {
        "tickets": ticket_count,
        "qc_sessions": qc_session_count,
        "qc_drafts": qc_draft_count,
        "qc_findings": qc_finding_count,
    }


def _format_store_blocking_references(reference_counts: dict) -> str:
    labels = {
        "tickets": "ticket",
        "qc_sessions": "phiếu QC",
        "qc_drafts": "nháp QC",
        "qc_findings": "finding QC",
    }
    non_zero_parts = [
        f"{labels[key]}: {value}"
        for key, value in reference_counts.items()
        if int(value or 0) > 0
    ]
    return ", ".join(non_zero_parts)


@router.get("/", response_model=dict)
async def list_admin_stores(
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
                Store.code.ilike(keyword),
                Store.name.ilike(keyword),
                Store.address.ilike(keyword),
                Store.shortAddress.ilike(keyword),
                Store.storeId.ilike(keyword),
                Store.brandId.ilike(keyword),
            )
        )

    if isActive is not None:
        filters.append(Store.is_active == bool(isActive))

    query = select(Store).order_by(Store.updated_at.desc(), Store.id.desc())
    count_query = select(func.count()).select_from(Store)

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total = int((await session.execute(count_query)).scalar() or 0)
    page_count = (total + pageSize - 1) // pageSize if pageSize > 0 else 1

    result = await session.execute(query.offset(skip).limit(pageSize))
    stores = result.scalars().all()

    return {
        "success": True,
        "data": {
            "items": [_serialize_store(store) for store in stores],
            "pagination": {
                "page": page,
                "pageSize": pageSize,
                "total": total,
                "pageCount": page_count,
            },
        },
    }


@router.get("/{store_id}", response_model=dict)
async def get_admin_store_detail(
    store_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Không tìm thấy cửa hàng")

    return {"success": True, "data": {"item": _serialize_store(store)}}


@router.post("/", response_model=dict)
async def create_admin_store(
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    store_id_value = _clean_text(payload.get("storeId"))
    name = _clean_text(payload.get("name"))
    code = _clean_text(payload.get("code"))

    if not store_id_value:
        raise HTTPException(status_code=400, detail="storeId là bắt buộc")
    if not name:
        raise HTTPException(status_code=400, detail="name là bắt buộc")

    if code:
        code_result = await session.execute(select(Store).where(Store.code == code))
        if code_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Mã cửa hàng '{code}' đã tồn tại")

    store_id_result = await session.execute(select(Store).where(Store.storeId == store_id_value))
    if store_id_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"storeId '{store_id_value}' đã tồn tại")

    store = Store(
        storeId=store_id_value,
        name=name,
        code=code,
        address=_clean_text(payload.get("address")),
        shortAddress=_clean_text(payload.get("shortAddress")),
        brandId=_clean_text(payload.get("brandId")),
        is_active=bool(payload.get("is_active", payload.get("isActive", True))),
    )
    session.add(store)
    await session.commit()
    await session.refresh(store)

    return {"success": True, "data": {"item": _serialize_store(store)}}


@router.put("/{store_id}", response_model=dict)
async def update_admin_store(
    store_id: int,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Không tìm thấy cửa hàng")

    if "code" in payload:
        code = _clean_text(payload.get("code"))
        if code:
            code_result = await session.execute(
                select(Store).where(Store.code == code, Store.id != store.id)
            )
            if code_result.scalar_one_or_none():
                raise HTTPException(status_code=400, detail=f"Mã cửa hàng '{code}' đã tồn tại")
        store.code = code

    if "storeId" in payload:
        store_id_value = _clean_text(payload.get("storeId"))
        if not store_id_value:
            raise HTTPException(status_code=400, detail="storeId không được để trống")

        store_id_result = await session.execute(
            select(Store).where(Store.storeId == store_id_value, Store.id != store.id)
        )
        if store_id_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"storeId '{store_id_value}' đã tồn tại")
        store.storeId = store_id_value

    if "name" in payload:
        name = _clean_text(payload.get("name"))
        if not name:
            raise HTTPException(status_code=400, detail="name không được để trống")
        store.name = name

    if "address" in payload:
        store.address = _clean_text(payload.get("address"))

    if "shortAddress" in payload:
        store.shortAddress = _clean_text(payload.get("shortAddress"))

    if "brandId" in payload:
        store.brandId = _clean_text(payload.get("brandId"))

    if "is_active" in payload:
        if not isinstance(payload.get("is_active"), bool):
            raise HTTPException(status_code=400, detail="is_active phải là boolean")
        store.is_active = payload["is_active"]
    elif "isActive" in payload:
        if not isinstance(payload.get("isActive"), bool):
            raise HTTPException(status_code=400, detail="isActive phải là boolean")
        store.is_active = payload["isActive"]

    session.add(store)
    await session.commit()
    await session.refresh(store)

    return {"success": True, "data": {"item": _serialize_store(store)}}


@router.delete("/{store_id}", response_model=dict)
async def delete_admin_store(
    store_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    _require_admin(current_user)

    result = await session.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(status_code=404, detail="Không tìm thấy cửa hàng")

    reference_counts = await _count_store_business_references(session, store.id)
    blocking_detail = _format_store_blocking_references(reference_counts)
    if blocking_detail:
        raise HTTPException(
            status_code=409,
            detail=(
                "Không thể xóa cửa hàng vì còn dữ liệu nghiệp vụ liên quan "
                f"({blocking_detail}). Hãy khóa cửa hàng thay vì xóa."
            ),
        )

    await session.execute(delete(user_stores).where(user_stores.c.store_id == store.id))
    await session.delete(store)
    await session.commit()

    return {"success": True, "message": "Xóa cửa hàng thành công"}
