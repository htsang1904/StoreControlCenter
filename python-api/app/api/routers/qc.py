import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, and_, case
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.core.datetime_utils import utc_now_naive
from app.models.qc_session import QCSession, QCSessionItem, QCDraft, QCFinding
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

OPEN_FINDING_STATUSES = {"open", "in_progress", "resolved", "rejected"}


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
        incoming_applicable = incoming.get("applicable")
        is_non_scored = status in {"na", "skipped_weekly"} or incoming_applicable is False
        max_score = float(criterion.default_max_score or 0)
        deduction_percent = float(criterion.default_deduction_percent or 0)
        severity = criterion.default_severity or "normal"

        raw_score = incoming.get("score")
        score = None
        if not is_non_scored and raw_score is not None and str(raw_score) != "":
            try:
                score = max(min(float(raw_score), max_score), 0)
            except (TypeError, ValueError):
                score = None

        min_pass_score = float(criterion.default_min_pass_score or 0)
        if is_non_scored:
            status = "skipped_weekly" if status == "skipped_weekly" else "na"
        elif mode == "point" and score is not None:
            effective_min_pass_score = min_pass_score if min_pass_score > 0 else (max_score / 2)
            status = "pass" if score >= effective_min_pass_score else "fail"

        requires_fix = status == "fail" and not is_non_scored

        session_items.append(
            {
                "criterion_id": criterion.id,
                "criterion_code": criterion.code,
                "criterion_name": criterion.name,
                "mode_snapshot": mode,
                "max_score_snapshot": deduction_percent if mode == "deduction" else max_score,
                "min_pass_score_snapshot": min_pass_score,
                "severity_snapshot": severity,
                "result": status,
                "score": score if mode == "point" else None,
                "applicable": not is_non_scored,
                "requires_fix": requires_fix,
                "note": incoming.get("note"),
                "attachments": incoming.get("attachments"),
            }
        )

    return session_items

def _to_decimal(value: object) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal(0)

def _normalize_finding_status(value: object) -> str:
    return str(value or "open").strip().lower()


def _empty_finding_status_summary() -> dict[str, int]:
    return {status: 0 for status in ["open", "in_progress", "resolved", "rejected", "verified"]}


def _finding_aggregate(rows: list[object]) -> tuple[dict[str, dict[str, object]], dict[str, dict[str, object]]]:
    store_stats: dict[str, dict[str, object]] = {}
    session_stats: dict[str, dict[str, object]] = {}

    for row in rows:
        store_id = str(row.store_id) if row.store_id is not None else ""
        session_id = str(row.session_id) if row.session_id is not None else ""
        status = _normalize_finding_status(row.status)
        count = int(row.count or 0)

        if store_id:
            store_stat = store_stats.setdefault(store_id, {"openFindings": 0, "sessionIds": set(), "findingStatusSummary": _empty_finding_status_summary()})
            store_stat["findingStatusSummary"][status] = store_stat["findingStatusSummary"].get(status, 0) + count
            if status in OPEN_FINDING_STATUSES:
                store_stat["openFindings"] += count
                if session_id:
                    store_stat["sessionIds"].add(session_id)

        if session_id:
            session_stat = session_stats.setdefault(session_id, {"openFindings": 0, "findingStatusSummary": _empty_finding_status_summary()})
            session_stat["findingStatusSummary"][status] = session_stat["findingStatusSummary"].get(status, 0) + count
            if status in OPEN_FINDING_STATUSES:
                session_stat["openFindings"] += count

    for stat in store_stats.values():
        stat["activeFindingSessions"] = len(stat.pop("sessionIds", set()))

    return store_stats, session_stats


async def _load_finding_aggregates(
    session: SessionDep,
    store_ids: list[int] | None = None,
    session_ids: list[int] | None = None,
) -> tuple[dict[str, dict[str, object]], dict[str, dict[str, object]]]:
    filters = []
    if store_ids:
        filters.append(QCFinding.store_id.in_(store_ids))
    if session_ids:
        filters.append(QCFinding.session_id.in_(session_ids))

    query = (
        select(
            QCFinding.store_id,
            QCFinding.session_id,
            QCFinding.status,
            func.count(QCFinding.id).label("count"),
        )
        .group_by(QCFinding.store_id, QCFinding.session_id, QCFinding.status)
    )
    if filters:
        query = query.where(and_(*filters))

    result = await session.execute(query)
    return _finding_aggregate(result.all())


def _serialize_qc_session_summary(qc_session: QCSession) -> dict:
    store = qc_session.store
    auditor = qc_session.auditor
    form_version = qc_session.form_version
    form = form_version.form if form_version else None
    return {
        "id": qc_session.id,
        "code": qc_session.code,
        "status": qc_session.status,
        "result": qc_session.result,
        "total_score": _to_decimal(qc_session.total_score),
        "max_score": _to_decimal(qc_session.max_score),
        "note": qc_session.note,
        "store_id": qc_session.store_id,
        "form_version_id": qc_session.form_version_id,
        "form_version": {
            "id": form_version.id,
            "version_no": form_version.version_no,
            "status": form_version.status,
            "pass_rule": form_version.pass_rule or {},
            "form": {
                "id": form.id,
                "code": form.code,
                "name": form.name,
                "description": form.description,
                "is_active": form.is_active,
            } if form else None,
        } if form_version else None,
        "auditor_id": qc_session.auditor_id,
        "audited_at": qc_session.audited_at,
        "submitted_at": qc_session.submitted_at,
        "created_at": qc_session.created_at,
        "store": {
            "id": store.id,
            "name": store.name,
            "code": store.code,
            "address": store.address,
            "shortAddress": store.shortAddress,
            "storeId": store.storeId,
            "brandId": store.brandId,
            "is_active": store.is_active,
            "created_at": store.created_at,
        } if store else None,
        "auditor": {
            "id": auditor.id,
            "name": auditor.name,
            "email": auditor.email,
            "phone_number": auditor.phone_number,
            "avatar_url": auditor.avatar_url,
        } if auditor else None,
    }

def _serialize_qc_session_item(item: QCSessionItem) -> dict:
    return {
        "id": item.id,
        "session_id": item.session_id,
        "criterion_id": item.criterion_id,
        "criterion_code": item.criterion_code,
        "criterion_name": item.criterion_name,
        "mode_snapshot": item.mode_snapshot,
        "max_score_snapshot": _to_decimal(item.max_score_snapshot),
        "min_pass_score_snapshot": _to_decimal(item.min_pass_score_snapshot),
        "result": item.result,
        "score": _to_decimal(item.score) if item.score is not None else None,
        "applicable": item.applicable,
        "requires_fix": item.requires_fix,
        "note": item.note,
        "attachments": item.attachments,
    }


def _serialize_qc_session_detail(qc_session: QCSession) -> dict:
    data = _serialize_qc_session_summary(qc_session)
    data["items"] = [_serialize_qc_session_item(item) for item in (qc_session.items or [])]
    data["findings"] = [
        {
            "id": finding.id,
            "finding_code": finding.finding_code,
            "criterion_name": finding.criterion_name,
            "severity": finding.severity,
            "status": finding.status,
            "due_date": finding.due_date,
        }
        for finding in (qc_session.findings or [])
    ]
    return data


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
                    "minPassScore": float(criterion.default_min_pass_score or 0),
                    "deductionPercent": float(criterion.default_deduction_percent or 0),
                    "severity": criterion.default_severity or "normal",
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
        user_store_ids = [s.id for s in current_user.stores if getattr(s, "is_active", True)]
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
    _, finding_stats_by_session = await _load_finding_aggregates(
        session,
        session_ids=[item.id for item in sessions if item.id is not None],
    )

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
        "data": [
            {
                **QCSessionResponse.model_validate(s).model_dump(mode="json"),
                **finding_stats_by_session.get(str(s.id), {
                    "openFindings": 0,
                    "findingStatusSummary": _empty_finding_status_summary(),
                }),
            }
            for s in sessions
        ],
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
        store_ids = [s.id for s in current_user.stores if getattr(s, "is_active", True)]
        if qc_session.store_id not in store_ids:
            raise HTTPException(status_code=403, detail="Không có quyền truy cập phiên QC này")

    return {"success": True, "data": _serialize_qc_session_detail(qc_session)}

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
            severity_snapshot=item_in.get("severity_snapshot", "normal"),
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
    draft_filters = []
    if date_from:
        parsed_from = parse_iso_datetime(date_from)
        if "T" not in date_from:
            parsed_from = parsed_from.replace(hour=0, minute=0, second=0, microsecond=0)
        filters.append(QCSession.audited_at >= parsed_from)
        draft_filters.append(QCDraft.audited_at >= parsed_from)
    if date_to:
        parsed_to = parse_iso_datetime(date_to)
        if "T" not in date_to:
            parsed_to = parsed_to.replace(hour=23, minute=59, second=59, microsecond=999999)
        filters.append(QCSession.audited_at <= parsed_to)
        draft_filters.append(QCDraft.audited_at <= parsed_to)

    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores if getattr(s, "is_active", True)]
        filters.append(QCSession.store_id.in_(user_store_ids))
        draft_filters.append(QCDraft.store_id.in_(user_store_ids))
    elif store_ids:
        ids = [int(i.strip()) for i in store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(QCSession.store_id.in_(ids))
            draft_filters.append(QCDraft.store_id.in_(ids))

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

    draft_query = (
        select(
            QCDraft.store_id,
            func.count(QCDraft.id).label("draftSessions"),
        )
        .where(and_(*draft_filters) if draft_filters else True)
        .group_by(QCDraft.store_id)
    )
    draft_results = await session.execute(draft_query)
    draft_data = {r.store_id: int(r.draftSessions or 0) for r in draft_results.all()}

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
        user_store_ids = [s.id for s in current_user.stores if getattr(s, "is_active", True)]
        store_query = store_query.where(Store.id.in_(user_store_ids))
    elif store_ids:
        ids = [int(i.strip()) for i in store_ids.split(",") if i.strip().isdigit()]
        if ids:
            store_query = store_query.where(Store.id.in_(ids))

    # Final list of stores to report on
    all_stores_res = await session.execute(store_query)
    all_stores = all_stores_res.scalars().all()
    finding_stats_by_store, _ = await _load_finding_aggregates(
        session,
        store_ids=[store.id for store in all_stores if store.id is not None],
    )

    # 5. Compute Metrics
    store_stats = []
    summary_metrics = {"totalSessions": 0, "passed": 0, "failed": 0, "draftSessions": 0, "totalScore": 0, "maxScore": 0}

    for s in all_stores:
        agg = agg_data.get(s.id)
        draft_sessions = draft_data.get(s.id, 0)
        summary_metrics["draftSessions"] += draft_sessions
        finding_stat = finding_stats_by_store.get(str(s.id), {
            "openFindings": 0,
            "activeFindingSessions": 0,
            "findingStatusSummary": _empty_finding_status_summary(),
        })
        if not agg:
            if q and draft_sessions <= 0: continue # Skip stores with no QC activity if searching.
            stat = {
                "storeId": s.id, "storeCode": s.code, "storeNo": s.storeId,
                "storeName": s.shortAddress or s.name, "totalSessions": 0, "passed": 0, "failed": 0,
                "draftSessions": draft_sessions, "avgScore": 0, "scoreRate": 0, "avgScoreRate": 0, "passRate": 0, "lastAuditedAt": None,
                **finding_stat,
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
                "draftSessions": draft_sessions,
                "avgScore": round(tScore / totalS, 1) if totalS > 0 else 0,
                "scoreRate": round((tScore / mScore * 100), 1) if mScore > 0 else 0,
                "avgScoreRate": round((tScore / mScore * 100), 1) if mScore > 0 else 0,
                "passRate": round((passed / totalS * 100)) if totalS > 0 else 0,
                "lastAuditedAt": agg.lastAuditedAt.isoformat() if agg.lastAuditedAt else None,
                **finding_stat,
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
        "draftSessions": summary_metrics["draftSessions"],
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
        selectinload(QCSession.store),
        selectinload(QCSession.auditor),
        selectinload(QCSession.form_version).selectinload(QCFormVersion.form)
    ).where(QCSession.id == id)
    result = await session.execute(query)
    qc_session = result.scalar_one_or_none()

    if not qc_session:
        raise HTTPException(status_code=404, detail="Phiên QC không tồn tại")

    if qc_session.status == "closed":
        return {"success": True, "message": "Phiên QC đã được đóng trước đó", "data": _serialize_qc_session_summary(qc_session)}

    items = qc_session.items
    total_score = 0
    max_score = 0
    total_deduction = 0

    for item in items:
        if item.applicable is False or item.result == "na" or item.result == "skipped_weekly":
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
    critical_failed_items = [
        item for item in items
        if item.applicable is not False
        and item.result == "fail"
        and (item.severity_snapshot or "normal") in {"critical", "heavy"}
    ]
    is_pass = max_score > 0 and score_rate >= pass_threshold and not critical_failed_items

    failed_items = [item for item in items if item.applicable is not False and item.result == "fail"]
    failed_item_ids = [item.id for item in failed_items if item.id is not None]
    existing_finding_item_ids: set[int] = set()
    if failed_item_ids:
        existing_result = await session.execute(
            select(QCFinding.session_item_id).where(
                QCFinding.session_id == qc_session.id,
                QCFinding.session_item_id.in_(failed_item_ids),
            )
        )
        existing_finding_item_ids = {
            item_id for item_id in existing_result.scalars().all() if item_id is not None
        }

    needs_fix = (not is_pass) or bool(failed_items)
    qc_session.total_score = final_total_score
    qc_session.max_score = max_score
    qc_session.result = "pass" if is_pass else "fail"
    qc_session.status = "needs_fix" if needs_fix else "closed"
    qc_session.submitted_at = utc_now_naive()

    session.add(qc_session)

    # Generate findings for every failed criterion, even when the overall score passes.
    new_findings = []
    for item in failed_items:
        if item.id in existing_finding_item_ids:
            continue

        date_part = utc_now_naive().strftime("%Y%m%d")
        random_part = uuid.uuid4().hex[:4].upper()
        finding_code = f"FD-{date_part}-{random_part}"

        finding = QCFinding(
            finding_code=finding_code,
            session_id=qc_session.id,
            session_item_id=item.id,
            store_id=qc_session.store_id,
            criterion_name=item.criterion_name,
            severity="critical" if (item.severity_snapshot or "normal") in {"critical", "heavy"} else "medium",
            status="open",
            due_date=utc_now_naive() + timedelta(days=3), # Default 3 days
            meta_info={
                "criterion_code": item.criterion_code,
                "criterion_name": item.criterion_name,
                "qc_note": item.note,
                "criterion_severity": item.severity_snapshot or "normal",
                "qc_attachments": item.attachments or [],
                "detected_at": qc_session.submitted_at.isoformat() if qc_session.submitted_at else None,
                "auditor_id": qc_session.auditor_id,
                "session_code": qc_session.code,
                "form_version_id": qc_session.form_version_id,
            }
        )
        session.add(finding)
        new_findings.append(finding_code)

    await session.commit()

    refreshed_result = await session.execute(query)
    refreshed_qc_session = refreshed_result.scalar_one_or_none() or qc_session

    return {
        "success": True,
        "message": "Submit phiên QC thành công",
        "data": _serialize_qc_session_summary(refreshed_qc_session),
        "generated_findings": new_findings,
        "findingCount": len(new_findings),
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
