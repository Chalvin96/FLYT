import re

from pydantic import BaseModel
from pydantic import Field

from flyt.apps.reading.constants import TITLE_MAX_LENGTH
from flyt.apps.reading.import_text import normalize_text
from flyt.apps.story_generation.prompt import strip_markup


class GeneratedStoryOutput(BaseModel):
    text: str = Field(min_length=1)
    title: str | None = None


def parse_generation_output(raw: str) -> GeneratedStoryOutput:
    candidate = raw.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```[^\r\n]*[\r\n]+", "", candidate, count=1)
        candidate = candidate.removesuffix("```").strip()
    object_start = candidate.find("{")
    if object_start >= 0:
        object_end = candidate.rfind("}")
        candidate = (
            candidate[object_start : object_end + 1]
            if object_end >= object_start
            else candidate[object_start:]
        )
    if candidate.startswith("{"):
        output = GeneratedStoryOutput.model_validate_json(candidate, strict=True)
    else:
        output = GeneratedStoryOutput(text=candidate)
    text = normalize_text(strip_markup(output.text))
    if not text:
        raise ValueError("Generated story text is empty after normalization")
    title = " ".join(strip_markup(output.title or "").split())[:TITLE_MAX_LENGTH]
    return GeneratedStoryOutput(text=text, title=title or None)
