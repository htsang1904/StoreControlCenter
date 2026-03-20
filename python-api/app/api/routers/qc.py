import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, and_, case
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, CurrentUser
from app.models.qc_session import QCSession, QCSessionItem, QCDraft, QCFinding
from app.models.qc_form import QCForm, QCFormVersion, QCCriterion, QCFormCriterion
from app.models.org import Store

router = APIRouter()

def _parse_iso_datetime(value: Any, fallback: Optional[datetime] = None) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            pass
    return (fallback or datetime.now(timezone.utc)).replace(tzinfo=None)

def _serialize_qc_draft(draft: QCDraft) -> dict:
    audited_at_iso = draft.audited_at.isoformat() if draft.audited_at else None
    created_at_iso = draft.created_at.isoformat() if draft.created_at else None
    updated_at_iso = draft.updated_at.isoformat() if draft.updated_at else None
    criteria_states = draft.criteria_states or {}

    return {
        "id": draft.id,
        "store_id": draft.store_id,
        "storeId": draft.store_id,
        "auditor_id": draft.auditor_id,
        "auditorId": draft.auditor_id,
        "template_id": draft.template_id,
        "templateId": draft.template_id,
        "audited_at": audited_at_iso,
        "auditedAt": audited_at_iso,
        "note": draft.note,
        "criteria_states": criteria_states,
        "criteriaStates": criteria_states,
        "created_at": created_at_iso,
        "createdAt": created_at_iso,
        "updated_at": updated_at_iso,
        "updatedAt": updated_at_iso,
    }

def _assert_store_access(current_user: CurrentUser, store_id: int) -> None:
    if current_user.role == "admin":
        return
    user_store_ids = {s.id for s in (current_user.stores or []) if getattr(s, "id", None) is not None}
    if store_id not in user_store_ids:
        raise HTTPException(status_code=403, detail="Không có quyền thao tác nháp cho cửa hàng này")

def _serialize_qc_form_detail(form: QCForm) -> dict:
    versions = sorted(form.versions, key=lambda v: v.id, reverse=True) if form.versions else []
    published = [v for v in versions if v.status == "published"]
    active_version = published[0] if published else (versions[0] if versions else None)

    criteria = []
    if active_version and active_version.form_criteria:
        criteria_rows = [fc.criterion for fc in active_version.form_criteria if fc.criterion]
        criteria_rows.sort(key=lambda c: (c.ordering or "", c.id))
        for criterion in criteria_rows:
            criteria.append(
                {
                    "id": criterion.id,
                    "code": criterion.code,
                    "name": criterion.name,
                    "description": criterion.description,
                    "level": criterion.level,
                    "ordering": criterion.ordering,
                    "parentId": criterion.parent_id,
                    "mode": criterion.default_mode,
                    "maxScore": float(criterion.default_max_score or 0),
                    "sortOrder": criterion.id,
                }
            )

    return {
        "id": form.id,
        "code": form.code,
        "name": form.name,
        "description": form.description,
        "activeVersionId": active_version.id if active_version else None,
        "version": active_version.version_no if active_version else None,
        "passThreshold": (active_version.pass_rule or {}).get("passThreshold", 40) if active_version else 40,
        "criteria": criteria,
    }

@router.get("/drafts", response_model=dict)
async def read_qc_drafts(
    session: SessionDep,
    current_user: CurrentUser,
    store_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500, alias="pageSize"),
) -> Any:
    """Read all QC drafts for current auditor."""
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
    serialized_drafts = [_serialize_qc_draft(d) for d in drafts]
    page_count = (total + page_size - 1) // page_size if page_size > 0 else 0

    return {
        "success": True, 
        "data": serialized_drafts,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "pageCount": page_count
        }
    }

@router.get("/drafts/{id}", response_model=dict)
async def read_qc_draft_by_id(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    query = select(QCDraft).where(QCDraft.id == id)
    result = await session.execute(query)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Phiếu nháp không tồn tại")

    if current_user.role != "admin" and draft.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập phiếu nháp này")

    return {"success": True, "data": _serialize_qc_draft(draft)}

@router.post("/drafts", response_model=dict)
async def create_qc_draft(
    session: SessionDep,
    current_user: CurrentUser,
    qc_draft_in: Any,
) -> Any:
    payload = qc_draft_in if isinstance(qc_draft_in, dict) else qc_draft_in.model_dump()
    store_id_raw = payload.get("storeId", payload.get("store_id"))
    template_id_raw = payload.get("templateId", payload.get("template_id"))

    try:
        store_id = int(store_id_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="storeId/store_id không hợp lệ")

    template_id = str(template_id_raw or "").strip()
    if not template_id:
        raise HTTPException(status_code=400, detail="templateId/template_id là bắt buộc")

    _assert_store_access(current_user, store_id)

    draft = QCDraft(
        store_id=store_id,
        auditor_id=current_user.id,
        template_id=template_id,
        audited_at=_parse_iso_datetime(payload.get("auditedAt", payload.get("audited_at"))),
        note=str(payload.get("note", "") or ""),
        criteria_states=payload.get("criteriaStates", payload.get("criteria_states")) or {},
    )
    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    return {"success": True, "data": _serialize_qc_draft(draft)}

@router.put("/drafts/{id}", response_model=dict)
async def update_qc_draft(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    qc_draft_in: Any,
) -> Any:
    query = select(QCDraft).where(QCDraft.id == id)
    result = await session.execute(query)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Phiếu nháp không tồn tại")

    if current_user.role != "admin" and draft.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền cập nhật phiếu nháp này")

    payload = qc_draft_in if isinstance(qc_draft_in, dict) else qc_draft_in.model_dump()

    if "storeId" in payload or "store_id" in payload:
        store_id_raw = payload.get("storeId", payload.get("store_id"))
        try:
            next_store_id = int(store_id_raw)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="storeId/store_id không hợp lệ")
        _assert_store_access(current_user, next_store_id)
        draft.store_id = next_store_id

    if "templateId" in payload or "template_id" in payload:
        template_id = str(payload.get("templateId", payload.get("template_id")) or "").strip()
        if not template_id:
            raise HTTPException(status_code=400, detail="templateId/template_id không hợp lệ")
        draft.template_id = template_id

    if "auditedAt" in payload or "audited_at" in payload:
        draft.audited_at = _parse_iso_datetime(
            payload.get("auditedAt", payload.get("audited_at")),
            fallback=draft.audited_at,
        )

    if "note" in payload:
        draft.note = str(payload.get("note") or "")

    if "criteriaStates" in payload or "criteria_states" in payload:
        draft.criteria_states = payload.get("criteriaStates", payload.get("criteria_states")) or {}

    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    return {"success": True, "data": _serialize_qc_draft(draft)}

@router.delete("/drafts/{id}", response_model=dict)
async def delete_qc_draft(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    query = select(QCDraft).where(QCDraft.id == id)
    result = await session.execute(query)
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Phiếu nháp không tồn tại")

    if current_user.role != "admin" and draft.auditor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xóa phiếu nháp này")

    await session.delete(draft)
    await session.commit()
    return {"success": True, "message": "Xóa phiếu nháp thành công"}

from app.schemas.qc import QCSessionResponse, QCSessionCreate, QCSessionDetailResponse, QCFormResponse

@router.get("/forms", response_model=dict)
async def read_qc_forms(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read all active QC forms."""
    query = select(QCForm).where(QCForm.is_active == True)
    result = await session.execute(query)
    items = result.scalars().all()
    serialized_items = [QCFormResponse.model_validate(item) for item in items]
    return {"success": True, "data": serialized_items}

@router.get("/forms/{id}", response_model=dict)
async def read_qc_form(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read QC form details including criteria."""
    query = (
        select(QCForm)
        .where(QCForm.id == id)
        .options(
            selectinload(QCForm.versions)
            .selectinload(QCFormVersion.form_criteria)
            .selectinload(QCFormCriterion.criterion)
        )
    )
    result = await session.execute(query)
    form = result.scalar_one_or_none()
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
        
    return {"success": True, "data": _serialize_qc_form_detail(form)}

@router.get("/sessions/overview", response_model=dict)
async def read_qc_sessions_overview(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    pageSize: Optional[int] = Query(None, ge=1, le=100),
    status: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    template_id: Optional[str] = Query(None),
) -> Any:
    """Overview of QC sessions with summary metrics."""
    effective_page_size = pageSize or page_size

    # 1. Base Query Filters
    filters = []
    if status == "pass":
        filters.append(QCSession.result == "pass")
    elif status == "fail":
        filters.append(QCSession.result == "fail")

    if date_from:
        parsed_from = _parse_iso_datetime(date_from)
        if isinstance(date_from, str) and "T" not in date_from:
            parsed_from = parsed_from.replace(hour=0, minute=0, second=0, microsecond=0)
        filters.append(QCSession.audited_at >= parsed_from)

    if date_to:
        parsed_to = _parse_iso_datetime(date_to)
        if isinstance(date_to, str) and "T" not in date_to:
            parsed_to = parsed_to.replace(hour=23, minute=59, second=59, microsecond=999999)
        filters.append(QCSession.audited_at <= parsed_to)

    keyword = str(q or "").strip()
    if keyword:
        like_q = f"%{keyword}%"
        filters.append(
            or_(
                QCSession.code.ilike(like_q),
                QCSession.note.ilike(like_q),
                Store.code.ilike(like_q),
                Store.shortAddress.ilike(like_q),
                Store.address.ilike(like_q),
                QCForm.code.ilike(like_q),
                QCForm.name.ilike(like_q),
            )
        )

    template_keyword = str(template_id or "").strip()
    if template_keyword:
        template_filters = [
            QCForm.code.ilike(f"%{template_keyword}%"),
            QCForm.name.ilike(f"%{template_keyword}%"),
        ]
        if template_keyword.isdigit():
            numeric_template = int(template_keyword)
            template_filters.append(QCForm.id == numeric_template)
            template_filters.append(QCFormVersion.id == numeric_template)
        filters.append(or_(*template_filters))

    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(QCSession.store_id.in_(user_store_ids))
    elif store_id:
        filters.append(QCSession.store_id == store_id)

    # 2. Fetch Sessions with Pagination
    base_condition = and_(*filters) if filters else True

    query = (
        select(QCSession)
        .join(Store, QCSession.store_id == Store.id, isouter=True)
        .join(QCFormVersion, QCSession.form_version_id == QCFormVersion.id, isouter=True)
        .join(QCForm, QCFormVersion.form_id == QCForm.id, isouter=True)
        .options(
            selectinload(QCSession.store),
            selectinload(QCSession.auditor),
            selectinload(QCSession.form_version).selectinload(QCFormVersion.form),
            selectinload(QCSession.items)
        )
        .where(base_condition)
        .order_by(QCSession.created_at.desc())
    )
    
    # Total Count for Pagination
    count_query = (
        select(func.count())
        .select_from(QCSession)
        .join(Store, QCSession.store_id == Store.id, isouter=True)
        .join(QCFormVersion, QCSession.form_version_id == QCFormVersion.id, isouter=True)
        .join(QCForm, QCFormVersion.form_id == QCForm.id, isouter=True)
        .where(base_condition)
    )
    total_res = await session.execute(count_query)
    total_count = total_res.scalar() or 0
    
    # Paging
    query = query.limit(effective_page_size).offset((page - 1) * effective_page_size)
    result = await session.execute(query)
    sessions = result.scalars().all()
    
    # 3. Aggregate Summary (Total, Passed, Failed, Avg Score)
    summary_query = select(
        func.count(QCSession.id).label("total"),
        func.sum(case((QCSession.result == 'pass', 1), else_=0)).label("passed"),
        func.sum(case((QCSession.result == 'fail', 1), else_=0)).label("failed"),
        func.avg(QCSession.total_score).label("avg_score"),
        func.avg(QCSession.max_score).label("avg_max_score"),
    ).select_from(QCSession).join(
        Store, QCSession.store_id == Store.id, isouter=True
    ).join(
        QCFormVersion, QCSession.form_version_id == QCFormVersion.id, isouter=True
    ).join(
        QCForm, QCFormVersion.form_id == QCForm.id, isouter=True
    ).where(base_condition)
    
    summary_res = await session.execute(summary_query)
    summary_data = summary_res.first()
    
    total_sessions = summary_data.total or 0
    passed = summary_data.passed or 0
    failed = summary_data.failed or 0
    avg_score = float(summary_data.avg_score or 0)
    avg_max_score = float(summary_data.avg_max_score or 0)
    score_rate = (avg_score / avg_max_score * 100) if avg_max_score > 0 else 0
    
    return {
        "success": True,
        "data": [QCSessionResponse.model_validate(s) for s in sessions],
        "summary": {
            "totalSessions": total_sessions,
            "passed": passed,
            "failed": failed,
            "avgScore": round(avg_score, 1),
            "scoreRate": round(score_rate, 1)
        },
        "pagination": {
            "page": page,
            "pageSize": effective_page_size,
            "total": total_count,
            "pageCount": (total_count + effective_page_size - 1) // effective_page_size
        }
    }

@router.post("/sessions/create", response_model=dict)
async def create_qc_session(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    qc_session_in: Any
) -> Any:
    """Create a new QC Session with items."""
    data = qc_session_in if isinstance(qc_session_in, dict) else qc_session_in.model_dump()
    
    items_data = data.pop("criteria", [])
    
    data["auditor_id"] = current_user.id
    if "auditedAt" in data:
        data["audited_at"] = data.pop("auditedAt")
    if "formVersionId" in data:
        data["form_version_id"] = data.pop("formVersionId")
        
    data["code"] = f"QC-{datetime.now(timezone.utc).strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
    data["audited_at"] = datetime.fromisoformat(data["audited_at"].replace("Z", "+00:00")).replace(tzinfo=None) if isinstance(data.get("audited_at"), str) else data.get("audited_at", datetime.now(timezone.utc))
        
    qc_session = QCSession(**data)
    session.add(qc_session)
    await session.flush()
    
    for item_in in items_data:
        item_obj = QCSessionItem(
            session_id=qc_session.id,
            criterion_id=item_in.get("id") if isinstance(item_in.get("id"), int) else None,
            criterion_name=item_in.get("name", ""),
            mode_snapshot=item_in.get("mode", "point"),
            max_score_snapshot=item_in.get("maxScore", 0),
            result=item_in.get("status", "pending"),
            score=item_in.get("score"),
            applicable=item_in.get("applicable", item_in.get("status") not in {"na", "skipped_weekly"}),
            requires_fix=item_in.get("requires_fix", item_in.get("status") == "fail"),
            note=item_in.get("note"),
            attachments=item_in.get("attachments")
        )
        session.add(item_obj)
        
    await session.commit()
    
    # Reload with details
    query = select(QCSession).options(
        selectinload(QCSession.store),
        selectinload(QCSession.auditor),
        selectinload(QCSession.form_version).selectinload(QCFormVersion.form)
    ).where(QCSession.id == qc_session.id)
    result = await session.execute(query)
    qc_session = result.scalar_one()

    return {"success": True, "data": QCSessionResponse.model_validate(qc_session)}

@router.get("/stores/overview", response_model=dict)
async def read_qc_stores_overview(
    session: SessionDep,
    current_user: CurrentUser,
    q: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    store_ids: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    pageSize: Optional[int] = Query(None, ge=1, le=500),
    sort_by: str = Query("totalSessions"),
    sortBy: Optional[str] = Query(None),
    sort_dir: str = Query("desc"),
    sortDir: Optional[str] = Query(None),
) -> Any:
    """Get QC overview aggregated by store."""
    effective_page_size = pageSize or page_size
    effective_sort_by = sortBy or sort_by
    effective_sort_dir = sortDir or sort_dir

    # 1. Base Query for Sessions
    query = select(QCSession).options(selectinload(QCSession.store))
    
    # 2. Filtering
    filters = []
    if date_from:
        filters.append(QCSession.audited_at >= datetime.fromisoformat(date_from.replace("Z", "+00:00")).replace(tzinfo=None))
    if date_to:
        filters.append(QCSession.audited_at <= datetime.fromisoformat(date_to.replace("Z", "+00:00")).replace(hour=23, minute=59, second=59, tzinfo=None))
        
    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(QCSession.store_id.in_(user_store_ids))
    elif store_ids:
        ids = [int(i.strip()) for i in store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(QCSession.store_id.in_(ids))

    # Apply filters to session subset
    session_query = select(QCSession).where(and_(*filters)) if filters else select(QCSession)
    
    # 3. Aggregation Logic
    # We'll use a subquery or join for better performance
    agg_query = (
        select(
            QCSession.store_id,
            func.count(QCSession.id).label("totalSessions"),
            func.sum(case((QCSession.result == 'pass', 1), else_=0)).label("passed"),
            func.sum(case((QCSession.result == 'fail', 1), else_=0)).label("failed"),
            func.sum(QCSession.total_score).label("totalScore"),
            func.sum(QCSession.max_score).label("maxScore"),
            func.max(QCSession.audited_at).label("lastAuditedAt")
        )
        .where(and_(*filters) if filters else True)
        .group_by(QCSession.store_id)
    )
    
    agg_results = await session.execute(agg_query)
    agg_data = {r.store_id: r for r in agg_results.all()}
    
    # 4. Fetch Stores with Search
    store_query = select(Store)
    if q:
        search_filter = or_(
            Store.name.ilike(f"%{q}%"),
            Store.code.ilike(f"%{q}%"),
            Store.shortAddress.ilike(f"%{q}%"),
            Store.address.ilike(f"%{q}%"),
            Store.storeId.ilike(f"%{q}%")
        )
        store_query = store_query.where(search_filter)
        
    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores]
        store_query = store_query.where(Store.id.in_(user_store_ids))
    elif store_ids:
        ids = [int(i.strip()) for i in store_ids.split(",") if i.strip().isdigit()]
        if ids:
            store_query = store_query.where(Store.id.in_(ids))

    # Final list of stores to report on
    all_stores_res = await session.execute(store_query)
    all_stores = all_stores_res.scalars().all()
    
    # 5. Compute Metrics
    store_stats = []
    summary_metrics = {"totalSessions": 0, "passed": 0, "failed": 0, "totalScore": 0, "maxScore": 0}
    
    for s in all_stores:
        agg = agg_data.get(s.id)
        if not agg:
            if q: continue # Skip stores with no sessions if searching? Strapi doesn't skip but we might.
            stat = {
                "storeId": s.id, "storeCode": s.code, "storeNo": s.storeId,
                "storeName": s.shortAddress or s.name, "totalSessions": 0, "passed": 0, "failed": 0,
                "avgScore": 0, "scoreRate": 0, "avgScoreRate": 0, "passRate": 0, "lastAuditedAt": None
            }
        else:
            totalS = agg.totalSessions
            passed = agg.passed
            failed = agg.failed
            tScore = float(agg.totalScore or 0)
            mScore = float(agg.maxScore or 0)
            
            summary_metrics["totalSessions"] += totalS
            summary_metrics["passed"] += passed
            summary_metrics["failed"] += failed
            summary_metrics["totalScore"] += tScore
            summary_metrics["maxScore"] += mScore
            
            stat = {
                "storeId": s.id,
                "storeCode": s.code,
                "storeNo": s.storeId,
                "storeName": s.shortAddress or s.name,
                "totalSessions": totalS,
                "passed": passed,
                "failed": failed,
                "avgScore": round(tScore / totalS, 1) if totalS > 0 else 0,
                "scoreRate": round((tScore / mScore * 100), 1) if mScore > 0 else 0,
                "avgScoreRate": round((tScore / mScore * 100), 1) if mScore > 0 else 0,
                "passRate": round((passed / totalS * 100)) if totalS > 0 else 0,
                "lastAuditedAt": agg.lastAuditedAt.isoformat() if agg.lastAuditedAt else None
            }
        store_stats.append(stat)

    # 6. Sorting
    reverse = str(effective_sort_dir or "desc").lower() != "asc"
    sort_field_map = {
        "avgScoreRate": "scoreRate",
        "lastAuditAt": "lastAuditedAt",
    }
    sort_field = sort_field_map.get(effective_sort_by, effective_sort_by)
    store_stats.sort(key=lambda x: (x.get(sort_field) if x.get(sort_field) is not None else 0), reverse=reverse)
    
    # 7. Pagination
    total = len(store_stats)
    start = (page - 1) * effective_page_size
    paged_stats = store_stats[start:start + effective_page_size]
    
    # Summary calculation
    summary = {
        "totalSessions": summary_metrics["totalSessions"],
        "passed": summary_metrics["passed"],
        "failed": summary_metrics["failed"],
        "avgScore": round(summary_metrics["totalScore"] / summary_metrics["totalSessions"], 1) if summary_metrics["totalSessions"] > 0 else 0,
        "scoreRate": round((summary_metrics["totalScore"] / summary_metrics["maxScore"] * 100), 1) if summary_metrics["maxScore"] > 0 else 0,
        "avgScoreRate": round((summary_metrics["totalScore"] / summary_metrics["maxScore"] * 100), 1) if summary_metrics["maxScore"] > 0 else 0,
        "passRate": round((summary_metrics["passed"] / summary_metrics["totalSessions"] * 100)) if summary_metrics["totalSessions"] > 0 else 0,
    }

    return {
        "success": True,
        "message": "Lấy thống kê QC theo cửa hàng thành công",
        "data": paged_stats,
        "summary": summary,
        "pagination": {
            "page": page,
            "pageSize": effective_page_size,
            "total": total,
            "pageCount": (total + effective_page_size - 1) // effective_page_size
        }
    }

@router.post("/sessions/{id}/submit", response_model=dict)
async def submit_qc_session(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Submit a QC session, finalize score/result and generate findings."""
    query = select(QCSession).options(
        selectinload(QCSession.items),
        selectinload(QCSession.form_version).selectinload(QCFormVersion.form)
    ).where(QCSession.id == id)
    result = await session.execute(query)
    qc_session = result.scalar_one_or_none()
    
    if not qc_session:
        raise HTTPException(status_code=404, detail="Phiên QC không tồn tại")
        
    if qc_session.status == "closed":
        return {"success": True, "message": "Phiên QC đã được đóng trước đó", "data": QCSessionResponse.model_validate(qc_session)}

    items = qc_session.items
    total_score = 0
    max_score = 0
    failed_count = 0
    
    for item in items:
        if item.result == "na" or item.result == "skipped_weekly":
            continue
            
        if item.mode_snapshot == "point":
            total_score += float(item.score or 0)
            max_score += float(item.max_score_snapshot or 0)
        else:
            max_score += 1
            if item.result == "pass":
                total_score += 1
                
        if item.result == "fail":
            failed_count += 1
            
    # Determine result based on threshold (default 40% as per Strapi)
    pass_threshold = 40
    if qc_session.form_version and qc_session.form_version.pass_rule:
        pass_threshold = qc_session.form_version.pass_rule.get("passThreshold", 40)
        
    score_rate = (total_score / max_score * 100) if max_score > 0 else 0
    is_pass = (failed_count == 0) and (score_rate >= pass_threshold)
    
    qc_session.total_score = total_score
    qc_session.max_score = max_score
    qc_session.result = "pass" if is_pass else "fail"
    qc_session.status = "closed" if is_pass else "needs_fix"
    qc_session.submitted_at = datetime.now(timezone.utc)
    
    session.add(qc_session)
    
    # Generate findings for failed items
    new_findings = []
    if not is_pass:
        for item in items:
            if item.result == "fail" and item.requires_fix:
                timestamp = datetime.now(timezone.utc).strftime("%y%m%d%H%M%S")
                random_part = uuid.uuid4().hex[:4].upper()
                finding_code = f"QCF-{timestamp}-{random_part}"
                
                finding = QCFinding(
                    finding_code=finding_code,
                    session_id=qc_session.id,
                    session_item_id=item.id,
                    store_id=qc_session.store_id,
                    criterion_name=item.criterion_name,
                    severity="medium", # Default
                    status="open",
                    due_date=datetime.now(timezone.utc) + timedelta(days=3) # Default 3 days
                )
                session.add(finding)
                new_findings.append(finding_code)
                
    await session.commit()
    await session.refresh(qc_session)
    
    return {
        "success": True, 
        "message": "Submit phiên QC thành công", 
        "data": QCSessionResponse.model_validate(qc_session),
        "generated_findings": new_findings,
        "metrics": {
            "total_score": total_score,
            "max_score": max_score,
            "score_rate": score_rate,
            "pass_threshold": pass_threshold,
            "failed_count": failed_count
        }
    }
