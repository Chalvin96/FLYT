from datetime import datetime
from uuid import UUID

from pydantic import BaseModel
from pydantic import EmailStr
from pydantic import Field
from pydantic import field_validator


class UserRead(BaseModel):
    id: int
    uuid: UUID
    email: EmailStr
    display_name: str
    avatar_url: str | None = None
    last_login: datetime | None = None

    model_config = {"from_attributes": True}


class DeletionPreviewRead(BaseModel):
    streak: int
    reviews: int
    wordsPracticed: int
    importedTexts: int


class UserUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)

    @field_validator("display_name")
    @classmethod
    def strip_display_name(cls, value: str) -> str:
        display_name = value.strip()
        if not display_name:
            raise ValueError("Display name cannot be empty")
        return display_name
