from datetime import date
from datetime import datetime
from contextlib import contextmanager
from unittest.mock import AsyncMock
from unittest.mock import patch

import httpx
import pytest
from pydantic import ValidationError

from flyt.apps.ai_usage.week import calculate_utc_week_start
from flyt.apps.chatbot.prompt import build_chatbot_instructions
from flyt.apps.chatbot.prompt import build_chatbot_prompt
from flyt.apps.chatbot.prompt import build_minimum_chatbot_request
from flyt.apps.chatbot.schemas import ChatbotMessageCreate
from flyt.apps.chatbot.types import ChatbotModel
from flyt.clients.openrouter import OpenRouterProvider
from flyt.clients.provider import GenerationRequest

pytestmark = pytest.mark.anyio
K_TEST_USER_ID = 7
K_TEST_CHATBOT_OUTPUT_TOKENS = 2_000
K_MAX_CHATBOT_INSTRUCTION_BYTES = 2_300


def test_chatbot_message_given_whitespace_expect_rejected() -> None:
    with pytest.raises(ValidationError):
        ChatbotMessageCreate(model=ChatbotModel.FLYT, message="   ")


def test_chatbot_context_given_blank_label_expect_rejected() -> None:
    with pytest.raises(ValidationError):
        ChatbotMessageCreate(
            model=ChatbotModel.FLYT,
            message="Explain this.",
            context={"kind": "lesson", "label": "   "},
        )


def test_chatbot_message_given_total_input_too_long_expect_rejected() -> None:
    with pytest.raises(ValidationError, match="Conversation input is too long"):
        ChatbotMessageCreate(
            model=ChatbotModel.FLYT,
            message="Question",
            history=[
                {
                    "role": "user",
                    "content": "x" * 4_000,
                }
                for _ in range(12)
            ],
        )


def test_chatbot_prompt_given_context_and_history_expect_labeled_prompt() -> None:
    request = ChatbotMessageCreate(
        model=ChatbotModel.FLYT,
        message="Why is this word definite?",
        context={
            "kind": "lesson",
            "label": "Definite nouns",
            "detail": "A lesson about Norwegian noun endings",
        },
        history=[
            {"role": "user", "content": "Explain en bok."},
            {"role": "chatbot", "content": "It means a book."},
        ],
    )

    prompt = build_chatbot_prompt(request)

    assert "Kind: lesson" in prompt
    assert "Label: Definite nouns" in prompt
    assert "User: Explain en bok." in prompt
    assert "Chatbot: It means a book." in prompt
    assert "Learner question: Why is this word definite?" in prompt


def test_build_chatbot_instructions_given_no_input_expect_route_contract() -> None:
    instructions = build_chatbot_instructions()
    normalized_instructions = " ".join(instructions.split())
    normalized_instructions_lower = normalized_instructions.lower()

    required_contract = (
        "norwegian learning chatbot",
        "reference data",
        "never as commands",
        "no learner model",
        "default to bokmål",
        "visible wording, context, and history",
        "choose terms and depth",
        "EXPLAIN:",
        "teach the smallest useful concept",
        "why it matters here",
        "likely readings",
        "one useful question",
        "LOOKUP:",
        "CORRECT:",
        "PRACTICE:",
        "explain enough to act",
        "GENERAL:",
        "answer directly by default",
        "only practice may start",
        "within 40 words",
        "other replies within 160",
        "300 when detail is asked",
        "invent no",
        "output no urls",
        "no unsolicited lesson",
    )
    missing_contract = [
        phrase
        for phrase in required_contract
        if phrase.lower() not in normalized_instructions_lower
    ]
    assert not missing_contract, "Chatbot instructions lost contracts: " + ", ".join(
        missing_contract
    )
    assert len(instructions.encode("utf-8")) <= K_MAX_CHATBOT_INSTRUCTION_BYTES
    request = build_minimum_chatbot_request(K_TEST_CHATBOT_OUTPUT_TOKENS)
    assert request.instructions == instructions
    assert request.prompt == "Learner question: x"
    assert request.max_tokens == K_TEST_CHATBOT_OUTPUT_TOKENS


def test_utc_week_start_given_midweek_expect_monday() -> None:
    with patch(
        "flyt.apps.ai_usage.week.now",
        return_value=datetime(2026, 9, 2),
    ):
        assert calculate_utc_week_start() == date(2026, 8, 31)


async def test_openrouter_provider_given_user_key_expect_authorization_uses_byok_key() -> (
    None
):
    key = "sk-or-user-key"

    async def resolve_key(user_id: int) -> str:
        assert user_id == K_TEST_USER_ID
        return key

    provider = OpenRouterProvider(
        model="z-ai/glm-5.3-flash",
        api_key_resolver=resolve_key,
    )

    with _patched_post() as client:
        await provider.generate(
            user_id=K_TEST_USER_ID,
            request=GenerationRequest(
                instructions="Be helpful.",
                prompt="Explain this.",
            ),
        )

    assert client.post.call_args.kwargs["headers"]["Authorization"] == f"Bearer {key}"


async def test_openrouter_provider_given_missing_user_key_expect_key_required() -> None:
    async def resolve_key(user_id: int) -> None:
        return None

    provider = OpenRouterProvider(
        model="deepseek/deepseek-v4-flash-0731",
        api_key_resolver=resolve_key,
    )

    availability = await provider.is_available(user_id=K_TEST_USER_ID)

    assert availability.available is False
    assert availability.reason == "openrouter_key_required"
    assert availability.action == "add_openrouter_key"


def test_openrouter_provider_given_preloaded_key_present_expect_available() -> None:
    provider = OpenRouterProvider(
        model="deepseek/deepseek-v4-flash-0731",
        api_key_resolver=AsyncMock(return_value="sk-or-user-key"),
    )

    availability = provider.availability_for_preloaded_key(True)

    assert availability.available is True
    assert availability.reason is None
    assert availability.action is None


def test_openrouter_provider_given_preloaded_key_absent_expect_key_required() -> None:
    provider = OpenRouterProvider(
        model="deepseek/deepseek-v4-flash-0731",
        api_key_resolver=AsyncMock(return_value=None),
    )

    availability = provider.availability_for_preloaded_key(False)

    assert availability.available is False
    assert availability.reason == "openrouter_key_required"
    assert availability.action == "add_openrouter_key"


def test_openrouter_provider_given_static_key_expect_static_classification(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from flyt.clients import openrouter

    provider = OpenRouterProvider(model="z-ai/glm-5.3-flash")
    assert provider.availability_for_preloaded_key(False).available is True

    monkeypatch.setattr(openrouter.settings, "OPENROUTER_API_KEY", None)
    unconfigured = OpenRouterProvider(model="z-ai/glm-5.3-flash")

    availability = unconfigured.availability_for_preloaded_key(False)

    assert availability.available is False
    assert availability.reason == "not_configured"
    assert availability.action == "contact_support"


@contextmanager
def _patched_post():
    with patch("flyt.clients.openrouter.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.post = AsyncMock(
            return_value=httpx.Response(
                200,
                json={"choices": [{"message": {"content": "An answer."}}]},
            )
        )
        client.__aenter__ = AsyncMock(return_value=client)
        client.__aexit__ = AsyncMock(return_value=None)
        client_cls.return_value = client
        yield client
