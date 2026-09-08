from pydantic import BaseModel


class HealthRead(BaseModel):
    status: str


class ReadinessRead(BaseModel):
    status: str
    checks: dict[str, str]
