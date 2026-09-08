"""Ephemeral Redis slot for generated stories.

One slot per learner. The slot stores the generation id minted at request time,
request parameters, and — once the job completes — the normalized text plus
PageData. A completing job writes its result only if the slot still holds its
own generation id; otherwise the result is discarded (the generation-id fence).
"""

import json
from dataclasses import dataclass

import redis.asyncio as aioredis

from flyt.apps.reading.tokenization import PageData
from flyt.core.config import settings
from flyt.core.redis import as_awaitable
from flyt.core.redis import get_redis

_NAMESPACE = "story_generation"

_MINT_SCRIPT = """
redis.call('HSET', KEYS[1],
    'generation_id', ARGV[1],
    'status', 'processing',
    'provider', ARGV[2],
    'anchor', ARGV[3],
    'length', ARGV[4],
    'topic', ARGV[5]
)
redis.call('HDEL', KEYS[1], 'text', 'pages', 'failure_code', 'failure_message', 'worker_claim')
redis.call('EXPIRE', KEYS[1], ARGV[6])
"""

_CLAIM_SCRIPT = """
local current = redis.call('HGET', KEYS[1], 'generation_id')
local status = redis.call('HGET', KEYS[1], 'status')
if current ~= ARGV[1] or status ~= 'processing' then
    return 0
end
if redis.call('HEXISTS', KEYS[1], 'worker_claim') == 1 then
    return 0
end
redis.call('HSET', KEYS[1], 'worker_claim', '1')
return 1
"""

_HAS_CURRENT_CLAIM_SCRIPT = """
local current = redis.call('HGET', KEYS[1], 'generation_id')
local status = redis.call('HGET', KEYS[1], 'status')
if current ~= ARGV[1] or status ~= 'processing' then
    return 0
end
return redis.call('HEXISTS', KEYS[1], 'worker_claim')
"""

_WRITE_READY_SCRIPT = """
local current = redis.call('HGET', KEYS[1], 'generation_id')
if current ~= ARGV[1] then
    return 0
end
redis.call('HSET', KEYS[1],
    'status', 'ready',
    'text', ARGV[2],
    'pages', ARGV[3]
)
redis.call('HDEL', KEYS[1], 'worker_claim')
return 1
"""

_WRITE_FAILED_SCRIPT = """
local current = redis.call('HGET', KEYS[1], 'generation_id')
if current ~= ARGV[1] then
    return 0
end
redis.call('HSET', KEYS[1],
    'status', 'failed',
    'failure_code', ARGV[2],
    'failure_message', ARGV[3]
)
redis.call('HDEL', KEYS[1], 'worker_claim')
return 1
"""

_WRITE_REFUSED_SCRIPT = """
local current = redis.call('HGET', KEYS[1], 'generation_id')
if current ~= ARGV[1] then
    return 0
end
redis.call('HSET', KEYS[1],
    'status', 'refused',
    'failure_code', ARGV[2],
    'failure_message', ARGV[3]
)
redis.call('HDEL', KEYS[1], 'worker_claim')
return 1
"""


@dataclass
class SlotRequest:
    provider: str
    anchor: str | None
    length: int
    topic: str | None


@dataclass
class SlotData:
    generation_id: int
    status: str
    provider: str
    anchor: str | None
    length: int
    topic: str | None
    text: str | None = None
    pages: list[PageData] | None = None
    failure_code: str | None = None
    failure_message: str | None = None


def _slot_key(user_id: int) -> str:
    return f"{_NAMESPACE}:slot:{user_id}"


def _ttl_seconds() -> int:
    return settings.STORY_GENERATION_EPHEMERAL_TTL_HOURS * 3600


def _serialize_pages(pages: list[PageData] | None) -> str:
    if pages is None:
        return "null"
    return json.dumps(
        [
            {
                "index": p.index,
                "content": p.content,
                "tokens": p.tokens,
                "word_count": p.word_count,
            }
            for p in pages
        ]
    )


def _deserialize_pages(raw: str | None) -> list[PageData] | None:
    if raw is None:
        return None
    data = json.loads(raw)
    if data is None:
        return None
    return [
        PageData(
            index=item["index"],
            content=item["content"],
            tokens=item["tokens"],
            word_count=item["word_count"],
        )
        for item in data
    ]


class GenerationSlotStore:
    def __init__(self, redis: aioredis.Redis | None = None) -> None:
        self._redis = redis or get_redis()

    async def mint(
        self,
        user_id: int,
        generation_id: int,
        request: SlotRequest,
    ) -> None:
        key = _slot_key(user_id)
        await as_awaitable(
            self._redis.eval(
                _MINT_SCRIPT,
                1,
                key,
                str(generation_id),
                request.provider,
                request.anchor or "",
                str(request.length),
                request.topic or "",
                str(_ttl_seconds()),
            )
        )

    async def claim_worker_slot(self, user_id: int, generation_id: int) -> int:
        claimed = await as_awaitable(
            self._redis.eval(
                _CLAIM_SCRIPT,
                1,
                _slot_key(user_id),
                str(generation_id),
            )
        )
        return int(claimed)

    async def has_current_worker_slot_claim(
        self, user_id: int, generation_id: int
    ) -> bool:
        claimed = await as_awaitable(
            self._redis.eval(
                _HAS_CURRENT_CLAIM_SCRIPT,
                1,
                _slot_key(user_id),
                str(generation_id),
            )
        )
        return bool(claimed)

    async def write_ready(
        self,
        user_id: int,
        generation_id: int,
        text: str,
        pages: list[PageData] | None,
    ) -> bool:
        written = await as_awaitable(
            self._redis.eval(
                _WRITE_READY_SCRIPT,
                1,
                _slot_key(user_id),
                str(generation_id),
                text,
                _serialize_pages(pages),
            )
        )
        return bool(written)

    async def write_failed(
        self,
        user_id: int,
        generation_id: int,
        failure_code: str,
        failure_message: str,
    ) -> bool:
        written = await as_awaitable(
            self._redis.eval(
                _WRITE_FAILED_SCRIPT,
                1,
                _slot_key(user_id),
                str(generation_id),
                failure_code,
                failure_message,
            )
        )
        return bool(written)

    async def write_refused(
        self,
        user_id: int,
        generation_id: int,
        failure_code: str,
        failure_message: str,
    ) -> bool:
        written = await as_awaitable(
            self._redis.eval(
                _WRITE_REFUSED_SCRIPT,
                1,
                _slot_key(user_id),
                str(generation_id),
                failure_code,
                failure_message,
            )
        )
        return bool(written)

    async def read(self, user_id: int) -> SlotData | None:
        raw_bytes = await as_awaitable(self._redis.hgetall(_slot_key(user_id)))
        if not raw_bytes:
            return None

        raw: dict[str, str | None] = {}
        for k, v in raw_bytes.items():
            key = k.decode("utf-8") if isinstance(k, bytes) else k
            val = v.decode("utf-8") if isinstance(v, bytes) else v
            raw[key] = val

        def _get(key: str) -> str | None:
            return raw.get(key)

        gen_id = _get("generation_id")
        if gen_id is None:
            return None

        return SlotData(
            generation_id=int(gen_id),
            status=_get("status") or "processing",
            provider=_get("provider") or "",
            anchor=_get("anchor") or None,
            length=int(_get("length") or 0),
            topic=_get("topic") or None,
            text=_get("text"),
            pages=_deserialize_pages(_get("pages")),
            failure_code=_get("failure_code"),
            failure_message=_get("failure_message"),
        )
