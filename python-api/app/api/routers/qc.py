import uuid
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, and_, case
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.core.datetime_utils import utc_now_naive
from app.models.qc_session import QCSession, QCSessionItem, QCFinding
from app.models.qc_form import QCForm, QCFormVersion, QCCriterion, QCFormCriterion
from app.models.org import Store
from app.schemas.qc import (
    QCDraftCreateRequest,
    QCDraftListResponse,
    QCDraftSingleResponse,
    QCDraftUpdateRequest,
    QCSessionCreateRequest,
    QCSessionResponse,
    QCSessionDetailResponse,
    SuccessMessageResponse,
)
from app.services.qc_service import (
    assert_store_access,
    build_qc_session_create_payload,
    create_qc_draft as create_qc_draft_service,
    delete_qc_draft as delete_qc_draft_service,
    get_qc_draft_by_id as get_qc_draft_by_id_service,
    list_qc_drafts as list_qc_drafts_service,
    parse_iso_datetime,
    update_qc_draft as update_qc_draft_service,
)

router = APIRouter()


def _normalize_qc_item_status(value: object) -> str:
    status = str(value or "pending").strip().lower()
    return status if status in {"pending", "pass", "fail", "na", "skipped_weekly"} else "pending"


async def _load_submittable_form_version(
    session: SessionDep,
    form_version_id: int,
) -> QCFormVersion:
    query = (
        select(QCFormVersion)
        .where(QCFormVersion.id == form_version_id)
        .options(
            selectinload(QCFormVersion.form),
            selectinload(QCFormVersion.form_criteria).selectinload(QCFormCriterion.criterion),
        )
    )
    result = await session.execute(query)
    version = result.scalar_one_or_none()
    if not version or version.status == "draft" or not version.form or not version.form.is_active:
        raise HTTPException(status_code=400, detail="Phiên bản biểu mẫu QC không hợp lệ")
    return version


def _build_session_items_from_version(
    form_version: QCFormVersion,
    incoming_items: list[dict[str, object]],
) -> list[dict[str, object]]:
    version_criteria = [
        link.criterion for link in (form_version.form_criteria or []) if link.criterion
    ]
    criterion_ids = {criterion.id for criterion in version_criteria}
    parent_ids = {
        criterion.parent_id
        for criterion in version_criteria
        if criterion.parent_id and criterion.parent_id in criterion_ids
    }
    leaf_criteria = [
        criterion for criterion in version_criteria if criterion.id not in parent_ids
    ]
    leaf_criteria.sort(key=lambda criterion: (criterion.ordering or "", criterion.id))

    incoming_by_id: dict[int, dict[str, object]] = {}
    for item in incoming_items:
        raw_id = item.get("id")
        if raw_id is None:
            continue
        try:
            criterion_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        incoming_by_id[criterion_id] = item

    expected_ids = {criterion.id for criterion in leaf_criteria}
    incoming_ids = set(incoming_by_id.keys())
    extra_ids = incoming_ids - expected_ids
    missing_ids = expected_ids - incoming_ids
    if extra_ids:
        raise HTTPException(status_code=400, detail="Tiêu chí gửi lên không thuộc phiên bản biểu mẫu QC đang áp dụng")
    if missing_ids:
        raise HTTPException(status_code=400, detail="Chưa gửi đủ tiêu chí của biểu mẫu QC đang áp dụng")

    session_items = []
    for criterion in leaf_criteria:
        incoming = incoming_by_id[criterion.id]
        mode = criterion.default_mode or "point"
        status = _normalize_qc_item_status(incoming.get("status"))
        max_score = float(criterion.default_max_score or 0)
        deduction_percent = float(criterion.default_deduction_percent or 0)

        raw_score = incoming.get("score")
        score = None
        if raw_score is not None and str(raw_score) != "":
            try:
                score = max(min(float(raw_score), max_score), 0)
            except (TypeError, ValueError):
                score = None

        session_items.append(
            {
                "criterion_id": criterion.id,
                "criterion_code": criterion.code,
                "criterion_name": criterion.name,
                "mode_snapshot": mode,
                "max_score_snapshot": deduction_percent if mode == "deduction" else max_score,
                "min_pass_score_snapshot": float(criterion.default_min_pass_score or 0),
                "result": status,
                "score": score if mode == "point" else None,
                "applicable": incoming.get("applicable", status not in {"na", "skipped_weekly"}),
                "requires_fix": incoming.get("requires_fix", status == "fail"),
                "note": incoming.get("note"),
                "attachments": incoming.get("attachments"),
            }
        )

    return session_items

def _serialize_qc_form_detail(form: QCForm, form_version_id: Optional[int] = None) -> dict:
    versions = sorted(form.versions, key=lambda v: v.id, reverse=True) if form.versions else []
    published = [v for v in versions if v.status == "published"]
    requested_version = next((v for v in versions if v.id == form_version_id), None) if form_version_id else None
    active_version = requested_version or (published[0] if published else (versions[0] if versions else None))

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
                    "deductionPercent": float(criterion.default_deduction_percent or 0),
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

@router.get("/drafts", response_model=QCDraftListResponse)
async def read_qc_drafts(
    session: SessionDep,
    current_user: CurrentUser,
    store_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500, alias="pageSize"),
) -> QCDraftListResponse:
    """Read all QC drafts for current auditor."""
    return await list_qc_drafts_service(
        session=session,
        current_user=current_user,
        store_id=store_id,
        page=page,
        page_size=page_size,
    )


@router.get("/drafts/{id}", response_model=QCDraftSingleResponse)
async def read_qc_draft_by_id(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> QCDraftSingleResponse:
    return await get_qc_draft_by_id_service(
        session=session,
        current_user=current_user,
        draft_id=id,
    )


@router.post("/drafts", response_model=QCDraftSingleResponse)
async def create_qc_draft(
    session: SessionDep,
    current_user: CurrentUser,
    qc_draft_in: QCDraftCreateRequest,
) -> QCDraftSingleResponse:
    return await create_qc_draft_service(
        session=session,
        current_user=current_user,
        payload=qc_draft_in,
    )


@router.put("/drafts/{id}", response_model=QCDraftSingleResponse)
async def update_qc_draft(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    qc_draft_in: QCDraftUpdateRequest,
) -> QCDraftSingleResponse:
    return await update_qc_draft_service(
        session=session,
        current_user=current_user,
        draft_id=id,
        payload=qc_draft_in,
    )


@router.delete("/drafts/{id}", response_model=SuccessMessageResponse)
async def delete_qc_draft(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> SuccessMessageResponse:
    return await delete_qc_draft_service(
        session=session,
        current_user=current_user,
        draft_id=id,
    )

@router.get("/forms", response_model=dict)
async def read_qc_forms(
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, object]:
    """Read all active QC forms."""
    query = (
        select(QCForm)
        .where(QCForm.is_active == True)
        .options(selectinload(QCForm.versions))
    )
    result = await session.execute(query)
    items = result.scalars().all()
    serialized_items = []
    for item in items:
        versions = sorted(item.versions or [], key=lambda version: version.id, reverse=True)
        active_version = next((version for version in versions if version.status == "published"), None)
        if not active_version:
            continue
        serialized_items.append(
            {
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "description": item.description,
                "is_active": item.is_active,
                "activeVersionId": active_version.id,
                "version": active_version.version_no,
                "passThreshold": (active_version.pass_rule or {}).get("passThreshold", 40),
            }
        )
    return {"success": True, "data": serialized_items}

@router.get("/forms/{id}", response_model=dict)
async def read_qc_form(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    form_version_id: Optional[int] = Query(None, alias="formVersionId"),
) -> dict[str, object]:
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
        
    if form_version_id and not any(version.id == form_version_id for version in (form.versions or [])):
        raise HTTPException(status_code=404, detail="Phiên bản biểu mẫu QC không tồn tại")

    return {"success": True, "data": _serialize_qc_form_detail(form, form_version_id=form_version_id)}

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
) -> dict[str, object]:
    """Overview of QC sessions with summary metrics."""
    effective_page_size = pageSize or page_size

    # 1. Base Query Filters
    filters = []
    if status == "pass":
        filters.append(QCSession.result == "pass")
    elif status == "fail":
        filters.append(QCSession.result == "fail")

    if date_from:
        parsed_from = parse_iso_datetime(date_from)
        if isinstance(date_from, str) and "T" not in date_from:
            parsed_from = parsed_from.replace(hour=0, minute=0, second=0, microsecond=0)
        filters.append(QCSession.audited_at >= parsed_from)

    if date_to:
        parsed_to = parse_iso_datetime(date_to)
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

@router.get("/sessions/{id}", response_model=dict)
async def read_qc_session(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, object]:
    """Read a specific QC session with its items."""
    query = (
        select(QCSession)
        .where(QCSession.id == id)
        .options(
            selectinload(QCSession.store),
            selectinload(QCSession.auditor),
            selectinload(QCSession.form_version).selectinload(QCFormVersion.form),
            selectinload(QCSession.items),
            selectinload(QCSession.findings)
        )
    )
    result = await session.execute(query)
    qc_session = result.scalar_one_or_none()
    
    if not qc_session:
        raise HTTPException(status_code=404, detail="Phiên QC không tồn tại")
        
    # Additional access check: if user is store role, they must be assigned to this store.
    if current_user.role != "admin" and qc_session.store_id:
        store_ids = [s.id for s in current_user.stores]
        if qc_session.store_id not in store_ids:
            raise HTTPException(status_code=403, detail="Không có quyền truy cập phiên QC này")
            
    return {"success": True, "data": QCSessionDetailResponse.model_validate(qc_session)}

@router.post("/sessions/create", response_model=dict)
async def create_qc_session(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    qc_session_in: QCSessionCreateRequest
) -> dict[str, object]:
    """Create a new QC Session with items."""
    data, items_data = build_qc_session_create_payload(
        current_user=current_user,
        qc_session_in=qc_session_in,
    )
    assert_store_access(current_user, int(data["store_id"]))
    form_version = await _load_submittable_form_version(session, int(data["form_version_id"]))
    session_items = _build_session_items_from_version(form_version, items_data)

    qc_session = QCSession(**data)
    session.add(qc_session)
    await session.flush()
    
    for item_in in session_items:
        item_obj = QCSessionItem(
            session_id=qc_session.id,
            criterion_id=item_in.get("criterion_id"),
            criterion_code=item_in.get("criterion_code"),
            criterion_name=str(item_in.get("criterion_name") or ""),
            mode_snapshot=item_in.get("mode_snapshot", "point"),
            max_score_snapshot=item_in.get("max_score_snapshot", 0),
            min_pass_score_snapshot=item_in.get("min_pass_score_snapshot", 0),
            result=item_in.get("result", "pending"),
            score=item_in.get("score"),
            applicable=item_in.get("applicable", True),
            requires_fix=item_in.get("requires_fix", False),
            note=item_in.get("note"),
            attachments=item_in.get("attachments")
        )
        session.add(item_obj)
        
    await session.commit()
    
    # Process calculated score and submit immediately
    return await submit_qc_session(
        id=qc_session.id,
        session=session,
        current_user=current_user
    )
@router.delete("/sessions/{id}", response_model=dict)
async def delete_qc_session(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, object]:
    """Delete a QC session (temporary for cleanup)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền xóa phiên QC")
        
    query = select(QCSession).where(QCSession.id == id)
    result = await session.execute(query)
    qc_session = result.scalar_one_or_none()
    
    if not qc_session:
        raise HTTPException(status_code=404, detail="Phiên QC không tồn tại")
        
    await session.delete(qc_session)
    await session.commit()
    
    return {"success": True, "message": "Xóa phiên QC thành công"}


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
) -> dict[str, object]:
    """Get QC overview aggregated by store."""
    effective_page_size = pageSize or page_size
    effective_sort_by = sortBy or sort_by
    effective_sort_dir = sortDir or sort_dir

    # 2. Filtering
    filters = []
    if date_from:
        parsed_from = parse_iso_datetime(date_from)
        if "T" not in date_from:
            parsed_from = parsed_from.replace(hour=0, minute=0, second=0, microsecond=0)
        filters.append(QCSession.audited_at >= parsed_from)
    if date_to:
        parsed_to = parse_iso_datetime(date_to)
        if "T" not in date_to:
            parsed_to = parsed_to.replace(hour=23, minute=59, second=59, microsecond=999999)
        filters.append(QCSession.audited_at <= parsed_to)
        
    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(QCSession.store_id.in_(user_store_ids))
    elif store_ids:
        ids = [int(i.strip()) for i in store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(QCSession.store_id.in_(ids))

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
) -> dict[str, object]:
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
    total_deduction = 0
    
    for item in items:
        if item.result == "na" or item.result == "skipped_weekly":
            continue
            
        if item.mode_snapshot == "deduction":
            if item.result == "fail":
                total_deduction += float(item.max_score_snapshot or 0)
        elif item.mode_snapshot == "point":
            total_score += float(item.score or 0)
            max_score += float(item.max_score_snapshot or 0)
        elif item.mode_snapshot == "pass_fail":
            item_weight = float(item.max_score_snapshot or 0)
            max_score += item_weight
            if item.result == "pass":
                total_score += item_weight
            
    # Determine result based on threshold (default 40% as per Strapi)
    pass_threshold = 40
    if qc_session.form_version and qc_session.form_version.pass_rule:
        pass_threshold = qc_session.form_version.pass_rule.get("passThreshold", 40)
        
    base_score_rate = (total_score / max_score * 100) if max_score > 0 else 0
    capped_total_deduction = min(total_deduction, 100)
    score_rate = max(base_score_rate - capped_total_deduction, 0)
    final_total_score = (max_score * score_rate / 100) if max_score > 0 else 0
    is_pass = max_score > 0 and score_rate >= pass_threshold
    
    qc_session.total_score = final_total_score
    qc_session.max_score = max_score
    qc_session.result = "pass" if is_pass else "fail"
    qc_session.status = "closed" if is_pass else "needs_fix"
    qc_session.submitted_at = utc_now_naive()
    
    session.add(qc_session)
    
    # Generate findings for failed items
    new_findings = []
    if not is_pass:
        for item in items:
            if item.result == "fail" and item.requires_fix:
                timestamp = utc_now_naive().strftime("%y%m%d%H%M%S")
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
                    due_date=utc_now_naive() + timedelta(days=3) # Default 3 days
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
            "total_score": final_total_score,
            "max_score": max_score,
            "base_total_score": total_score,
            "base_score_rate": base_score_rate,
            "total_deduction": capped_total_deduction,
            "score_rate": score_rate,
            "pass_threshold": pass_threshold,
            "failed_count": sum(1 for item in items if item.result == "fail")
        }
    }
