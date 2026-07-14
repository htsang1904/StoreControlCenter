from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services import notification_service, onesignal_client


class _FakeResponse:
    status_code = 200
    text = '{"id":"message-123"}'

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"id": "message-123"}


class _FakeAsyncClient:
    captured: dict = {}

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def post(self, url, *, json, headers):
        self.captured = {
            "url": url,
            "json": json,
            "headers": headers,
        }
        _FakeAsyncClient.captured = self.captured
        return _FakeResponse()


@pytest.mark.anyio
async def test_send_push_targets_external_user_ids(monkeypatch):
    monkeypatch.setattr(settings, "ONESIGNAL_APP_ID", "app-id")
    monkeypatch.setattr(settings, "ONESIGNAL_REST_API_KEY", "rest-key")
    monkeypatch.setattr(settings, "ONESIGNAL_API_URL", "https://api.onesignal.test/notifications")
    monkeypatch.setattr(onesignal_client.httpx, "AsyncClient", _FakeAsyncClient)

    result = await onesignal_client.send_push_to_external_ids(
        external_ids=["12", "12", "18"],
        heading="Ticket mới",
        content="Có ticket cần xử lý",
        url="https://app.example/ticket/inbox?ticket=7",
        data={"ticket_id": 7},
    )

    assert result.success is True
    assert result.message_id == "message-123"
    assert _FakeAsyncClient.captured["json"]["include_aliases"] == {
        "external_id": ["12", "18"],
    }
    assert _FakeAsyncClient.captured["json"]["target_channel"] == "push"
    assert _FakeAsyncClient.captured["headers"]["Authorization"] == "Key rest-key"


@pytest.mark.anyio
async def test_notification_dispatch_batches_same_event_by_recipient(monkeypatch):
    captured_calls = []

    async def _capture_send(**kwargs):
        captured_calls.append(kwargs)
        return SimpleNamespace(
            success=True,
            message_id="message-456",
            status_code=200,
            response_body="{}",
            error=None,
        )

    monkeypatch.setattr(settings, "APP_PUBLIC_URL", "https://app.example/")
    monkeypatch.setattr(notification_service, "send_push_to_external_ids", _capture_send)

    notifications = [
        SimpleNamespace(
            title="Phản hồi mới - TCK-1",
            message="Có phản hồi mới",
            recipient_id=12,
            ticket_id=7,
            meta_info={"kind": "ticket_reply"},
        ),
        SimpleNamespace(
            title="Phản hồi mới - TCK-1",
            message="Có phản hồi mới",
            recipient_id=18,
            ticket_id=7,
            meta_info={"kind": "ticket_reply"},
        ),
    ]

    await notification_service.send_onesignal_notifications(notifications)

    assert len(captured_calls) == 1
    assert captured_calls[0]["external_ids"] == ["12", "18"]
    assert captured_calls[0]["url"] == "https://app.example/ticket/inbox?ticket=7"
    assert captured_calls[0]["data"]["kind"] == "ticket_reply"


@pytest.mark.anyio
async def test_created_event_also_dispatches_onesignal(monkeypatch):
    realtime_calls = []
    push_calls = []

    async def _load_unread(_session, recipient_ids):
        return {recipient_id: 1 for recipient_id in recipient_ids}

    async def _emit_user_event(*args):
        realtime_calls.append(args)

    async def _send_push(notifications):
        push_calls.append(notifications)

    monkeypatch.setattr(notification_service, "_load_unread_count_by_user", _load_unread)
    monkeypatch.setattr(notification_service.realtime_manager, "emit_user_event", _emit_user_event)
    monkeypatch.setattr(notification_service, "send_onesignal_notifications", _send_push)

    notification = SimpleNamespace(
        id=99,
        title="Ticket mới - TCK-1",
        message="Có ticket mới",
        type="info",
        is_read=False,
        read_at=None,
        meta_info={"kind": "ticket_created"},
        recipient_id=12,
        actor_id=3,
        ticket_id=7,
        created_at=None,
        updated_at=None,
    )

    await notification_service.emit_notification_created_events(object(), [notification])

    assert realtime_calls[0][0:2] == (12, "notification.created")
    assert push_calls == [[notification]]


@pytest.mark.anyio
async def test_missing_backend_config_skips_push(monkeypatch):
    monkeypatch.setattr(settings, "ONESIGNAL_APP_ID", "")
    monkeypatch.setattr(settings, "ONESIGNAL_REST_API_KEY", "")

    result = await onesignal_client.send_push_to_external_ids(
        external_ids=["12"],
        heading="Thông báo",
        content="Nội dung",
    )

    assert result.success is False
    assert result.error == "missing_onesignal_config"


def test_ticket_activity_notifications_exclude_actor_and_duplicate_recipients():
    notifications = notification_service.build_ticket_activity_notifications(
        recipient_ids=[10, 11, 12, 12, None],
        actor_id=10,
        actor_name="  Admin Test  ",
        ticket_id=7,
        ticket_code="TCK-7",
        title="Ticket da xu ly - TCK-7",
        message="{actor_name} da xu ly ticket {ticket_code}.",
        kind="ticket_resolved",
        notification_type="success",
        extra_meta={"status": "resolved"},
    )

    assert [item.recipient_id for item in notifications] == [11, 12]
    assert all(item.actor_id == 10 for item in notifications)
    assert all(item.message == "Admin Test da xu ly ticket TCK-7." for item in notifications)
    assert all(item.type == "success" for item in notifications)
    assert all(
        item.meta_info
        == {
            "ticket_id": 7,
            "ticket_code": "TCK-7",
            "kind": "ticket_resolved",
            "status": "resolved",
        }
        for item in notifications
    )
