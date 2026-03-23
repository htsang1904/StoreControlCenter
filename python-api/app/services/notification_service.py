from typing import Iterable

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.notification import Notification
from app.schemas.notification import NotificationResponse
from app.services.realtime import realtime_manager


def normalize_recipient_ids(recipient_ids: Iterable[int | None], *, exclude_user_id: int | None = None) -> list[int]:
    unique_ids: list[int] = []
    seen: set[int] = set()

    for raw_id in recipient_ids:
        if raw_id is None:
            continue
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if user_id <= 0:
            continue
        if exclude_user_id is not None and user_id == exclude_user_id:
            continue
        if user_id in seen:
            continue
        seen.add(user_id)
        unique_ids.append(user_id)

    return unique_ids


def build_ticket_reply_notifications(
    *,
    recipient_ids: Iterable[int | None],
    actor_id: int,
    actor_name: str,
    ticket_id: int,
    ticket_code: str,
    log_id: int,
    message_preview: str,
    include_actor: bool = False,
) -> list[Notification]:
    recipients = normalize_recipient_ids(
        recipient_ids,
        exclude_user_id=None if include_actor else actor_id,
    )
    if not recipients:
        return []

    actor_display_name = actor_name.strip() if actor_name and actor_name.strip() else f"User #{actor_id}"
    notification_title = f"Phản hồi mới - {ticket_code}"
    notification_message = f"{actor_display_name} vừa phản hồi ticket {ticket_code}: {message_preview}"

    notifications: list[Notification] = []
    for recipient_id in recipients:
        notifications.append(
            Notification(
                title=notification_title,
                message=notification_message,
                type="info",
                recipient_id=recipient_id,
                actor_id=actor_id,
                ticket_id=ticket_id,
                meta_info={
                    "ticket_id": ticket_id,
                    "ticket_code": ticket_code,
                    "ticket_log_id": log_id,
                    "kind": "ticket_reply",
                },
            )
        )
    return notifications


async def emit_notification_created_events(
    session: AsyncSession,
    notifications: list[Notification],
) -> None:
    if not notifications:
        return

    recipient_ids = normalize_recipient_ids([item.recipient_id for item in notifications])
    unread_count_by_user = await _load_unread_count_by_user(session, recipient_ids)

    for notification in notifications:
        payload = NotificationResponse.model_validate(notification).model_dump(mode="json")
        await realtime_manager.emit_user_event(
            int(notification.recipient_id),
            "notification.created",
            {
                "notification": payload,
                "unread_count": unread_count_by_user.get(int(notification.recipient_id), 0),
            },
        )


async def emit_notification_unread_count_event(user_id: int, unread_count: int) -> None:
    await realtime_manager.emit_user_event(
        int(user_id),
        "notification.unread_count.updated",
        {"unread_count": int(unread_count)},
    )


async def _load_unread_count_by_user(
    session: AsyncSession,
    recipient_ids: list[int],
) -> dict[int, int]:
    if not recipient_ids:
        return {}

    query = (
        select(Notification.recipient_id, func.count(Notification.id))
        .where(
            Notification.recipient_id.in_(recipient_ids),
            Notification.is_read == False,  # noqa: E712
        )
        .group_by(Notification.recipient_id)
    )
    result = await session.execute(query)
    rows = result.all()

    unread_count_by_user = {recipient_id: 0 for recipient_id in recipient_ids}
    for recipient_id, unread_count in rows:
        unread_count_by_user[int(recipient_id)] = int(unread_count or 0)

    return unread_count_by_user
