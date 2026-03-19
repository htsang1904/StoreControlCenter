"""
Admin QC Forms CRUD — Gap 4
Provides endpoints at /api/admin/qc/forms for managing QC forms.
Admin-only access.
"""
import logging
import re
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.models.qc_form import QCForm, QCFormVersion, QCCriterion, QCFormCriterion

router = APIRouter()
logger = logging.getLogger("app.admin_qc")

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
    
    if not code or not name:
        raise HTTPException(status_code=400, detail="code và name là bắt buộc")
    
    # Check duplicate code
    existing = await session.execute(select(QCForm).where(QCForm.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"QC Form code '{code}' đã tồn tại")
    
    form = QCForm(
        code=code,
        name=name,
        description=payload.get("description", ""),
        is_active=payload.get("isActive", True),
    )
    session.add(form)
    await session.flush()
    
    # Create initial version
    version = QCFormVersion(
        form_id=form.id,
        version_no=payload.get("versionNo", "v1.0"),
        status="draft",
        pass_rule={"passThreshold": payload.get("passThreshold", 40)},
    )
    session.add(version)
    await session.commit()
    
    # Reload for response
    query = (
        select(QCForm)
        .options(
            selectinload(QCForm.versions).selectinload(
                QCFormVersion.form_criteria
            ).selectinload(QCFormCriterion.criterion)
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
            ).selectinload(QCFormCriterion.criterion)
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
    
    # Update latest version if provided
    latest_version_data = payload.get("latestVersion", {})
    if latest_version_data and form.versions:
        latest = sorted(form.versions, key=lambda v: v.id, reverse=True)[0]

        new_pass_rule = dict(latest.pass_rule or {})
        if "passThreshold" in latest_version_data:
            new_pass_rule["passThreshold"] = latest_version_data["passThreshold"]

        new_version = QCFormVersion(
            form_id=form.id,
            version_no=latest_version_data.get("versionNo") or _next_version_no(latest.version_no),
            status=latest_version_data.get("status", "draft"),
            pass_rule=new_pass_rule,
            effective_from=latest.effective_from,
            effective_to=latest.effective_to,
        )
        session.add(new_version)
        await session.flush()

        # Preserve immutable history: clone existing criteria mapping to the new version.
        for fc in latest.form_criteria or []:
            session.add(
                QCFormCriterion(
                    form_version_id=new_version.id,
                    criterion_id=fc.criterion_id,
                )
            )
    
    session.add(form)
    await session.commit()
    
    # Reload
    result = await session.execute(query)
    form = result.scalar_one()
    
    return {"success": True, "data": {"item": _serialize_form_detail(form)}}
