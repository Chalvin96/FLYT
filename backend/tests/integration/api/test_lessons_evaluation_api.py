"""Lesson write-judgment API contract tests."""

from http import HTTPStatus
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.content_service import LessonContentService
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderAvailability
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.evaluation.service import EvaluationService
from scripts.import_lessons import load_lesson_import_or_raise
from tests.factories import UserFactory
from tests.helpers.auth import authenticate
from tests.helpers.lesson_import_builder import build_import_dir
from tests.helpers.lesson_packets import exercise_for

pytestmark = pytest.mark.anyio

VALID_VERDICTS = (
    '{"criteria": [{"criterion_id": "c1", "met": true, "evidence": "skriver"}]}'
)
K_RATE_LIMIT_REQUEST_COUNT = 6


class StubJudgeProvider(ModelProvider):
    def __init__(self, text: str | None = None, failure: Exception | None = None):
        self.text = text
        self.failure = failure
        self.calls = 0

    @property
    def name(self) -> str:
        return "stub"

    @property
    def model(self) -> str:
        return "flyt/stub"

    @property
    def limited_by_flyt(self) -> bool:
        return True

    async def is_available(self, user_id: int) -> ProviderAvailability:
        return ProviderAvailability(available=True)

    async def generate(self, user_id: int, request) -> GenerationResult:
        self.calls += 1
        if self.failure is not None:
            raise self.failure
        return GenerationResult(text=self.text)


@pytest.fixture
async def write_lesson(db: AsyncSession, tmp_path: Path) -> Lesson:
    root = build_import_dir(
        tmp_path,
        lesson_ids=["lesson-a"],
        exercises=[exercise_for("write"), exercise_for("choose")],
    )
    loaded = load_lesson_import_or_raise(root)
    service = LessonContentService(db)
    await service.import_lesson_content(loaded, source=str(root))
    await db.flush()
    lesson = await db.scalar(select(Lesson))
    assert lesson is not None
    return lesson


def stub_provider(
    monkeypatch: pytest.MonkeyPatch,
    text: str | None = None,
    failure: Exception | None = None,
) -> StubJudgeProvider:
    provider = StubJudgeProvider(text=text, failure=failure)
    monkeypatch.setattr(
        "flyt.apps.lessons.deps.build_lesson_evaluation_service",
        lambda: EvaluationService(provider),
    )
    return provider


async def test_judge_write_given_valid_response_expect_criterion_verdicts(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": "Jeg skriver en kort tekst nå."},
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body == {
        "criteria": [{"criterion_id": "c1", "met": True, "evidence": "skriver"}]
    }
    assert "judge_prompt" not in response.text
    assert "Judge the paragraph." not in response.text


async def test_judge_write_given_unknown_exercise_expect_404_without_provider_call(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ghost/judge-write",
        json={"response": "Jeg skriver en kort tekst nå."},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert provider.calls == 0


async def test_judge_write_given_non_write_exercise_expect_404(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-choose/judge-write",
        json={"response": "Jeg velger noe nå."},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert provider.calls == 0


async def test_judge_write_given_below_minimum_expect_422(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": "For kort."},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert response.json()["detail"]["code"] == "WRITE_RESPONSE_INVALID"
    assert provider.calls == 0


async def test_judge_write_given_above_maximum_expect_422(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": " ".join(["Jeg"] * 41)},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert response.json()["detail"]["code"] == "WRITE_RESPONSE_INVALID"
    assert provider.calls == 0


async def test_judge_write_given_exact_maximum_expect_criterion_verdicts(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": " ".join(["Jeg"] * 40)},
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {
        "criteria": [{"criterion_id": "c1", "met": True, "evidence": "skriver"}]
    }
    assert provider.calls == 1


async def test_judge_write_given_request_over_500_characters_expect_422_without_provider_call(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": "a" * 501},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert provider.calls == 0


async def test_judge_write_given_rate_window_exhausted_expect_429_without_provider_call(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)
    path = f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write"
    payload = {"response": "Jeg skriver en kort tekst nå."}

    for _ in range(K_RATE_LIMIT_REQUEST_COUNT):
        response = await client.post(path, json=payload)
        assert response.status_code == HTTPStatus.OK

    response = await client.post(path, json=payload)

    assert response.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert response.json()["detail"]["code"] == "WRITE_JUDGE_RATE_LIMITED"
    assert provider.calls == K_RATE_LIMIT_REQUEST_COUNT


async def test_judge_write_given_invalid_attempts_expect_rate_limit(
    client: AsyncClient,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = stub_provider(monkeypatch, text=VALID_VERDICTS)
    user = await UserFactory.create()
    await authenticate(client, user)
    path = f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write"

    for _ in range(6):
        response = await client.post(path, json={"response": "x" * 501})
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    response = await client.post(
        path, json={"response": "Jeg skriver en kort tekst nå."}
    )

    assert response.status_code == HTTPStatus.TOO_MANY_REQUESTS
    assert response.json()["detail"]["code"] == "WRITE_JUDGE_RATE_LIMITED"
    assert provider.calls == 0


async def test_judge_write_given_provider_timeout_expect_503(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_provider(
        monkeypatch,
        failure=ProviderFailure(ProviderFailureClass.TIMEOUT, "timed out"),
    )
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": "Jeg skriver en kort tekst nå."},
    )

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.json()["detail"]["code"] == "WRITE_JUDGE_UNAVAILABLE"
    assert "timed out" not in response.text


async def test_judge_write_given_malformed_provider_output_expect_503(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_provider(monkeypatch, text="Solid work, keep it up!")
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": "Jeg skriver en kort tekst nå."},
    )

    assert response.status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert response.json()["detail"]["code"] == "WRITE_JUDGE_UNAVAILABLE"
    assert "Solid work" not in response.text


async def test_judge_write_given_unauthenticated_expect_401(
    client: AsyncClient,
    db: AsyncSession,
    write_lesson: Lesson,
) -> None:
    response = await client.post(
        f"/lessons/{write_lesson.id}/exercises/ex-write/judge-write",
        json={"response": "Jeg skriver en kort tekst nå."},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED
