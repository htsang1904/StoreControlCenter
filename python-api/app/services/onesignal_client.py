import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import httpx

from app.core.config import settings
from app.core.datetime_utils import utc_now_naive

logger = logging.getLogger(__name__)

INVALID_SUBSCRIPTION_MARKERS = (
    "invalid subscription",
    "subscription not found",
    "not a valid subscription",
    "invalid_player_ids",
    "invalid subscription ids",
)


@dataclass
class OneSignalSendResult:
    success: bool
    status_code: int | None = None
    response_body: str | None = None
    error: str | None = None
    invalid_subscription_ids: list[str] = field(default_factory=list)

@dataclass
class OneSignalSubscriptionStatus:
    exists: bool
    active: bool
    status_code: int | None = None
    response_body: str | None = None
    error: str | None = None


_last_push_result: dict[str, Any] | None = None


def get_last_push_result() -> dict[str, Any] | None:
    return _last_push_result


def _set_last_push_result(result: dict[str, Any]) -> None:
    global _last_push_result
    _last_push_result = {
        **result,
        "sent_at": utc_now_naive().isoformat(),
    }


def _extract_invalid_subscription_ids(response_body: str, subscription_ids: list[str]) -> list[str]:
    normalized_body = response_body.lower()
    if not any(marker in normalized_body for marker in INVALID_SUBSCRIPTION_MARKERS):
        return []
    return subscription_ids

def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Key {settings.ONESIGNAL_REST_API_KEY}",
        "Content-Type": "application/json; charset=utf-8",
    }

def _subscription_url(subscription_id: str) -> str:
    return f"https://api.onesignal.com/apps/{settings.ONESIGNAL_APP_ID}/subscriptions/{subscription_id}"

def _is_subscription_active(payload: dict[str, Any]) -> bool:
    if payload.get("enabled") is False:
        return False
    notification_types = payload.get("notification_types")
    if isinstance(notification_types, int) and notification_types < 1:
        return False
    if str(payload.get("status") or "").lower() in {"unsubscribed", "disabled"}:
        return False
    return True

async def get_subscription_status(subscription_id: str) -> OneSignalSubscriptionStatus:
    if not settings.ONESIGNAL_APP_ID or not settings.ONESIGNAL_REST_API_KEY:
        return OneSignalSubscriptionStatus(exists=False, active=False, error="missing_onesignal_config")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(_subscription_url(subscription_id), headers=_headers())
        response_text = response.text[:1000]
        if response.status_code == 404:
            return OneSignalSubscriptionStatus(exists=False, active=False, status_code=404, response_body=response_text)
        response.raise_for_status()
        payload = response.json()
        return OneSignalSubscriptionStatus(
            exists=True,
            active=_is_subscription_active(payload),
            status_code=response.status_code,
            response_body=response_text,
        )
    except httpx.HTTPStatusError as exc:
        return OneSignalSubscriptionStatus(
            exists=False,
            active=False,
            status_code=exc.response.status_code,
            response_body=exc.response.text[:1000],
        )
    except Exception as exc:
        return OneSignalSubscriptionStatus(exists=False, active=False, error=str(exc))


async def send_push_to_subscriptions(
    *,
    subscription_ids: list[str],
    heading: str,
    content: str,
    url: str,
    data: dict[str, Any] | None = None,
    notification_id: int | None = None,
    recipient_id: int | None = None,
) -> OneSignalSendResult:
    if not settings.ONESIGNAL_APP_ID or not settings.ONESIGNAL_REST_API_KEY:
        error = "missing_onesignal_config"
        _set_last_push_result({
            "success": False,
            "error": error,
            "notification_id": notification_id,
            "recipient_id": recipient_id,
            "subscription_ids": subscription_ids,
        })
        logger.info(
            "OneSignal push skipped: missing config app_id=%s api_key=%s.",
            bool(settings.ONESIGNAL_APP_ID),
            bool(settings.ONESIGNAL_REST_API_KEY),
        )
        return OneSignalSendResult(success=False, error=error)

    if not subscription_ids:
        return OneSignalSendResult(success=False, error="no_subscription_ids")

    payload = {
        "app_id": settings.ONESIGNAL_APP_ID,
        "include_subscription_ids": subscription_ids,
        "headings": {"vi": heading, "en": heading},
        "contents": {"vi": content, "en": content},
        "url": url,
        "data": data or {},
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(settings.ONESIGNAL_API_URL, json=payload, headers=_headers())
        response_text = response.text[:1000]
        response.raise_for_status()
        _set_last_push_result({
            "success": True,
            "status_code": response.status_code,
            "response_body": response_text,
            "notification_id": notification_id,
            "recipient_id": recipient_id,
            "subscription_ids": subscription_ids,
        })
        return OneSignalSendResult(
            success=True,
            status_code=response.status_code,
            response_body=response_text,
        )
    except httpx.HTTPStatusError as exc:
        response = exc.response
        response_text = response.text[:1000]
        invalid_subscription_ids = _extract_invalid_subscription_ids(response_text, subscription_ids)
        _set_last_push_result({
            "success": False,
            "status_code": response.status_code,
            "response_body": response_text,
            "invalid_subscription_ids": invalid_subscription_ids,
            "notification_id": notification_id,
            "recipient_id": recipient_id,
            "subscription_ids": subscription_ids,
        })
        return OneSignalSendResult(
            success=False,
            status_code=response.status_code,
            response_body=response_text,
            invalid_subscription_ids=invalid_subscription_ids,
        )
    except Exception as exc:
        error = str(exc)
        _set_last_push_result({
            "success": False,
            "error": error,
            "notification_id": notification_id,
            "recipient_id": recipient_id,
            "subscription_ids": subscription_ids,
        })
        return OneSignalSendResult(success=False, error=error)
