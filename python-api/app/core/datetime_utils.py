from __future__ import annotations

from datetime import datetime, timezone


def utc_now_naive() -> datetime:
    """Return current UTC timestamp as naive datetime for timestamp-without-time-zone columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def ensure_utc_naive(value: datetime | None) -> datetime | None:
    """Normalize datetime to UTC-naive representation."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def parse_datetime_to_utc_naive(
    value: object,
    *,
    fallback: datetime | None = None,
) -> datetime:
    """Parse datetime input and normalize to UTC-naive."""
    if isinstance(value, datetime):
        normalized = ensure_utc_naive(value)
        if normalized is not None:
            return normalized

    if isinstance(value, str):
        text = value.strip()
        if text:
            try:
                parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
                normalized = ensure_utc_naive(parsed)
                if normalized is not None:
                    return normalized
            except ValueError:
                pass

    normalized_fallback = ensure_utc_naive(fallback)
    return normalized_fallback or utc_now_naive()
