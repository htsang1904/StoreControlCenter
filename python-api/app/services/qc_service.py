from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.datetime_utils import parse_datetime_to_utc_naive, utc_now_naive
from app.models.qc_session import QCDraft
from app.models.user import User
from app.schemas.qc import (
    QCDraftCreateRequest,
    QCDraftData,
    QCDraftListResponse,
    QCDraftSingleResponse,
    QCDraftUpdateRequest,
    QCSessionCreateRequest,
    SuccessMessageResponse,
)


def parse_iso_datetime(value: object, fallback: datetime | None = None) -> datetime:
    return parse_datetime_to_utc_naive(value, fallback=fallback)


def serialize_qc_draft(draft: QCDraft) -> QCDraftData:
    audited_at = draft.audited_at
    created_at = draft.created_at
    updated_at = draft.updated_at
    criteria_states = draft.criteria_states or {}
    return QCDraftData(
        id=draft.id,
        store_id=draft.store_id,
        storeId=draft.store_id,
        auditor_id=draft.auditor_id,
        auditorId=draft.auditor_id,
        template_id=draft.template_id,
        templateId=draft.template_id,
        audited_at=audited_at,
        auditedAt=audited_at,
        note=draft.note,
        criteria_states=criteria_states,
        criteriaStates=criteria_states,
        created_at=created_at,
        createdAt=created_at,
        updated_at=updated_at,
        updatedAt=updated_at,
    )


def assert_store_access(current_user: User, store_id: int) -> None:
    if current_user.role == "admin":
        return
    user_store_ids = {
        s.id for s in (current_user.stores or []) if getattr(s, "id", None) is not None
    }
    if store_id not in user_store_ids:
        raise HTTPException(
            status_code=403,
            detail="Không có quyền thao tác nháp cho cửa hàng này",
        )


async def list_qc_drafts(
    session: AsyncSession,
    current_user: User,
    store_id: int | None,
    page: int,
    page_size: int,
) -> QCDraftListResponse:
    filters = [QCDraft.auditor_id == current_user.id]
    if store_id:
        filters.append(QCDraft.store_id == store_id)

    query = (
        select(QCDraft)
        .where(and_(*filters))
        .order_by(QCDraft.updated_at.desc(), QCDraft.id.desc())
    )
    count_query = select(func.count()).select_from(QCDraft).where(and_(*filters))

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    skip = (page - 1) * page_size
    result = await session.execute(query.offset(skip).limit(page_size))
    drafts = result.scalars().all()
    serialized_drafts = [serialize_qc_draft(d) for d in drafts]
    page_count = (total + page_size - 1) // page_size if page_size > 0 else 0

    return QCDraftListResponse(
        success=True,
        data=serialized_drafts,
        pagination={
            "page": page,
            "pageSize": page_size,
            "total": total,
            "pageCount": page_count,
        },
    )


async def get_qc_draft_by_id(
    session: AsyncSession,
    current_user: User,
    draft_id: int,
) -> QCDraftSingleResponse:
    query = select(QCDraft).where(QCDraft.id == draft_id)
    result = await session.execute(query)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Phiếu nháp không tồn tại")

    if current_user.role != "admin" and draft.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập phiếu nháp này")

    return QCDraftSingleResponse(success=True, data=serialize_qc_draft(draft))


async def create_qc_draft(
    session: AsyncSession,
    current_user: User,
    payload: QCDraftCreateRequest,
) -> QCDraftSingleResponse:
    template_id = str(payload.template_id or "").strip()
    if not template_id:
        raise HTTPException(status_code=400, detail="templateId/template_id là bắt buộc")

    assert_store_access(current_user, payload.store_id)

    draft = QCDraft(
        store_id=payload.store_id,
        auditor_id=current_user.id,
        template_id=template_id,
        audited_at=parse_iso_datetime(payload.audited_at),
        note=str(payload.note or ""),
        criteria_states=payload.criteria_states or {},
    )
    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    return QCDraftSingleResponse(success=True, data=serialize_qc_draft(draft))


async def update_qc_draft(
    session: AsyncSession,
    current_user: User,
    draft_id: int,
    payload: QCDraftUpdateRequest,
) -> QCDraftSingleResponse:
    query = select(QCDraft).where(QCDraft.id == draft_id)
    result = await session.execute(query)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Phiếu nháp không tồn tại")

    if current_user.role != "admin" and draft.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền cập nhật phiếu nháp này")

    data = payload.model_dump(exclude_unset=True)

    if "store_id" in data and data["store_id"] is not None:
        assert_store_access(current_user, int(data["store_id"]))
        draft.store_id = int(data["store_id"])

    if "template_id" in data:
        template_id = str(data.get("template_id") or "").strip()
        if not template_id:
            raise HTTPException(status_code=400, detail="templateId/template_id không hợp lệ")
        draft.template_id = template_id

    if "audited_at" in data:
        draft.audited_at = parse_iso_datetime(data.get("audited_at"), fallback=draft.audited_at)

    if "note" in data:
        draft.note = str(data.get("note") or "")

    if "criteria_states" in data:
        draft.criteria_states = data.get("criteria_states") or {}

    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    return QCDraftSingleResponse(success=True, data=serialize_qc_draft(draft))


async def delete_qc_draft(
    session: AsyncSession,
    current_user: User,
    draft_id: int,
) -> SuccessMessageResponse:
    query = select(QCDraft).where(QCDraft.id == draft_id)
    result = await session.execute(query)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Phiếu nháp không tồn tại")

    if current_user.role != "admin" and draft.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xóa phiếu nháp này")

    await session.delete(draft)
    await session.commit()
    return SuccessMessageResponse(success=True, message="Xóa phiếu nháp thành công")


def build_qc_session_create_payload(
    current_user: User,
    qc_session_in: QCSessionCreateRequest,
) -> tuple[dict[str, object], list[dict[str, object]]]:
    data = qc_session_in.model_dump()
    items_data = data.pop("criteria", [])

    data["auditor_id"] = current_user.id
    data["code"] = f"QC-{utc_now_naive().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
    data["audited_at"] = parse_iso_datetime(data.get("audited_at"))

    return data, items_data
