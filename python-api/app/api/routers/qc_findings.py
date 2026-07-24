import os
import uuid
from pathlib import Path
from typing import Any, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from sqlalchemy import and_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.core.datetime_utils import utc_now_naive
from app.models.qc_session import QCFinding, QCSession
from app.schemas.qc_finding import (
    QCFindingCreate,
    QCFindingBatchReviewRequest,
    QCFindingRejectRequest,
    QCFindingResolveRequest,
    QCFindingUpdate,
    QCFindingVerifyRequest,
)

router = APIRouter()

ALLOWED_EVIDENCE_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"}
MAX_EVIDENCE_FILES = 5
MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024

async def _write_upload_file(file_path: str, contents: bytes) -> None:
    with open(file_path, "wb") as target:
        target.write(contents)


def _role_value(current_user: CurrentUser) -> str:
    role = getattr(current_user, "role", "")
    return str(getattr(role, "value", role) or "").lower()


def _user_store_ids(current_user: CurrentUser) -> set[int]:
    return {s.id for s in (current_user.stores or []) if getattr(s, "id", None) is not None}


def _can_manage_findings(current_user: CurrentUser) -> bool:
    return _role_value(current_user) in {"admin", "qc"}


def _can_resolve_finding(current_user: CurrentUser, finding: QCFinding) -> bool:
    role = _role_value(current_user)
    if role == "admin":
        return True
    if role == "store":
        return finding.store_id in _user_store_ids(current_user)
    return False


def _assert_can_view_finding(current_user: CurrentUser, finding: QCFinding) -> None:
    role = _role_value(current_user)
    if role in {"admin", "qc"}:
        return
    if role == "store" and finding.store_id in _user_store_ids(current_user):
        return
    if role == "handler" and finding.assignee_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Không có quyền truy cập QC finding này")


async def _load_finding(session: SessionDep, finding_id: int) -> QCFinding:
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).where(QCFinding.id == finding_id)
    result = await session.execute(query)
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(status_code=404, detail="QC finding không tồn tại")
    return finding


def _append_meta_event(finding: QCFinding, event: dict[str, object]) -> None:
    meta_info = dict(finding.meta_info or {})
    timeline = list(meta_info.get("timeline") or [])
    timeline.append(event)
    meta_info["timeline"] = timeline
    finding.meta_info = meta_info


async def _close_session_if_all_findings_verified(session: SessionDep, finding: QCFinding) -> bool:
    if not finding.session_id:
        return False

    result = await session.execute(
        select(QCFinding.status).where(QCFinding.session_id == finding.session_id)
    )
    statuses = [status for status in result.scalars().all()]
    if not statuses or any(status != "verified" for status in statuses):
        return False

    session_result = await session.execute(select(QCSession).where(QCSession.id == finding.session_id))
    qc_session = session_result.scalar_one_or_none()
    if not qc_session or qc_session.status == "closed":
        return False

    qc_session.status = "closed"
    session.add(qc_session)
    return True


def _serialize_datetime(value: object) -> str | None:
    return value.isoformat() if value else None

def serialize_finding(finding: QCFinding) -> dict:
    """Helper to match Strapi's finding serialization."""
    return {
        "id": finding.id,
        "finding_code": finding.finding_code,
        "criterion_name": finding.criterion_name,
        "severity": finding.severity,
        "status": finding.status,
        "due_date": _serialize_datetime(finding.due_date),
        "corrective_action": finding.corrective_action,
        "corrective_note": finding.corrective_note,
        "resolved_at": _serialize_datetime(finding.resolved_at),
        "verified_at": _serialize_datetime(finding.verified_at),
        "evidence": finding.evidence or [],
        "meta_info": finding.meta_info or {},
        "createdAt": _serialize_datetime(finding.created_at),
        "updatedAt": _serialize_datetime(finding.updated_at),
        "session": {"id": finding.session_id} if finding.session_id else None,
        "session_item": {"id": finding.session_item_id} if finding.session_item_id else None,
        "store": {
            "id": finding.store.id,
            "name": finding.store.name,
            "code": finding.store.code
        } if finding.store else None,
        "assignee": {
            "id": finding.assignee.id,
            "name": finding.assignee.name,
            "email": finding.assignee.email
        } if finding.assignee else None,
        "verifier": {
            "id": finding.verifier.id,
            "name": finding.verifier.name,
            "email": finding.verifier.email
        } if finding.verifier else None,
    }

@router.get("/", response_model=dict)
async def list_findings(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0),
    limit: int = Query(200),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    session_id: Optional[int] = Query(None),
) -> Any:
    """List QC findings with filtering and RBAC."""
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).offset(skip).limit(limit).order_by(QCFinding.created_at.desc())

    filters = []
    if status:
        filters.append(QCFinding.status == status)
    if severity:
        filters.append(QCFinding.severity == severity)
    if store_id:
        filters.append(QCFinding.store_id == store_id)
    if session_id:
        filters.append(QCFinding.session_id == session_id)

    # RBAC Scoping
    role = _role_value(current_user)
    if role in {"admin", "qc"}:
        pass
    elif role == "handler":
        filters.append(QCFinding.assignee_id == current_user.id)
    else:
        filters.append(QCFinding.store_id.in_(_user_store_ids(current_user)))

    if filters:
        query = query.where(and_(*filters))

    result = await session.execute(query)
    findings = result.scalars().all()
    
    return {
        "success": True,
        "message": "Lấy danh sách QC finding thành công",
        "data": [serialize_finding(f) for f in findings]
    }

@router.post("/upload-evidence", response_model=dict)
async def upload_finding_evidence(
    current_user: CurrentUser,
    files: list[UploadFile] = File(...),
) -> Any:
    """Upload QC finding evidence images and return static file metadata."""
    if len(files) > MAX_EVIDENCE_FILES:
        raise HTTPException(status_code=400, detail=f"Tối đa {MAX_EVIDENCE_FILES} ảnh một lần")

    upload_dir = "static/uploads/qc-findings"
    os.makedirs(upload_dir, exist_ok=True)
    uploaded_files = []

    for file in files:
        if file.content_type not in ALLOWED_EVIDENCE_MIMES:
            raise HTTPException(status_code=400, detail=f"File {file.filename} không phải ảnh hợp lệ")

        contents = await file.read()
        if len(contents) > MAX_EVIDENCE_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File {file.filename} vượt quá 5MB")

        extension = Path(file.filename or "evidence").suffix.lower()
        filename = f"qc_finding_{uuid.uuid4().hex}{extension}"
        file_path = os.path.join(upload_dir, filename)
        await _write_upload_file(file_path, contents)
        uploaded_files.append({
            "id": uuid.uuid4().hex,
            "url": f"/static/uploads/qc-findings/{filename}",
            "name": file.filename,
            "size": len(contents),
            "mime": file.content_type,
            "ext": extension,
        })

    return {"success": True, "message": "Upload minh chứng QC thành công", "data": {"files": uploaded_files}}


@router.post("/", response_model=dict)
async def create_finding(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    finding_in: QCFindingCreate
) -> Any:
    """Create a manual QC finding."""
    data = finding_in.model_dump()
    
    if not data.get("finding_code"):
        date_part = utc_now_naive().strftime("%Y%m%d")
        random_part = uuid.uuid4().hex[:4].upper()
        data["finding_code"] = f"FD-{date_part}-{random_part}"

    finding = QCFinding(**data)
    session.add(finding)
    await session.commit()
    
    # Reload with relationships
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).where(QCFinding.id == finding.id)
    result = await session.execute(query)
    finding = result.scalar_one()

    return {
        "success": True,
        "message": "Tạo QC finding thành công",
        "data": serialize_finding(finding)
    }

@router.get("/{id}", response_model=dict)
async def read_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get finding details."""
    finding = await _load_finding(session, id)
    _assert_can_view_finding(current_user, finding)
        
    return {
        "success": True,
        "data": serialize_finding(finding)
    }

@router.put("/{id}", response_model=dict)
async def update_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    finding_in: QCFindingUpdate
) -> Any:
    """Update a QC finding."""
    finding = await _load_finding(session, id)
    if not _can_manage_findings(current_user):
        _assert_can_view_finding(current_user, finding)
        disallowed_fields = {"status", "verified_at", "verifier_id", "severity", "assignee_id", "due_date"}
        requested_fields = set(finding_in.model_dump(exclude_unset=True))
        if requested_fields & disallowed_fields:
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật trạng thái QC finding")
    
    update_data = finding_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(finding, field, value)
        
    if "status" in update_data and update_data["status"] == "resolved":
        finding.resolved_at = utc_now_naive()
    if "status" in update_data and update_data["status"] == "verified":
        finding.verified_at = utc_now_naive()
        finding.verifier_id = current_user.id

    session.add(finding)
    await session.commit()
    
    # Reload with relationships
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).where(QCFinding.id == finding.id)
    result = await session.execute(query)
    finding = result.scalar_one()

    return {
        "success": True,
        "message": "Cập nhật QC finding thành công",
        "data": serialize_finding(finding)
    }


@router.post("/{id}/start", response_model=dict)
async def start_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Mark a finding as being fixed by the store."""
    finding = await _load_finding(session, id)
    if not _can_resolve_finding(current_user, finding):
        raise HTTPException(status_code=403, detail="Không có quyền bắt đầu khắc phục QC finding này")
    if finding.status not in {"open", "rejected"}:
        raise HTTPException(status_code=409, detail="QC finding không ở trạng thái có thể bắt đầu khắc phục")

    finding.status = "in_progress"
    _append_meta_event(finding, {
        "type": "started",
        "by": current_user.id,
        "at": utc_now_naive().isoformat(),
    })
    session.add(finding)
    await session.commit()
    return {"success": True, "message": "Đã bắt đầu khắc phục QC finding", "data": serialize_finding(await _load_finding(session, id))}


@router.post("/{id}/resolve", response_model=dict)
async def resolve_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    payload: QCFindingResolveRequest,
) -> Any:
    """Submit remediation evidence for a finding."""
    finding = await _load_finding(session, id)
    if not _can_resolve_finding(current_user, finding):
        raise HTTPException(status_code=403, detail="Không có quyền gửi khắc phục QC finding này")
    if finding.status not in {"open", "in_progress", "rejected"}:
        raise HTTPException(status_code=409, detail="QC finding không ở trạng thái có thể gửi khắc phục")

    finding.corrective_action = payload.corrective_action
    finding.corrective_note = payload.corrective_note.strip()
    finding.evidence = payload.evidence or []
    finding.status = "resolved"
    finding.resolved_at = utc_now_naive()
    _append_meta_event(finding, {
        "type": "resolved",
        "by": current_user.id,
        "at": finding.resolved_at.isoformat(),
        "corrective_note": finding.corrective_note,
        "evidence_count": len(finding.evidence or []),
    })
    session.add(finding)
    await session.commit()
    return {"success": True, "message": "Đã gửi khắc phục QC finding", "data": serialize_finding(await _load_finding(session, id))}


@router.post("/review-batch", response_model=dict)
async def review_findings_batch(
    session: SessionDep,
    current_user: CurrentUser,
    payload: QCFindingBatchReviewRequest,
) -> Any:
    """Apply QC review decisions for multiple resolved findings in one submission."""
    if not _can_manage_findings(current_user):
        raise HTTPException(status_code=403, detail="Không có quyền xác nhận QC finding")

    ids = [item.id for item in payload.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(status_code=400, detail="Danh sách finding bị trùng")

    result = await session.execute(
        select(QCFinding)
        .options(selectinload(QCFinding.store))
        .where(QCFinding.id.in_(ids))
    )
    findings = {finding.id: finding for finding in result.scalars().all()}
    missing_ids = [finding_id for finding_id in ids if finding_id not in findings]
    if missing_ids:
        raise HTTPException(status_code=404, detail="Một số QC finding không tồn tại")

    reviewed_at = utc_now_naive()
    session_ids: set[int] = set()
    reviewed_findings: list[QCFinding] = []

    for item in payload.items:
        finding = findings[item.id]
        if finding.status != "resolved":
            raise HTTPException(status_code=409, detail=f"Finding {finding.finding_code} không ở trạng thái chờ xác nhận")

        note = str(item.note or "").strip()
        if item.decision == "rejected" and not note:
            raise HTTPException(status_code=400, detail=f"Vui lòng nhập lý do chưa đạt cho {finding.finding_code}")

        if item.decision == "verified":
            finding.status = "verified"
            finding.verified_at = reviewed_at
            finding.verifier_id = current_user.id
            _append_meta_event(finding, {
                "type": "verified",
                "by": current_user.id,
                "at": reviewed_at.isoformat(),
                "note": note or None,
            })
        else:
            finding.status = "rejected"
            _append_meta_event(finding, {
                "type": "rejected",
                "by": current_user.id,
                "at": reviewed_at.isoformat(),
                "reason": note,
            })

        if finding.session_id:
            session_ids.add(finding.session_id)
        session.add(finding)
        reviewed_findings.append(finding)

    await session.flush()

    closed_session_ids = []
    for session_id in session_ids:
        status_result = await session.execute(select(QCFinding.status).where(QCFinding.session_id == session_id))
        statuses = [row[0] for row in status_result.all()]
        if statuses and all(status == "verified" for status in statuses):
            session_result = await session.execute(select(QCSession).where(QCSession.id == session_id))
            qc_session = session_result.scalar_one_or_none()
            if qc_session and qc_session.status != "closed":
                qc_session.status = "closed"
                session.add(qc_session)
                closed_session_ids.append(session_id)

    await session.commit()

    refreshed_result = await session.execute(
        select(QCFinding)
        .options(
            selectinload(QCFinding.store),
            selectinload(QCFinding.assignee),
            selectinload(QCFinding.verifier),
        )
        .where(QCFinding.id.in_(ids))
    )
    refreshed = refreshed_result.scalars().all()

    return {
        "success": True,
        "message": "Đã gửi kết quả xác nhận khắc phục",
        "data": [serialize_finding(finding) for finding in refreshed],
        "closedSessionIds": closed_session_ids,
    }

@router.post("/{id}/verify", response_model=dict)
async def verify_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    payload: QCFindingVerifyRequest | None = None,
) -> Any:
    """Verify a resolved finding."""
    if not _can_manage_findings(current_user):
        raise HTTPException(status_code=403, detail="Không có quyền xác nhận QC finding")
    finding = await _load_finding(session, id)
    if finding.status != "resolved":
        raise HTTPException(status_code=409, detail="Chỉ xác nhận QC finding đang chờ QC xác nhận")

    finding.status = "verified"
    finding.verified_at = utc_now_naive()
    finding.verifier_id = current_user.id
    _append_meta_event(finding, {
        "type": "verified",
        "by": current_user.id,
        "at": finding.verified_at.isoformat(),
        "note": payload.verify_note if payload else None,
    })
    session_closed = await _close_session_if_all_findings_verified(session, finding)
    session.add(finding)
    await session.commit()
    message = "Đã xác nhận hoàn tất QC finding"
    if session_closed:
        message = "Đã xác nhận hoàn tất QC finding và đóng phiên QC"
    return {"success": True, "message": message, "data": serialize_finding(await _load_finding(session, id)), "sessionClosed": session_closed}


@router.post("/{id}/reject", response_model=dict)
async def reject_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    payload: QCFindingRejectRequest,
) -> Any:
    """Reject a remediation submission and send it back to the store."""
    if not _can_manage_findings(current_user):
        raise HTTPException(status_code=403, detail="Không có quyền trả lại QC finding")
    finding = await _load_finding(session, id)
    if finding.status != "resolved":
        raise HTTPException(status_code=409, detail="Chỉ trả lại QC finding đang chờ QC xác nhận")

    rejected_at = utc_now_naive()
    finding.status = "rejected"
    _append_meta_event(finding, {
        "type": "rejected",
        "by": current_user.id,
        "at": rejected_at.isoformat(),
        "reason": payload.rejection_reason.strip(),
    })
    session.add(finding)
    await session.commit()
    return {"success": True, "message": "Đã yêu cầu khắc phục lại QC finding", "data": serialize_finding(await _load_finding(session, id))}
