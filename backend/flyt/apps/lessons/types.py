from dataclasses import dataclass

from flyt.content.schemas import K_LESSON_LANGUAGE
from flyt.content.schemas import K_LESSON_TRANSLATION_LANGUAGE
from flyt.content.schemas import LessonCatalog
from flyt.content.schemas import LessonCatalogEntry
from flyt.content.schemas import LessonPacket


@dataclass(slots=True)
class LessonImportItem:
    entry: LessonCatalogEntry
    packet: LessonPacket


@dataclass(slots=True)
class LessonImportBatch:
    catalog: LessonCatalog
    digest: str
    lessons: list[LessonImportItem]
    language: str = K_LESSON_LANGUAGE
    translation_language: str = K_LESSON_TRANSLATION_LANGUAGE

    @property
    def lesson_count(self) -> int:
        return len(self.lessons)
