"""
Admin QC Forms CRUD — Gap 4
Provides endpoints at /api/admin/qc/forms for managing QC forms.
Admin-only access.
"""
import logging
import re
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, func, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.models.qc_form import QCForm, QCFormVersion, QCCriterion, QCFormCriterion
from app.models.qc_session import QCSession

router = APIRouter()
logger = logging.getLogger("app.admin_qc")
MAX_QC_CRITERION_CODE_LENGTH = 50
MAX_QC_FORM_CODE_LENGTH = 50
QC_CRITERION_MODES = {"point", "pass_fail", "deduction"}
QC_CRITERION_SEVERITIES = {"normal", "critical", "light", "heavy"}
QC_VERSION_STATUSES = {"draft", "published"}

def _require_admin(current_user):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền quản lý QC Forms")

def _serialize_form_list_item(form: QCForm) -> dict:
    versions = sorted(form.versions, key=lambda v: v.id, reverse=True) if form.versions else []
    published_versions = [v for v in versions if v.status == "published"]
    draft_versions = [v for v in versions if v.status == "draft"]
    latest = versions[0] if versions else None
    active = sorted(published_versions, key=lambda v: v.id, reverse=True)[0] if published_versions else None
    draft = sorted(draft_versions, key=lambda v: v.id, reverse=True)[0] if draft_versions else None
    display_version = active or latest
    
    created_at_obj = form.created_at or (display_version.created_at if display_version else None)
    updated_at_obj = form.updated_at or (display_version.updated_at if display_version else None)
    return {
        "id": form.id,
        "code": form.code,
        "name": form.name,
        "description": form.description or "",
        "isActive": form.is_active,
        "versions": [
            {
                "id": v.id,
                "version_no": v.version_no,
                "versionNo": v.version_no,
                "status": v.status,
                "createdAt": v.created_at.isoformat() if v.created_at else None,
                "updatedAt": v.updated_at.isoformat() if v.updated_at else None,
            }
            for v in versions
        ],
        "hasLatestVersion": latest is not None,
        "versionsCount": len(versions),
        "publishedVersionsCount": len(published_versions),
        "hasDraftVersion": draft is not None,
        "draftVersionNo": draft.version_no if draft else "",
        "activeVersionNo": active.version_no if active else "",
        "activeVersionStatus": active.status if active else "",
        "displayVersionNo": display_version.version_no if display_version else "--",
        "displayVersionStatus": display_version.status if display_version else "",
        "latestVersionNo": latest.version_no if latest else "--",
        "latestVersionStatus": latest.status if latest else "",
        "createdAt": created_at_obj.isoformat() if created_at_obj else None,
        "updatedAt": updated_at_obj.isoformat() if updated_at_obj else None,
    }

def _serialize_criterion(criterion: QCCriterion) -> dict:
    return {
        "id": criterion.id,
        "code": criterion.code,
        "name": criterion.name,
        "description": criterion.description or "",
        "sectionName": "Tổng quát",
        "mode": criterion.default_mode,
        "maxScore": float(criterion.default_max_score or 0),
        "minPassScore": float(criterion.default_min_pass_score or 0),
        "deductionPercent": float(criterion.default_deduction_percent or 0),
        "severity": criterion.default_severity or "normal",
        "level": criterion.level,
        "ordering": criterion.ordering or "",
        "parentId": criterion.parent_id,
        "sortOrder": criterion.id,
        "nodeType": "group" if criterion.children else "criterion",
    }

def _serialize_form_detail(form: QCForm, version: Optional[QCFormVersion] = None) -> dict:
    if not version and form.versions:
        sorted_versions = sorted(form.versions, key=lambda v: v.id, reverse=True)
        published_versions = [v for v in sorted_versions if v.status == "published"]
        version = published_versions[0] if published_versions else (sorted_versions[0] if sorted_versions else None)
    
    criteria = []
    if version and version.form_criteria:
        criteria = [
            _serialize_criterion(fc.criterion) 
            for fc in version.form_criteria 
            if fc.criterion
        ]
    
    return {
        "id": form.id,
        "code": form.code,
        "name": form.name,
        "description": form.description or "",
        "isActive": form.is_active,
        "latestVersion": {
            "id": version.id if version else 0,
            "versionNo": version.version_no if version else "v1.0",
            "status": version.status if version else "draft",
            "passThreshold": (version.pass_rule or {}).get("passThreshold", 40) if version else 40,
            "criteria": criteria,
        } if version else None,
    }

def _next_version_no(current_version_no: str) -> str:
    raw = str(current_version_no or "").strip()
    match = re.match(r"^v?(\d+)(?:\.(\d+))?$", raw, flags=re.IGNORECASE)
    if not match:
        return f"{raw or 'v1.0'}-rev"

    major = int(match.group(1))
    minor = int(match.group(2) or 0)
    return f"v{major}.{minor + 1}"

def _serialize_version_summary(version: QCFormVersion, active_version_id: Optional[int] = None) -> dict:
    criteria = [fc.criterion for fc in version.form_criteria if fc.criterion]
    return {
        "id": version.id,
        "versionNo": version.version_no,
        "status": version.status,
        "isActive": version.id == active_version_id,
        "passThreshold": (version.pass_rule or {}).get("passThreshold", 40),
        "criteriaCount": len([item for item in criteria if not item.children]),
        "createdAt": version.created_at.isoformat() if version.created_at else None,
        "updatedAt": version.updated_at.isoformat() if version.updated_at else None,
    }

def _active_version(form: QCForm) -> Optional[QCFormVersion]:
    published = [version for version in form.versions if version.status == "published"]
    return sorted(published, key=lambda item: item.id, reverse=True)[0] if published else None


def _build_criterion_code(form_code: str, version_no: str, ordering: str) -> str:
    raw_code = f"{form_code}-{version_no}-{ordering}"
    if len(raw_code) <= MAX_QC_CRITERION_CODE_LENGTH:
        return raw_code

    suffix = f"-{version_no}-{ordering}"
    if len(suffix) >= MAX_QC_CRITERION_CODE_LENGTH:
        return suffix[-MAX_QC_CRITERION_CODE_LENGTH:]

    prefix_length = MAX_QC_CRITERION_CODE_LENGTH - len(suffix)
    return f"{form_code[:prefix_length]}{suffix}"


async def _sync_criteria_tree(session, form_code: str, version: QCFormVersion, criteria_payload: list):
    async def process_nodes(nodes, parent_id=None, level=1, parent_ordering=""):
        for i, node in enumerate(nodes):
            ordering_label = str(node.get("orderingLabel") or "").strip()
            if not ordering_label:
                ordering_label = str(i + 1)
            
            ordering = f"{parent_ordering}.{ordering_label}" if parent_ordering else ordering_label
            node_type = str(node.get("nodeType", "criterion")).strip()
            mode = str(node.get("mode", "point")).strip() if node_type == "criterion" else "point"
            severity = str(node.get("severity", "normal")).strip() if node_type == "criterion" else "normal"
            severity = "critical" if severity == "heavy" else "normal" if severity == "light" else severity
            if severity not in QC_CRITERION_SEVERITIES:
                severity = "normal"
            
            try:
                max_score = float(node.get("maxScore", 10))
            except (ValueError, TypeError):
                max_score = 10.0
                
            try:
                deduction_percent = float(node.get("deductionPercent", 0))
            except (ValueError, TypeError):
                deduction_percent = 0.0

            try:
                min_pass_score = float(node.get("minPassScore", (max_score / 2) if mode == "point" else 0))
            except (ValueError, TypeError):
                min_pass_score = (max_score / 2) if mode == "point" else 0.0
                
            if node_type != "criterion":
                max_score = 0.0
                deduction_percent = 0.0
                min_pass_score = 0.0
            elif mode == "deduction":
                max_score = 0.0
                min_pass_score = 0.0
            elif mode != "point":
                min_pass_score = 0.0
            else:
                min_pass_score = max(min(min_pass_score, max_score), 0.0)
                
            code = _build_criterion_code(form_code, version.version_no, ordering)
            
            criterion = QCCriterion(
                code=code,
                name=str(node.get("name", "")).strip() or "Unnamed",
                description=str(node.get("description", "")).strip(),
                default_mode=mode,
                default_max_score=max_score,
                default_min_pass_score=min_pass_score,
                default_deduction_percent=deduction_percent,
                default_severity=severity,
                is_active=True,
                parent_id=parent_id,
                level=level,
                ordering=ordering
            )
            session.add(criterion)
            await session.flush()
            
            session.add(QCFormCriterion(
                form_version_id=version.id,
                criterion_id=criterion.id
            ))
            await session.flush()
            
            if node_type == "group" and node.get("children"):
                await process_nodes(node["children"], parent_id=criterion.id, level=level + 1, parent_ordering=ordering)

    if criteria_payload:
        await process_nodes(criteria_payload)

def _validate_scoring_payload(payload: dict, require_criteria: bool = True) -> None:
    try:
        pass_threshold = float(payload.get("passThreshold", 40))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Ngưỡng đạt phải là một số từ 0 đến 100") from exc
    if pass_threshold < 0 or pass_threshold > 100:
        raise HTTPException(status_code=400, detail="Ngưỡng đạt phải nằm trong khoảng từ 0 đến 100")

    criteria = payload.get("criteria")
    if criteria is None and not require_criteria:
        return
    if not isinstance(criteria, list) or not criteria:
        raise HTTPException(status_code=400, detail="Biểu mẫu cần ít nhất một nhóm hoặc tiêu chí")

    scoring_criteria_count = 0

    def validate_nodes(nodes: list) -> None:
        nonlocal scoring_criteria_count
        for node in nodes:
            if not isinstance(node, dict):
                raise HTTPException(status_code=400, detail="Cấu trúc tiêu chí không hợp lệ")
            node_type = str(node.get("nodeType", "criterion")).strip()
            if node_type not in {"group", "criterion"}:
                raise HTTPException(status_code=400, detail="Loại node QC không hợp lệ")
            if not str(node.get("name", "")).strip():
                raise HTTPException(status_code=400, detail="Tên nhóm và tiêu chí là bắt buộc")
            if node_type == "group":
                children = node.get("children")
                if not isinstance(children, list) or not children:
                    raise HTTPException(status_code=400, detail="Nhóm QC cần ít nhất một mục con")
                validate_nodes(children)
                continue

            mode = str(node.get("mode", "point")).strip()
            if mode not in QC_CRITERION_MODES:
                raise HTTPException(status_code=400, detail=f"Kiểu chấm '{mode}' không hợp lệ")
            severity = str(node.get("severity", "normal")).strip()
            severity = "critical" if severity == "heavy" else "normal" if severity == "light" else severity
            if severity not in QC_CRITERION_SEVERITIES:
                raise HTTPException(status_code=400, detail="Mức độ tiêu chí QC không hợp lệ")
            field_name = "deductionPercent" if mode == "deduction" else "maxScore"
            try:
                value = float(node.get(field_name, 0))
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=400, detail=f"{field_name} phải là một số hợp lệ") from exc
            if mode == "deduction":
                if value <= 0 or value > 100:
                    raise HTTPException(status_code=400, detail="Mức khấu trừ phải lớn hơn 0 và không quá 100")
            else:
                if value <= 0:
                    raise HTTPException(status_code=400, detail="Điểm tối đa hoặc trọng số phải lớn hơn 0")
                if mode == "point":
                    try:
                        min_pass_score = float(node.get("minPassScore", value / 2))
                    except (TypeError, ValueError) as exc:
                        raise HTTPException(status_code=400, detail="Ngưỡng đạt tiêu chí phải là một số hợp lệ") from exc
                    if min_pass_score < 0 or min_pass_score > value:
                        raise HTTPException(status_code=400, detail="Ngưỡng đạt tiêu chí phải nằm trong khoảng 0 đến điểm tối đa")
                scoring_criteria_count += 1

    validate_nodes(criteria)
    if scoring_criteria_count == 0:
        raise HTTPException(status_code=400, detail="Biểu mẫu cần ít nhất một tiêu chí chấm điểm hoặc đạt/không đạt")


@router.get("/forms", response_model=dict)
async def list_admin_qc_forms(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
) -> Any:
    """List QC forms with pagination (admin only)."""
    _require_admin(current_user)
    
    skip = (page - 1) * pageSize
    
    # Count
    count_query = select(func.count()).select_from(QCForm)
    total = (await session.execute(count_query)).scalar() or 0
    page_count = (total + pageSize - 1) // pageSize if pageSize > 0 else 1
    
    # Fetch with versions
    query = (
        select(QCForm)
        .options(selectinload(QCForm.versions))
        .order_by(QCForm.id.desc())
        .offset(skip)
        .limit(pageSize)
    )
    result = await session.execute(query)
    forms = result.scalars().all()
    
    return {
        "success": True,
        "data": {
            "items": [_serialize_form_list_item(f) for f in forms],
            "pagination": {
                "page": page,
                "pageSize": pageSize,
                "total": total,
                "pageCount": page_count,
            }
        }
    }

@router.get("/forms/{form_id}", response_model=dict)
async def get_admin_qc_form(
    form_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get a QC form detail with latest version and criteria (admin only)."""
    _require_admin(current_user)
    
    query = (
        select(QCForm)
        .options(
            selectinload(QCForm.versions).selectinload(
                QCFormVersion.form_criteria
            ).selectinload(QCFormCriterion.criterion).selectinload(QCCriterion.children)
        )
        .where(QCForm.id == form_id)
    )
    result = await session.execute(query)
    form = result.scalar_one_or_none()
    
    if not form:
        raise HTTPException(status_code=404, detail="QC Form không tồn tại")
    
    item = _serialize_form_detail(form)
    active = _active_version(form)
    draft = next((version for version in sorted(form.versions, key=lambda value: value.id, reverse=True) if version.status == "draft"), None)
    item["activeVersion"] = _serialize_version_summary(active, active.id) if active else None
    item["draftVersion"] = _serialize_version_summary(draft, active.id if active else None) if draft else None
    item["versionsCount"] = len(form.versions)
    return {"success": True, "data": {"item": item}}

async def _load_form_with_versions(session, form_id: int) -> QCForm:
    query = (
        select(QCForm)
        .options(
            selectinload(QCForm.versions).selectinload(QCFormVersion.form_criteria)
            .selectinload(QCFormCriterion.criterion).selectinload(QCCriterion.children)
        )
        .where(QCForm.id == form_id)
        .execution_options(populate_existing=True)
    )
    form = (await session.execute(query)).scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="QC Form không tồn tại")
    return form

@router.get("/forms/{form_id}/versions", response_model=dict)
async def list_admin_qc_form_versions(form_id: int, session: SessionDep, current_user: CurrentUser) -> Any:
    _require_admin(current_user)
    form = await _load_form_with_versions(session, form_id)
    active = _active_version(form)
    versions = sorted(form.versions, key=lambda item: item.id, reverse=True)
    return {"success": True, "data": {"items": [_serialize_version_summary(item, active.id if active else None) for item in versions]}}

@router.get("/forms/{form_id}/versions/{version_id}", response_model=dict)
async def get_admin_qc_form_version(form_id: int, version_id: int, session: SessionDep, current_user: CurrentUser) -> Any:
    _require_admin(current_user)
    form = await _load_form_with_versions(session, form_id)
    version = next((item for item in form.versions if item.id == version_id), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version QC Form không tồn tại")
    item = _serialize_form_detail(form, version)
    item["activeVersion"] = _serialize_version_summary(_active_version(form), _active_version(form).id) if _active_version(form) else None
    return {"success": True, "data": {"item": item}}

@router.post("/forms/{form_id}/versions", response_model=dict)
async def create_admin_qc_form_version(form_id: int, payload: dict, session: SessionDep, current_user: CurrentUser) -> Any:
    _require_admin(current_user)
    form = await _load_form_with_versions(session, form_id)
    existing_draft = next((item for item in form.versions if item.status == "draft"), None)
    if existing_draft:
        raise HTTPException(status_code=409, detail="Biểu mẫu đã có một version nháp")
    source_id = int(payload.get("sourceVersionId") or 0)
    source = next((item for item in form.versions if item.id == source_id), None) if source_id else _active_version(form)
    if not source:
        raise HTTPException(status_code=400, detail="Không tìm thấy version nguồn để tạo bản mới")
    latest = max(form.versions, key=lambda item: item.id)
    version = QCFormVersion(form_id=form.id, version_no=_next_version_no(latest.version_no), status="draft", pass_rule=dict(source.pass_rule or {}))
    session.add(version)
    await session.flush()
    new_version_id = version.id
    for link in source.form_criteria:
        session.add(QCFormCriterion(form_version_id=new_version_id, criterion_id=link.criterion_id))
    await session.commit()
    form = await _load_form_with_versions(session, form_id)
    version = next((item for item in form.versions if item.id == new_version_id), None)
    if not version:
        version_query = (
            select(QCFormVersion)
            .options(
                selectinload(QCFormVersion.form_criteria)
                .selectinload(QCFormCriterion.criterion).selectinload(QCCriterion.children)
            )
            .where(QCFormVersion.id == new_version_id)
            .execution_options(populate_existing=True)
        )
        version = (await session.execute(version_query)).scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=500, detail="Không tải lại được version nháp vừa tạo")
    return {"success": True, "data": {"item": _serialize_form_detail(form, version)}}

@router.put("/forms/{form_id}/versions/{version_id}", response_model=dict)
async def update_admin_qc_form_version(form_id: int, version_id: int, payload: dict, session: SessionDep, current_user: CurrentUser) -> Any:
    _require_admin(current_user)
    form = await _load_form_with_versions(session, form_id)
    version = next((item for item in form.versions if item.id == version_id), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version QC Form không tồn tại")
    if version.status != "draft":
        raise HTTPException(status_code=409, detail="Chỉ version nháp mới được chỉnh sửa")
    _validate_scoring_payload(payload, require_criteria=False)
    rule = dict(version.pass_rule or {})
    if "passThreshold" in payload:
        rule["passThreshold"] = payload["passThreshold"]
    version.pass_rule = rule
    if "criteria" in payload:
        await session.execute(delete(QCFormCriterion).where(QCFormCriterion.form_version_id == version.id))
        prefix = f"{form.code}-{version.version_no}-"
        await session.execute(delete(QCCriterion).where(QCCriterion.code.like(f"{prefix}%")))
        await session.flush()
        await _sync_criteria_tree(session, form.code, version, payload["criteria"])
    await session.commit()
    form = await _load_form_with_versions(session, form_id)
    version = next((item for item in form.versions if item.id == version_id), None)
    if not version:
        version = (
            await session.execute(
                select(QCFormVersion)
                .options(
                    selectinload(QCFormVersion.form_criteria)
                    .selectinload(QCFormCriterion.criterion).selectinload(QCCriterion.children)
                )
                .where(QCFormVersion.id == version_id)
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=500, detail="Không tải lại được version vừa cập nhật")
    return {"success": True, "data": {"item": _serialize_form_detail(form, version)}}

@router.post("/forms/{form_id}/versions/{version_id}/apply", response_model=dict)
async def apply_admin_qc_form_version(form_id: int, version_id: int, session: SessionDep, current_user: CurrentUser) -> Any:
    _require_admin(current_user)
    form = await _load_form_with_versions(session, form_id)
    version = next((item for item in form.versions if item.id == version_id), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version QC Form không tồn tại")
    if version.status != "draft":
        raise HTTPException(status_code=409, detail="Chỉ version nháp mới được phát hành và áp dụng")
    await session.execute(update(QCFormVersion).where(QCFormVersion.form_id == form.id).where(QCFormVersion.id != version.id).where(QCFormVersion.status == "published").values(status="archived"))
    version.status = "published"
    await session.commit()
    form = await _load_form_with_versions(session, form_id)
    version = next((item for item in form.versions if item.id == version_id), None)
    if not version:
        version = (
            await session.execute(
                select(QCFormVersion)
                .options(
                    selectinload(QCFormVersion.form_criteria)
                    .selectinload(QCFormCriterion.criterion).selectinload(QCCriterion.children)
                )
                .where(QCFormVersion.id == version_id)
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=500, detail="Không tải lại được version vừa áp dụng")
    return {"success": True, "data": {"item": _serialize_form_detail(form, version)}}

@router.delete("/forms/{form_id}/versions/{version_id}", response_model=dict)
async def delete_admin_qc_form_version(form_id: int, version_id: int, session: SessionDep, current_user: CurrentUser) -> Any:
    _require_admin(current_user)
    form = await _load_form_with_versions(session, form_id)
    version = next((item for item in form.versions if item.id == version_id), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version QC Form không tồn tại")
    if version.status == "published":
        raise HTTPException(status_code=409, detail="Version đang áp dụng không thể xóa")
    await session.execute(delete(QCFormCriterion).where(QCFormCriterion.form_version_id == version.id))
    await session.execute(delete(QCFormVersion).where(QCFormVersion.id == version.id))
    await session.commit()
    return {"success": True, "message": f"Đã xóa {version.version_no}"}

@router.post("/forms", response_model=dict)
async def create_admin_qc_form(
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Create a new QC form with an initial version (admin only)."""
    _require_admin(current_user)
    
    code = payload.get("code", "").strip().upper()
    name = payload.get("name", "").strip()
    criteria_payload = payload.get("criteria", [])
    criteria_count = len(criteria_payload) if isinstance(criteria_payload, list) else 0
    logger.info(
        "Create admin QC form requested: code=%s name=%s status=%s criteria=%s",
        code,
        name,
        payload.get("status", "draft"),
        criteria_count,
    )
    
    if not code or not name:
        raise HTTPException(status_code=400, detail="code và name là bắt buộc")
    if len(code) > MAX_QC_FORM_CODE_LENGTH:
        raise HTTPException(status_code=400, detail=f"Mã biểu mẫu tối đa {MAX_QC_FORM_CODE_LENGTH} ký tự")
    if not re.fullmatch(r"[A-Z0-9_-]+", code):
        raise HTTPException(status_code=400, detail="Mã biểu mẫu chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang")
    if not str(payload.get("description", "")).strip():
        raise HTTPException(status_code=400, detail="description là bắt buộc")
    status = str(payload.get("status", "draft")).strip()
    if status not in QC_VERSION_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái version không hợp lệ")
    _validate_scoring_payload(payload)
    
    # Check duplicate code
    existing = await session.execute(select(QCForm).where(QCForm.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Mã biểu mẫu '{code}' đã tồn tại")
    
    form = QCForm(
        code=code,
        name=name,
        description=payload.get("description", ""),
        is_active=payload.get("isActive", True),
    )
    try:
        session.add(form)
        await session.flush()

        pass_rule_payload = {"passThreshold": payload.get("passThreshold", 40)}

        # Create initial version
        version = QCFormVersion(
            form_id=form.id,
            version_no=payload.get("versionNo", "v1.0"),
            status=status,
            pass_rule=pass_rule_payload,
        )
        session.add(version)
        await session.flush()

        await _sync_criteria_tree(session, form.code, version, criteria_payload)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        logger.exception("Failed to create admin QC form due to integrity error")
        raise HTTPException(status_code=400, detail="Không thể tạo biểu mẫu QC do mã biểu mẫu hoặc mã tiêu chí bị trùng/quá dài.") from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        logger.exception("Failed to create admin QC form")
        raise HTTPException(status_code=400, detail="Không thể tạo biểu mẫu QC. Vui lòng kiểm tra mã biểu mẫu và cây tiêu chí.") from exc
    
    # Reload for response
    query = (
        select(QCForm)
        .options(
            selectinload(QCForm.versions).selectinload(
                QCFormVersion.form_criteria
            ).selectinload(QCFormCriterion.criterion).selectinload(QCCriterion.children)
        )
        .where(QCForm.id == form.id)
    )
    result = await session.execute(query)
    form = result.scalar_one()
    
    return {"success": True, "data": {"item": _serialize_form_detail(form)}}

@router.put("/forms/{form_id}", response_model=dict)
async def update_admin_qc_form(form_id: int, payload: dict, session: SessionDep, current_user: CurrentUser) -> Any:
    """Update form metadata only. Version changes use explicit version endpoints."""
    _require_admin(current_user)
    form = await _load_form_with_versions(session, form_id)
    if "name" in payload:
        form.name = str(payload["name"]).strip()
    if "description" in payload:
        form.description = str(payload["description"]).strip()
    if "isActive" in payload:
        form.is_active = bool(payload["isActive"])
    session.add(form)
    await session.commit()
    form = await _load_form_with_versions(session, form_id)
    return {"success": True, "data": {"item": _serialize_form_detail(form)}}

@router.delete("/forms/{form_id}", response_model=dict)
async def delete_admin_qc_form(
    form_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Delete a QC form (admin only) when no QC sessions are linked to its versions."""
    _require_admin(current_user)

    form_result = await session.execute(select(QCForm).where(QCForm.id == form_id))
    form = form_result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="QC Form không tồn tại")

    version_id_query = select(QCFormVersion.id).where(QCFormVersion.form_id == form.id)
    linked_session_count = int((await session.execute(
        select(func.count())
        .select_from(QCSession)
        .where(QCSession.form_version_id.in_(version_id_query))
    )).scalar() or 0)

    if linked_session_count > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                "Không thể xóa biểu mẫu QC vì đã có dữ liệu chấm điểm liên quan "
                f"(phiếu QC: {linked_session_count}). Hãy lưu trữ hoặc ngừng kích hoạt thay vì xóa."
            ),
        )

    await session.execute(
        delete(QCFormCriterion).where(QCFormCriterion.form_version_id.in_(version_id_query))
    )
    await session.execute(delete(QCFormVersion).where(QCFormVersion.form_id == form.id))
    await session.delete(form)
    await session.commit()

    return {"success": True, "message": "Xóa biểu mẫu QC thành công"}
