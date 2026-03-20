from datetime import datetime, timezone
from pathlib import Path

from app.core.datetime_utils import (
    ensure_utc_naive,
    parse_datetime_to_utc_naive,
    utc_now_naive,
)
from app.db.types import UTCNaiveDateTime


def test_datetime_utils_normalize_to_utc_naive():
    aware_dt = datetime(2026, 3, 20, 7, 0, tzinfo=timezone.utc)
    naive_dt = datetime(2026, 3, 20, 7, 0)

    assert ensure_utc_naive(aware_dt) == naive_dt
    assert ensure_utc_naive(naive_dt) == naive_dt
    assert ensure_utc_naive(None) is None

    parsed = parse_datetime_to_utc_naive("2026-03-20T07:00:00Z")
    assert parsed == naive_dt
    assert parsed.tzinfo is None

    now = utc_now_naive()
    assert now.tzinfo is None


def test_utc_naive_type_decorator_normalizes_bind_and_result():
    dtype = UTCNaiveDateTime()
    aware_dt = datetime(2026, 3, 20, 7, 0, tzinfo=timezone.utc)
    naive_dt = datetime(2026, 3, 20, 7, 0)

    assert dtype.process_bind_param(aware_dt, None) == naive_dt
    assert dtype.process_bind_param(naive_dt, None) == naive_dt
    assert dtype.process_bind_param(None, None) is None

    assert dtype.process_result_value(aware_dt, None) == naive_dt
    assert dtype.process_result_value(naive_dt, None) == naive_dt


def test_no_direct_timezone_now_calls_outside_datetime_utils():
    app_root = Path(__file__).resolve().parents[1]
    scan_roots = [
        app_root / "api",
        app_root / "services",
        app_root / "core",
    ]
    allowed_file = app_root / "core" / "datetime_utils.py"

    forbidden_patterns = (
        "datetime.now(timezone.utc)",
        "datetime.utcnow(",
        ".replace(tzinfo=None)",
    )

    violations: list[str] = []
    for root in scan_roots:
        for path in root.rglob("*.py"):
            if path == allowed_file:
                continue
            text = path.read_text(encoding="utf-8")
            if any(pattern in text for pattern in forbidden_patterns):
                violations.append(str(path.relative_to(app_root)))

    assert violations == [], f"Use app.core.datetime_utils instead: {violations}"
