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

def _require_admin(current_user):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới có quyền quản lý QC Forms")

def _serialize_form_list_item(form: QCForm) -> dict:
    versions = sorted(form.versions, key=lambda v: v.id, reverse=True) if form.versions else []
    published_versions = [v for v in versions if v.status == "published"]
    latest = versions[0] if versions else None
    
    updated_at_obj = (latest.updated_at if latest else None) or form.updated_at
    return {
        "id": form.id,
        "code": form.code,
        "name": form.name,
        "description": form.description or "",
        "is_active": form.is_active,
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
        "latestVersionNo": latest.version_no if latest else "--",
        "latestVersionStatus": latest.status if latest else "",
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
        "level": criterion.level,
        "ordering": criterion.ordering or "",
        "parentId": criterion.parent_id,
        "sortOrder": criterion.id,
        "nodeType": "group" if criterion.children else "criterion",
    }

def _serialize_form_detail(form: QCForm, version: Optional[QCFormVersion] = None) -> dict:
    if not version and form.versions:
        sorted_versions = sorted(form.versions, key=lambda v: v.id, reverse=True)
        version = sorted_versions[0] if sorted_versions else None
    
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
            "passScore": (version.pass_rule or {}).get("passScore", 0) if version else 0,
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
            
            try:
                max_score = float(node.get("maxScore", 10))
            except (ValueError, TypeError):
                max_score = 10.0
                
            try:
                min_pass_score = float(node.get("minPassScore", 0))
            except (ValueError, TypeError):
                min_pass_score = 0.0
                
            if node_type != "criterion":
                max_score = 0.0
                min_pass_score = 0.0
            elif mode == "pass_fail":
                max_score = 1.0
                min_pass_score = 1.0
                
            code = _build_criterion_code(form_code, version.version_no, ordering)
            
            criterion = QCCriterion(
                code=code,
                name=str(node.get("name", "")).strip() or "Unnamed",
                description=str(node.get("description", "")).strip(),
                default_mode=mode,
                default_max_score=max_score,
                default_min_pass_score=min_pass_score,
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
    
    return {"success": True, "data": {"item": _serialize_form_detail(form)}}

@router.post("/forms", response_model=dict)
async def create_admin_qc_form(
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Create a new QC form with an initial version (admin only)."""
    _require_admin(current_user)
    
    code = payload.get("code", "").strip()
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

        pass_rule_payload = {
            "passThreshold": payload.get("passThreshold", 40),
            "passScore": payload.get("passScore", 0)
        }

        # Create initial version
        version = QCFormVersion(
            form_id=form.id,
            version_no=payload.get("versionNo", "v1.0"),
            status=payload.get("status", "draft"),
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
async def update_admin_qc_form(
    form_id: int,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Update a QC form and optionally its latest version (admin only)."""
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
    
    # Update form fields
    if "name" in payload:
        form.name = payload["name"]
    if "description" in payload:
        form.description = payload["description"]
    if "isActive" in payload:
        form.is_active = payload["isActive"]
    
    latest = sorted(form.versions, key=lambda v: v.id, reverse=True)[0] if form.versions else None
    new_status = payload.get("status")
    pass_threshold = payload.get("passThreshold")
    pass_score = payload.get("passScore")
    criteria_payload = payload.get("criteria")
    
    needs_new_version = False
    if not latest:
        needs_new_version = True
    elif latest.status in ("published", "archived"):
        needs_new_version = True
        
    if needs_new_version:
        new_pass_rule = dict(latest.pass_rule or {}) if latest else {}
        if pass_threshold is not None:
            new_pass_rule["passThreshold"] = pass_threshold
        if pass_score is not None:
            new_pass_rule["passScore"] = pass_score
            
        version_no = payload.get("versionNo")
        if not version_no:
            version_no = _next_version_no(latest.version_no) if latest else "v1.0"
            
        version = QCFormVersion(
            form_id=form.id,
            version_no=version_no,
            status=new_status or "draft",
            pass_rule=new_pass_rule,
            effective_from=latest.effective_from if latest else None,
            effective_to=latest.effective_to if latest else None,
        )
        session.add(version)
        await session.flush()
        
        # sync criteria
        if criteria_payload is not None:
            await _sync_criteria_tree(session, form.code, version, criteria_payload)
        else:
            if latest and latest.form_criteria:
                for fc in latest.form_criteria:
                    session.add(QCFormCriterion(form_version_id=version.id, criterion_id=fc.criterion_id))
    else:
        # Update existing latest draft
        if new_status:
            latest.status = new_status
            
        rule = dict(latest.pass_rule or {})
        if pass_threshold is not None:
            rule["passThreshold"] = pass_threshold
        if pass_score is not None:
            rule["passScore"] = pass_score
        latest.pass_rule = rule
            
        if criteria_payload is not None:
            await session.execute(
                delete(QCFormCriterion).where(QCFormCriterion.form_version_id == latest.id)
            )
            prefix = f"{form.code}-{latest.version_no}-"
            await session.execute(
                delete(QCCriterion).where(QCCriterion.code.like(f"{prefix}%"))
            )
            await session.flush()
            
            await _sync_criteria_tree(session, form.code, latest, criteria_payload)

    target_version_id = version.id if needs_new_version else (latest.id if latest else 0)
    if new_status == "published" and target_version_id > 0:
        await session.execute(
            update(QCFormVersion)
            .where(QCFormVersion.form_id == form.id)
            .where(QCFormVersion.id != target_version_id)
            .where(QCFormVersion.status == "published")
            .values(status="archived")
        )
    
    session.add(form)
    await session.commit()
    
    # Reload
    result = await session.execute(query)
    form = result.scalar_one()
    
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
