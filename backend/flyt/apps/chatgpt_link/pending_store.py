from datetime import datetime
from urllib.parse import parse_qsl
from urllib.parse import urlencode
from urllib.parse import urlsplit
from urllib.parse import urlunsplit

from aiocache import Cache
from aiocache.base import BaseCache

from flyt.apps.chatgpt_link.types import PendingAuthorization
from flyt.core.config import settings
from flyt.libs.utils.date import now

NAMESPACE = "chatgpt_link_pending"


def _pending_cache() -> BaseCache:
    parts = urlsplit(settings.REDIS_URL)
    query = urlencode([*parse_qsl(parts.query), ("namespace", NAMESPACE)])
    return Cache.from_url(urlunsplit(parts._replace(query=query)))


async def write(user_id: int, pending: PendingAuthorization) -> None:
    await _pending_cache().set(
        str(user_id),
        {
            "device_auth_id": pending.device_auth_id,
            "user_code": pending.user_code,
            "expires_at": pending.expires_at.isoformat(),
            "model_key": pending.model_key,
        },
        ttl=max(int((pending.expires_at - now()).total_seconds()), 1),
    )


async def read(user_id: int) -> PendingAuthorization | None:
    data = await _pending_cache().get(str(user_id))
    if data is None:
        return None
    return PendingAuthorization(
        device_auth_id=data["device_auth_id"],
        user_code=data["user_code"],
        expires_at=datetime.fromisoformat(data["expires_at"]),
        model_key=data.get("model_key"),
    )


async def clear(user_id: int) -> None:
    await _pending_cache().delete(str(user_id))
