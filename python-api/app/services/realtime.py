import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.core.datetime_utils import utc_now_naive

logger = logging.getLogger("app.realtime")


class RealtimeConnectionManager:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._user_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._ticket_connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._socket_index: dict[WebSocket, tuple[int, int | None]] = {}

    async def connect_user_channel(self, websocket: WebSocket, user_id: int) -> None:
        await websocket.accept()
        async with self._lock:
            self._user_connections[user_id].add(websocket)
            self._socket_index[websocket] = (user_id, None)

    async def connect_ticket_channel(self, websocket: WebSocket, user_id: int, ticket_id: int) -> None:
        await websocket.accept()
        async with self._lock:
            self._user_connections[user_id].add(websocket)
            self._ticket_connections[ticket_id].add(websocket)
            self._socket_index[websocket] = (user_id, ticket_id)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            meta = self._socket_index.pop(websocket, None)
            if not meta:
                return

            user_id, ticket_id = meta

            user_set = self._user_connections.get(user_id)
            if user_set:
                user_set.discard(websocket)
                if not user_set:
                    self._user_connections.pop(user_id, None)

            if ticket_id is None:
                return

            ticket_set = self._ticket_connections.get(ticket_id)
            if ticket_set:
                ticket_set.discard(websocket)
                if not ticket_set:
                    self._ticket_connections.pop(ticket_id, None)

    async def emit_user_event(self, user_id: int, event: str, data: Any) -> None:
        async with self._lock:
            sockets = list(self._user_connections.get(user_id, set()))
        await self._emit_to_sockets(sockets, event, data)

    async def emit_ticket_event(self, ticket_id: int, event: str, data: Any) -> None:
        async with self._lock:
            sockets = list(self._ticket_connections.get(ticket_id, set()))
        await self._emit_to_sockets(sockets, event, data)

    async def _emit_to_sockets(self, sockets: list[WebSocket], event: str, data: Any) -> None:
        if not sockets:
            return

        payload = {
            "event": event,
            "data": data,
            "timestamp": utc_now_naive().isoformat(),
        }

        disconnected: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                disconnected.append(socket)

        for socket in disconnected:
            logger.debug("Removing stale websocket connection.")
            await self.disconnect(socket)


realtime_manager = RealtimeConnectionManager()

