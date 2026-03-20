from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.api.routers.qc import router as qc_router
from app.db.database import get_db


class _FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self._next_id = 1000

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: object) -> None:
        self._next_id += 1
        if getattr(obj, "id", None) is None:
            setattr(obj, "id", self._next_id)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if getattr(obj, "created_at", None) is None:
            setattr(obj, "created_at", now)
        setattr(obj, "updated_at", now)


def _build_user(role: str, user_id: int, store_ids: list[int]) -> SimpleNamespace:
    stores = [SimpleNamespace(id=store_id) for store_id in store_ids]
    return SimpleNamespace(id=user_id, role=role, stores=stores)


def _build_client(current_user: SimpleNamespace, fake_session: _FakeSession) -> TestClient:
    app = FastAPI()
    app.include_router(qc_router, prefix="/api/qc")

    async def _override_get_current_user() -> SimpleNamespace:
        return current_user

    async def _override_get_db() -> _FakeSession:
        return fake_session

    app.dependency_overrides[get_current_user] = _override_get_current_user
    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def _draft_payload(store_id: int) -> dict[str, object]:
    return {
        "storeId": store_id,
        "templateId": "QC-TEMPLATE-1",
        "auditedAt": "2026-03-20T05:00:00Z",
        "note": "draft for access check",
        "criteriaStates": {"A.1": {"status": "pass"}},
    }


def test_store_user_cannot_create_draft_for_unassigned_store():
    user = _build_user(role="store", user_id=11, store_ids=[1])
    session = _FakeSession()
    client = _build_client(user, session)

    response = client.post("/api/qc/drafts", json=_draft_payload(store_id=2))

    assert response.status_code == 403
    assert response.json()["detail"] == "Không có quyền thao tác nháp cho cửa hàng này"


def test_store_user_can_create_draft_for_assigned_store():
    user = _build_user(role="store", user_id=12, store_ids=[2, 9])
    session = _FakeSession()
    client = _build_client(user, session)

    response = client.post("/api/qc/drafts", json=_draft_payload(store_id=2))

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["storeId"] == 2
    assert body["data"]["auditorId"] == 12
    assert len(session.added) == 1


def test_admin_can_create_draft_for_any_store():
    user = _build_user(role="admin", user_id=1, store_ids=[])
    session = _FakeSession()
    client = _build_client(user, session)

    response = client.post("/api/qc/drafts", json=_draft_payload(store_id=999))

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["storeId"] == 999
    assert body["data"]["auditorId"] == 1
