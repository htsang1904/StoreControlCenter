import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class OneSignalSendResult:
    success: bool
    message_id: str | None = None
    status_code: int | None = None
    response_body: str | None = None
    error: str | None = None


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Key {settings.ONESIGNAL_REST_API_KEY}",
        "Content-Type": "application/json; charset=utf-8",
    }


async def send_push_to_external_ids(
    *,
    external_ids: list[str],
    heading: str,
    content: str,
    url: str | None = None,
    data: dict[str, Any] | None = None,
) -> OneSignalSendResult:
    recipient_ids = list(dict.fromkeys(str(item).strip() for item in external_ids if str(item).strip()))
    if not recipient_ids:
        return OneSignalSendResult(success=False, error="no_external_ids")

    if not settings.ONESIGNAL_APP_ID or not settings.ONESIGNAL_REST_API_KEY:
        logger.info(
            "OneSignal push skipped: missing backend config app_id=%s api_key=%s.",
            bool(settings.ONESIGNAL_APP_ID),
            bool(settings.ONESIGNAL_REST_API_KEY),
        )
        return OneSignalSendResult(success=False, error="missing_onesignal_config")

    payload: dict[str, Any] = {
        "app_id": settings.ONESIGNAL_APP_ID,
        "include_aliases": {"external_id": recipient_ids},
        "target_channel": "push",
        "headings": {"vi": heading, "en": heading},
        "contents": {"vi": content, "en": content},
        "data": data or {},
    }
    if url:
        payload["url"] = url

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                settings.ONESIGNAL_API_URL,
                json=payload,
                headers=_headers(),
            )
        response_text = response.text[:1000]
        response.raise_for_status()
        response_payload = response.json()
        message_id = str(response_payload.get("id") or "").strip() or None
        if not message_id:
            return OneSignalSendResult(
                success=False,
                status_code=response.status_code,
                response_body=response_text,
                error="no_eligible_push_subscriptions",
            )
        return OneSignalSendResult(
            success=True,
            message_id=message_id,
            status_code=response.status_code,
            response_body=response_text,
        )
    except httpx.HTTPStatusError as exc:
        return OneSignalSendResult(
            success=False,
            status_code=exc.response.status_code,
            response_body=exc.response.text[:1000],
            error="onesignal_http_error",
        )
    except Exception as exc:
        return OneSignalSendResult(success=False, error=str(exc))

async def send_push_to_subscription_ids(
    *,
    subscription_ids: list[str],
    heading: str,
    content: str,
    url: str | None = None,
    data: dict[str, Any] | None = None,
) -> OneSignalSendResult:
    recipient_ids = list(dict.fromkeys(str(item).strip() for item in subscription_ids if str(item).strip()))
    if not recipient_ids:
        return OneSignalSendResult(success=False, error="no_subscription_ids")

    if not settings.ONESIGNAL_APP_ID or not settings.ONESIGNAL_REST_API_KEY:
        return OneSignalSendResult(success=False, error="missing_onesignal_config")

    payload: dict[str, Any] = {
        "app_id": settings.ONESIGNAL_APP_ID,
        "include_subscription_ids": recipient_ids,
        "headings": {"vi": heading, "en": heading},
        "contents": {"vi": content, "en": content},
        "data": data or {},
    }
    if url:
        payload["url"] = url

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(settings.ONESIGNAL_API_URL, json=payload, headers=_headers())
        response_text = response.text[:1000]
        response.raise_for_status()
        response_payload = response.json()
        message_id = str(response_payload.get("id") or "").strip() or None
        return OneSignalSendResult(
            success=bool(message_id),
            message_id=message_id,
            status_code=response.status_code,
            response_body=response_text,
            error=None if message_id else "no_eligible_push_subscriptions",
        )
    except httpx.HTTPStatusError as exc:
        return OneSignalSendResult(
            success=False,
            status_code=exc.response.status_code,
            response_body=exc.response.text[:1000],
            error="onesignal_http_error",
        )
    except Exception as exc:
        return OneSignalSendResult(success=False, error=str(exc))
