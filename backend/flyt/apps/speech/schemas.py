from pydantic import BaseModel


class SpeechSegmentResponse(BaseModel):
    start: float
    end: float
    text: str


class SpeechTranscriptionResponse(BaseModel):
    text: str
    language: str
    language_probability: float
    duration_seconds: float
    segments: list[SpeechSegmentResponse]
