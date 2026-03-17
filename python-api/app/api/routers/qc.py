import uuid
from datetime import datetime, timedelta
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, and_, case
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, CurrentUser
from app.models.qc_session import QCSession, QCSessionItem, QCDraft, QCFinding
from app.models.qc_form import QCForm, QCFormVersion, QCCriterion
from app.models.org import Store

router = APIRouter()

@router.get("/drafts", response_model=dict)
async def read_qc_drafts(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read all QC drafts for current auditor."""
    query = select(QCDraft).where(QCDraft.auditor_id == current_user.id)
    result = await session.execute(query)
    drafts = result.scalars().all()
    serialized_drafts = [
        {
            "id": d.id,
            "store_id": d.store_id,
            "auditor_id": d.auditor_id,
            "template_id": d.template_id,
            "audited_at": d.audited_at,
            "note": d.note,
            "criteria_states": d.criteria_states,
            "created_at": d.created_at
        } for d in drafts
    ]
    return {
        "success": True, 
        "data": serialized_drafts,
        "pagination": {
            "page": 1,
            "pageSize": len(drafts),
            "total": len(drafts),
            "pageCount": 1 if drafts else 0
        }
    }

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
    query = select(QCForm).where(QCForm.id == id).options(selectinload(QCForm.criteria))
    result = await session.execute(query)
    form = result.scalar_one_or_none()
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
        
    return {"success": True, "data": QCFormResponse.model_validate(form)}

@router.get("/sessions/overview", response_model=dict)
async def read_qc_sessions_overview(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
) -> Any:
    """Overview of QC sessions with summary metrics."""
    # 1. Base Query Filters
    filters = []
    if status == "pass":
        filters.append(QCSession.result == "pass")
    elif status == "fail":
        filters.append(QCSession.result == "fail")
        
    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(QCSession.store_id.in_(user_store_ids))
    elif store_id:
        filters.append(QCSession.store_id == store_id)

    # 2. Fetch Sessions with Pagination
    query = select(QCSession).options(
        selectinload(QCSession.store),
        selectinload(QCSession.auditor),
        selectinload(QCSession.form_version).selectinload(QCFormVersion.form),
        selectinload(QCSession.items)
    ).where(and_(*filters) if filters else True).order_by(QCSession.created_at.desc())
    
    # Total Count for Pagination
    count_query = select(func.count()).select_from(QCSession).where(and_(*filters) if filters else True)
    total_res = await session.execute(count_query)
    total_count = total_res.scalar() or 0
    
    # Paging
    query = query.limit(page_size).offset((page - 1) * page_size)
    result = await session.execute(query)
    sessions = result.scalars().all()
    
    # 3. Aggregate Summary (Total, Passed, Failed, Avg Score)
    summary_query = select(
        func.count(QCSession.id).label("total"),
        func.sum(case((QCSession.result == 'pass', 1), else_=0)).label("passed"),
        func.sum(case((QCSession.result == 'fail', 1), else_=0)).label("failed"),
        func.avg(QCSession.total_score).label("avg_score"),
        func.avg(QCSession.max_score).label("avg_max_score"),
    ).where(and_(*filters) if filters else True)
    
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
            "pageSize": page_size,
            "total": total_count,
            "pageCount": (total_count + page_size - 1) // page_size
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
        
    data["code"] = f"QC-{datetime.utcnow().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
    data["audited_at"] = datetime.fromisoformat(data["audited_at"].replace("Z", "+00:00")).replace(tzinfo=None) if isinstance(data.get("audited_at"), str) else data.get("audited_at", datetime.utcnow())
        
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
            note=item_in.get("note"),
            attachments=item_in.get("attachments")
        )
        session.add(item_obj)
        
    await session.commit()
    await session.refresh(qc_session)
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
    sort_by: str = Query("totalSessions"),
    sort_dir: str = Query("desc")
) -> Any:
    """Get QC overview aggregated by store."""
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
                "avgScore": 0, "scoreRate": 0, "passRate": 0, "lastAuditedAt": None
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
                "passRate": round((passed / totalS * 100)) if totalS > 0 else 0,
                "lastAuditedAt": agg.lastAuditedAt.isoformat() if agg.lastAuditedAt else None
            }
        store_stats.append(stat)

    # 6. Sorting
    reverse = (sort_dir == "desc")
    # Mapping FE keys to our stat keys if needed
    store_stats.sort(key=lambda x: (x.get(sort_by) if x.get(sort_by) is not None else 0), reverse=reverse)
    
    # 7. Pagination
    total = len(store_stats)
    start = (page - 1) * page_size
    paged_stats = store_stats[start:start + page_size]
    
    # Summary calculation
    summary = {
        "totalSessions": summary_metrics["totalSessions"],
        "passed": summary_metrics["passed"],
        "failed": summary_metrics["failed"],
        "avgScore": round(summary_metrics["totalScore"] / summary_metrics["totalSessions"], 1) if summary_metrics["totalSessions"] > 0 else 0,
        "scoreRate": round((summary_metrics["totalScore"] / summary_metrics["maxScore"] * 100), 1) if summary_metrics["maxScore"] > 0 else 0,
        "passRate": round((summary_metrics["passed"] / summary_metrics["totalSessions"] * 100)) if summary_metrics["totalSessions"] > 0 else 0,
    }

    return {
        "success": True,
        "message": "Lấy thống kê QC theo cửa hàng thành công",
        "data": paged_stats,
        "summary": summary,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "pageCount": (total + page_size - 1) // page_size
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
    qc_session.submitted_at = datetime.utcnow()
    
    session.add(qc_session)
    
    # Generate findings for failed items
    new_findings = []
    if not is_pass:
        for item in items:
            if item.result == "fail":
                timestamp = datetime.utcnow().strftime("%y%m%d%H%M%S")
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
                    due_date=datetime.utcnow() + timedelta(days=3) # Default 3 days
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
