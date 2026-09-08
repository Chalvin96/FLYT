import hashlib
import re
import unicodedata
from urllib.parse import urlparse

from flyt.apps.reading.constants import SOURCE_URL_MAX_LENGTH

_ALLOWED_SCHEMES = {"http", "https"}
_BLANK_RUN = re.compile(r"\n{3,}")


class InvalidSourceUrl(ValueError):
    """Raised when a source URL fails validation."""


def normalize_text(raw: str) -> str:
    """Apply the pinned normalization contract used for size, hash, and storage."""
    text = unicodedata.normalize("NFC", raw)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    text = _BLANK_RUN.sub("\n\n", text)
    return text.strip()


def content_hash(normalized: str) -> str:
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def normalized_byte_length(normalized: str) -> int:
    return len(normalized.encode("utf-8"))


def word_count(normalized: str) -> int:
    return len(normalized.split())


def validate_source_url(value: str) -> str:
    """Validate stored provenance without fetching the URL server-side."""
    if len(value) > SOURCE_URL_MAX_LENGTH:
        raise InvalidSourceUrl(f"source_url exceeds {SOURCE_URL_MAX_LENGTH} characters")
    try:
        parsed = urlparse(value)
    except ValueError as exc:
        raise InvalidSourceUrl("source_url is not a valid URL") from exc

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise InvalidSourceUrl("source_url must be http or https")
    if not parsed.hostname:
        raise InvalidSourceUrl("source_url must have a hostname")
    if parsed.username or parsed.password:
        raise InvalidSourceUrl("source_url must not embed credentials")
    return value
