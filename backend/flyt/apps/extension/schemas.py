from pydantic import BaseModel
from pydantic import Field
from pydantic import field_validator

K_TRANSLATION_SOURCE_MIN_CHARACTERS = 2
K_TRANSLATION_SOURCE_MAX_CHARACTERS = 2000
K_TRANSLATION_RESULT_MAX_CHARACTERS = 4000


class TranslationCreate(BaseModel):
    text: str = Field(
        min_length=K_TRANSLATION_SOURCE_MIN_CHARACTERS,
        max_length=K_TRANSLATION_SOURCE_MAX_CHARACTERS,
    )

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        text = value.strip()
        if len(text) < K_TRANSLATION_SOURCE_MIN_CHARACTERS:
            raise ValueError("Text must contain at least two characters")
        return text


class TranslationRead(BaseModel):
    source_text: str
    translated_text: str
    source_language: str = "no"
    target_language: str = "en"
