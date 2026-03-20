from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator

from app.core.datetime_utils import ensure_utc_naive


class UTCNaiveDateTime(TypeDecorator):
    """Store and return datetimes as UTC-naive to match timestamp-without-time-zone columns."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if not isinstance(value, datetime):
            raise TypeError("UTCNaiveDateTime only accepts datetime values")
        return ensure_utc_naive(value)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        return ensure_utc_naive(value)
