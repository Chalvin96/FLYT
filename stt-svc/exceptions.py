from __future__ import annotations


class SttError(Exception):
    """Base class for expected speech-service failures."""


class AudioDecodeError(SttError):
    """The uploaded bytes are not decodable audio."""


class AudioTooLongError(SttError):
    """Decoded audio exceeds the configured request duration."""


class ModelNotReadyError(SttError):
    """The recognizer cannot serve inference yet."""
