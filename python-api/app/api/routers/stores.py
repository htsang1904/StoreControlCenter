from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy.future import select

from app.api.deps import SessionDep, CurrentUser
from app.models.user import UserRole
from app.models.org import Store
from app.schemas.org import StoreResponse, StoreCreate

router = APIRouter()

MAIN_STORE_SYNC_URL = "https://gapi.guta.asia/webapi/stores?all_stores=true"

def extract_store_list(payload: Any) -> List[Any]:
    if isinstance(payload, list): return payload
    if isinstance(payload, dict):
        for key in ["data", "stores", "result", "items"]:
            if isinstance(payload.get(key), list):
                return payload[key]
        if isinstance(payload.get("data"), dict) and isinstance(payload["data"].get("stores"), list):
            return payload["data"]["stores"]
    return []

def normalize_store_item(item: Any) -> Any:
    store_id = str(item.get("storeId") or item.get("store_id") or item.get("id") or "").strip()
    if not store_id: return None
    
    return {
        "storeId": store_id,
        "code": str(item.get("code") or item.get("store_code") or "").strip() or None,
        "name": str(item.get("name") or item.get("store_name") or item.get("storeName") or "").strip() or None,
        "address": str(item.get("address") or "").strip() or None,
        "shortAddress": str(item.get("shortAddress") or item.get("short_address") or "").strip() or None,
        "brandId": str(item.get("brandId") or item.get("brand_id") or "").strip() or None,
        "is_active": True
    }

@router.get("/", response_model=dict)
async def read_stores(
    session: SessionDep,
    current_user: CurrentUser, # Guard route
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Read all stores."""
    result = await session.execute(select(Store).offset(skip).limit(limit))
    items = result.scalars().all()
    serialized_items = [StoreResponse.model_validate(item) for item in items]
    return {"success": True, "data": serialized_items}

@router.post("/", response_model=dict)
async def create_store(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    store_in: StoreCreate
) -> Any:
    """Create a new store."""
    if current_user.role != UserRole.admin:
         raise HTTPException(status_code=403, detail="Not enough permissions")
         
    store = Store(**store_in.model_dump())
    session.add(store)
    await session.commit()
    await session.refresh(store)
    return {"success": True, "data": StoreResponse.model_validate(store)}
from sqlalchemy.ext.asyncio import AsyncSession


@router.post("/sync", response_model=dict)
async def sync_all_stores(
    session: SessionDep,
    current_user: CurrentUser
) -> Any:
    """Sync all stores from external Suite API."""
    if current_user.role != UserRole.admin:
         raise HTTPException(status_code=403, detail="Not enough permissions")

    return await perform_store_sync(session)

async def perform_store_sync(session: AsyncSession) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(MAIN_STORE_SYNC_URL)
            response.raise_for_status()
            payload = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stores: {str(e)}")

    source_stores = extract_store_list(payload)
    if not source_stores:
        return {"success": True, "message": "No stores found to sync", "data": {"synced": 0}}

    normalized_stores = [normalize_store_item(s) for s in source_stores]
    normalized_stores = [s for s in normalized_stores if s]

    # Batch fetch existing stores
    result = await session.execute(select(Store))
    existing_stores = result.scalars().all()
    existing_map = {s.storeId: s for s in existing_stores if s.storeId}

    created = 0
    updated = 0
    skipped = 0

    for store_data in normalized_stores:
        existed = existing_map.get(store_data["storeId"])
        
        if not existed:
            new_store = Store(**store_data)
            session.add(new_store)
            created += 1
        else:
            # Check for changes
            has_changed = False
            for key, val in store_data.items():
                if getattr(existed, key) != val:
                    setattr(existed, key, val)
                    has_changed = True
            
            if has_changed:
                session.add(existed)
                updated += 1
            else:
                skipped += 1

    await session.commit()

    return {
        "success": True,
        "message": "Đồng bộ cửa hàng thành công",
        "data": {
            "synced": len(normalized_stores),
            "created": created,
            "updated": updated,
            "skipped": skipped
        }
    }
