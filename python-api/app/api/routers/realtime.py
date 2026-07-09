from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_user_from_token
from app.db.database import SessionLocal
from app.models.notification import Notification
from app.models.ticket import Ticket
from app.models.user import User
from app.services.realtime import realtime_manager
from app.services.ticket_policy import can_access_ticket

router = APIRouter()


def _get_user_store_ids(user: User) -> set[int]:
    return {store.id for store in user.stores if getattr(store, "id", None) is not None}


def _extract_token(websocket: WebSocket) -> Optional[str]:
    token = (
        websocket.query_params.get("token")
        or websocket.query_params.get("access_token")
        or websocket.query_params.get("accessToken")
    )
    if token:
        return token

    auth_header = websocket.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


async def _authenticate_websocket(websocket: WebSocket) -> Optional[User]:
    token = _extract_token(websocket)
    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Missing Bearer token",
        )
        return None

    async with SessionLocal() as session:
        try:
            return await get_user_from_token(session, token)
        except HTTPException:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Invalid credentials",
            )
            return None


async def _is_handler_assignee(ticket_id: int, user_id: int) -> bool:
    async with SessionLocal() as session:
        assigned_result = await session.execute(
            select(func.count())
            .select_from(Ticket)
            .where(Ticket.id == ticket_id, Ticket.assignees.any(id=user_id))
        )
        return (assigned_result.scalar() or 0) > 0


async def _can_access_ticket_for_ws(ticket: Ticket, current_user: User) -> bool:
    is_assignee = False
    role_value = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_value.lower() == "handler":
        is_assignee = await _is_handler_assignee(ticket.id, current_user.id)

    return can_access_ticket(
        user_role=current_user.role,
        user_id=current_user.id,
        user_department_id=current_user.department_id,
        user_store_ids=_get_user_store_ids(current_user),
        ticket_store_id=ticket.store_id,
        ticket_department_id=ticket.responsible_department_id,
        ticket_requester_id=ticket.requester_id,
        is_assignee=is_assignee,
    )


async def _read_unread_notification_count(user_id: int) -> int:
    async with SessionLocal() as session:
        unread_query = select(func.count()).select_from(Notification).where(
            Notification.recipient_id == user_id,
            Notification.is_read == False,  # noqa: E712
        )
        unread_result = await session.execute(unread_query)
        return int(unread_result.scalar() or 0)


@router.websocket("/ws/notifications")
async def notifications_socket(websocket: WebSocket) -> None:
    current_user = await _authenticate_websocket(websocket)
    if current_user is None:
        return

    await realtime_manager.connect_user_channel(websocket, current_user.id)
    unread_count = await _read_unread_notification_count(current_user.id)
    await websocket.send_json(
        {
            "event": "realtime.connected",
            "data": {
                "channel": "notifications",
                "user_id": current_user.id,
                "unread_count": unread_count,
            },
        }
    )

    try:
        while True:
            payload = await websocket.receive_text()
            if payload.strip().lower() == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
    except WebSocketDisconnect:
        await realtime_manager.disconnect(websocket)
    except Exception:
        await realtime_manager.disconnect(websocket)
        try:
            await websocket.close()
        except RuntimeError:
            pass


@router.websocket("/ws/tickets/{ticket_id}")
async def ticket_socket(websocket: WebSocket, ticket_id: int) -> None:
    current_user = await _authenticate_websocket(websocket)
    if current_user is None:
        return

    async with SessionLocal() as session:
        result = await session.execute(
            select(Ticket)
            .options(selectinload(Ticket.assignees))
            .where(Ticket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()

    if not ticket:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Ticket not found",
        )
        return

    if not await _can_access_ticket_for_ws(ticket, current_user):
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="No permission to access ticket",
        )
        return

    await realtime_manager.connect_ticket_channel(websocket, current_user.id, ticket_id)
    await websocket.send_json(
        {
            "event": "realtime.connected",
            "data": {
                "channel": "ticket",
                "ticket_id": ticket_id,
                "user_id": current_user.id,
            },
        }
    )

    try:
        while True:
            payload = await websocket.receive_text()
            if payload.strip().lower() == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
    except WebSocketDisconnect:
        await realtime_manager.disconnect(websocket)
    except Exception:
        await realtime_manager.disconnect(websocket)
        try:
            await websocket.close()
        except RuntimeError:
            pass
