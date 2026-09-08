class LessonContentError(ValueError):
    """Base error for invalid lesson content or content artifacts."""


class LessonImportError(LessonContentError):
    """A lesson import cannot be located, read, or validated."""


class LessonPacketError(LessonContentError):
    """A lesson packet or catalog violates the content contract."""
