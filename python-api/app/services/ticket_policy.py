from __future__ import annotations

from typing import Iterable


OPEN_TICKET_STATUSES = {"new", "assigned", "in_progress"}
RESOLVABLE_STATUSES = {"in_progress"}
REOPENABLE_STATUSES = {"resolved"}
REJECTABLE_STATUSES = {"new", "assigned", "in_progress"}

ALLOWED_STATUS_TRANSITIONS = {
    "new": {"assigned", "in_progress", "rejected"},
    "assigned": {"in_progress", "rejected"},
    "in_progress": {"resolved", "rejected"},
    "resolved": {"in_progress"},
    "rejected": {"in_progress"},
    "closed": set(),
}


def normalize_status(status: str | None) -> str:
    return str(status or "").strip().lower()


def normalize_role(role: str | None) -> str:
    return str(role or "").strip().lower()


def can_access_ticket(
    *,
    user_role: str | None,
    user_id: int | None,
    user_department_id: int | None,
    user_store_ids: Iterable[int] | None,
    ticket_store_id: int | None,
    ticket_department_id: int | None,
    ticket_handler_id: int | None,
    ticket_requester_id: int | None,
    is_assignee: bool,
) -> bool:
    role = normalize_role(user_role)

    if role in {"admin", "qc"}:
        return True

    if role == "store":
        store_ids = set(user_store_ids or [])
        return ticket_store_id in store_ids

    if role == "handler":
        if user_department_id and ticket_department_id == user_department_id:
            return True
        if user_id and ticket_handler_id == user_id:
            return True
        return is_assignee

    return bool(user_id and ticket_requester_id == user_id)


def validate_direct_status_update(
    *,
    user_role: str | None,
    old_status: str | None,
    new_status: str | None,
) -> tuple[bool, str]:
    role = normalize_role(user_role)
    old_val = normalize_status(old_status)
    new_val = normalize_status(new_status)

    if new_val == old_val:
        return True, ""

    if role != "admin":
        return False, "Chỉ admin mới có thể cập nhật status trực tiếp"

    allowed_next = ALLOWED_STATUS_TRANSITIONS.get(old_val, set())
    if new_val not in allowed_next:
        return (
            False,
            f"Không thể chuyển trạng thái từ '{old_val}' sang '{new_val}' bằng endpoint cập nhật",
        )

    return True, ""


def can_assign_handler(user_role: str | None, ticket_status: str | None) -> tuple[bool, str]:
    role = normalize_role(user_role)
    status = normalize_status(ticket_status)

    if role != "admin":
        return False, "Chỉ admin mới có quyền phân công ticket"
    if status not in OPEN_TICKET_STATUSES:
        return False, f"Không thể phân công ở trạng thái '{ticket_status}'"
    return True, ""


def can_claim_ticket(user_role: str | None, ticket_status: str | None) -> tuple[bool, str]:
    role = normalize_role(user_role)
    status = normalize_status(ticket_status)

    if role not in {"admin", "handler"}:
        return False, "Chỉ handler/admin mới có thể nhận xử lý"
    if status not in OPEN_TICKET_STATUSES:
        return False, f"Không thể nhận xử lý ở trạng thái '{ticket_status}'"
    return True, ""


def can_resolve_ticket(
    user_role: str | None,
    ticket_status: str | None,
    *,
    is_assignee: bool,
) -> tuple[bool, str]:
    role = normalize_role(user_role)
    status = normalize_status(ticket_status)

    if status not in RESOLVABLE_STATUSES:
        return False, f"Không thể đánh dấu đã xử lý ở trạng thái '{ticket_status}'"

    if role == "admin":
        return True, ""
    if role == "handler":
        if not is_assignee:
            return False, "Handler cần tiếp nhận ticket trước khi đánh dấu đã xử lý"
        return True, ""

    return False, "Không có quyền chuyển ticket sang đã xử lý"


def can_reopen_ticket(user_role: str | None, ticket_status: str | None) -> tuple[bool, str]:
    role = normalize_role(user_role)
    status = normalize_status(ticket_status)

    if status not in REOPENABLE_STATUSES:
        return False, f"Không thể mở lại ticket ở trạng thái '{ticket_status}'"
    if role not in {"admin", "store"}:
        return False, "Chỉ admin hoặc store mới có quyền mở lại ticket"
    return True, ""


def can_reject_ticket(user_role: str | None, ticket_status: str | None) -> tuple[bool, str]:
    role = normalize_role(user_role)
    status = normalize_status(ticket_status)

    if role != "admin":
        return False, "Chỉ admin mới có quyền từ chối ticket"
    if status not in REJECTABLE_STATUSES:
        return False, f"Không thể từ chối ticket ở trạng thái '{ticket_status}'"
    return True, ""
