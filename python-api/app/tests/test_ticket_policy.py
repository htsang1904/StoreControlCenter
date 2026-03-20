from app.services.ticket_policy import (
    can_access_ticket,
    can_assign_handler,
    can_claim_ticket,
    can_reject_ticket,
    can_reopen_ticket,
    can_resolve_ticket,
    validate_direct_status_update,
)


def test_can_access_ticket_for_store_scope():
    assert can_access_ticket(
        user_role="store",
        user_id=10,
        user_department_id=None,
        user_store_ids={1, 2},
        ticket_store_id=2,
        ticket_department_id=5,
        ticket_handler_id=None,
        ticket_requester_id=9,
        is_assignee=False,
    )
    assert not can_access_ticket(
        user_role="store",
        user_id=10,
        user_department_id=None,
        user_store_ids={1, 2},
        ticket_store_id=3,
        ticket_department_id=5,
        ticket_handler_id=None,
        ticket_requester_id=9,
        is_assignee=False,
    )


def test_can_access_ticket_for_handler_scope():
    assert can_access_ticket(
        user_role="handler",
        user_id=7,
        user_department_id=4,
        user_store_ids=set(),
        ticket_store_id=2,
        ticket_department_id=4,
        ticket_handler_id=None,
        ticket_requester_id=9,
        is_assignee=False,
    )
    assert can_access_ticket(
        user_role="handler",
        user_id=7,
        user_department_id=4,
        user_store_ids=set(),
        ticket_store_id=2,
        ticket_department_id=99,
        ticket_handler_id=None,
        ticket_requester_id=9,
        is_assignee=True,
    )
    assert not can_access_ticket(
        user_role="handler",
        user_id=7,
        user_department_id=4,
        user_store_ids=set(),
        ticket_store_id=2,
        ticket_department_id=99,
        ticket_handler_id=None,
        ticket_requester_id=9,
        is_assignee=False,
    )


def test_can_access_ticket_for_requester_fallback():
    assert can_access_ticket(
        user_role="unknown",
        user_id=15,
        user_department_id=None,
        user_store_ids=set(),
        ticket_store_id=1,
        ticket_department_id=2,
        ticket_handler_id=None,
        ticket_requester_id=15,
        is_assignee=False,
    )
    assert not can_access_ticket(
        user_role="unknown",
        user_id=16,
        user_department_id=None,
        user_store_ids=set(),
        ticket_store_id=1,
        ticket_department_id=2,
        ticket_handler_id=None,
        ticket_requester_id=15,
        is_assignee=False,
    )


def test_validate_direct_status_update():
    ok, msg = validate_direct_status_update(user_role="admin", old_status="in_progress", new_status="resolved")
    assert ok and msg == ""

    ok, msg = validate_direct_status_update(user_role="store", old_status="in_progress", new_status="resolved")
    assert not ok and "Chỉ admin" in msg

    ok, msg = validate_direct_status_update(user_role="admin", old_status="resolved", new_status="new")
    assert not ok and "Không thể chuyển trạng thái" in msg


def test_assign_and_claim_rules():
    ok, _ = can_assign_handler("admin", "new")
    assert ok
    ok, msg = can_assign_handler("handler", "new")
    assert not ok and "Chỉ admin" in msg

    ok, _ = can_claim_ticket("handler", "assigned")
    assert ok
    ok, msg = can_claim_ticket("store", "assigned")
    assert not ok and "Chỉ handler/admin" in msg


def test_can_claim_ticket_accepts_enum_role_values():
    from app.models.user import UserRole

    ok, _ = can_claim_ticket(UserRole.admin, "new")
    assert ok

    ok, _ = can_claim_ticket(UserRole.handler, "assigned")
    assert ok


def test_resolve_reopen_reject_rules():
    ok, _ = can_resolve_ticket("admin", "in_progress", is_assignee=False)
    assert ok

    ok, _ = can_resolve_ticket("handler", "in_progress", is_assignee=True)
    assert ok

    ok, msg = can_resolve_ticket("handler", "in_progress", is_assignee=False)
    assert not ok and "Handler cần tiếp nhận" in msg

    ok, _ = can_reopen_ticket("store", "resolved")
    assert ok

    ok, msg = can_reopen_ticket("handler", "resolved")
    assert not ok and "Chỉ admin hoặc store" in msg

    ok, _ = can_reject_ticket("admin", "new")
    assert ok

    ok, msg = can_reject_ticket("store", "new")
    assert not ok and "Chỉ admin" in msg
