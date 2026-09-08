import asyncio
from http import HTTPStatus
from unittest.mock import AsyncMock
from unittest.mock import patch
from uuid import uuid4

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.models import FlytAiUsage
from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.ai_usage.types import AiUsageRequest
from flyt.apps.ai_usage.week import calculate_utc_week_start
from flyt.apps.chatbot.constants import K_CHATBOT_OUTPUT_MAX_CHARACTERS
from flyt.apps.chatbot.exceptions import ChatbotProviderError
from flyt.apps.chatbot.exceptions import ChatbotQuotaExceededError
from flyt.apps.chatbot.schemas import ChatbotMessageCreate
from flyt.apps.chatbot.schemas import ChatbotMessageRead
from flyt.apps.chatbot.services import ChatbotService
from flyt.apps.chatbot.services import UserOpenRouterKeyService
from flyt.apps.chatbot.types import ChatbotModel
from flyt.apps.users.models import User
from flyt.apps.users.types import UserRole
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.core.config import settings
from flyt.core.db import AsyncSessionLocal
from tests.factories import UserFactory
from tests.helpers.auth import authenticate
from tests.helpers.sql_log import capture_sql
from tests.helpers.sql_log import statements_reading

pytestmark = pytest.mark.anyio

K_EXPECTED_REMAINING_PERCENT = 76
K_FULL_REMAINING_PERCENT = 100
K_TEST_SNAPSHOT_BUDGET = 100_000
K_EXPECTED_SURFACE_CREDENTIAL_READS = 1
K_EXPECTED_SURFACE_USAGE_READS = 1


async def send_message_as_route(
    db: AsyncSession, user_id: int, request: ChatbotMessageCreate
) -> ChatbotMessageRead:
    """Mirror the route composition: prepare, commit, dispatch."""
    service = ChatbotService(db)
    dispatch = await service.prepare_message(user_id, request)
    await db.commit()
    return await service.dispatch_message(dispatch)


async def get_flyt_usage_row(db: AsyncSession, user_id: int) -> FlytAiUsage | None:
    return await db.scalar(select(FlytAiUsage).where(FlytAiUsage.user_id == user_id))


async def test_get_chatbot_surface_given_authenticated_user_expect_all_models_and_remaining_percent(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get("/chatbot")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert [model["id"] for model in body["models"]] == [
        "flyt",
        "chatgpt",
        "deepseek",
        "glm",
    ]
    assert body["openrouterKeyConfigured"] is False
    assert "flytMessagesRemaining" not in body
    assert "flytMessagesLimit" not in body
    assert "openrouterKeySuffix" not in body

    availability = {model["id"]: model for model in body["models"]}
    assert availability["flyt"]["available"] is True
    assert availability["flyt"]["remainingPercent"] == K_FULL_REMAINING_PERCENT
    assert "remainingPercent" not in availability["chatgpt"]
    assert "remainingPercent" not in availability["deepseek"]
    assert "remainingPercent" not in availability["glm"]
    assert availability["chatgpt"]["action"] == "link_account"
    assert availability["deepseek"]["reason"] == "openrouter_key_required"
    assert availability["glm"]["reason"] == "openrouter_key_required"


async def test_get_chatbot_surface_given_configured_catalog_expect_single_snapshot_reads(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    """The surface serves from one request-local snapshot: exactly one
    learner-credential read and one weekly-usage read, with response
    correctness unchanged."""
    user = await UserFactory.create()
    await authenticate(client, user)

    with capture_sql(db) as executed:
        response = await client.get("/chatbot")

    assert response.status_code == HTTPStatus.OK
    credential_reads = statements_reading(executed, "chatbot_openrouter_credentials")
    usage_reads = statements_reading(executed, "flyt_ai_usage")
    assert len(credential_reads) == K_EXPECTED_SURFACE_CREDENTIAL_READS
    assert len(usage_reads) == K_EXPECTED_SURFACE_USAGE_READS

    body = response.json()
    assert body["openrouterKeyConfigured"] is False
    availability = {model["id"]: model for model in body["models"]}
    assert availability["flyt"]["available"] is True
    assert availability["flyt"]["remainingPercent"] == K_FULL_REMAINING_PERCENT
    assert availability["chatgpt"]["available"] is False
    assert availability["chatgpt"]["action"] == "link_account"
    assert availability["deepseek"]["reason"] == "openrouter_key_required"
    assert availability["glm"]["reason"] == "openrouter_key_required"
    assert "remainingPercent" not in availability["deepseek"]
    assert "remainingPercent" not in availability["glm"]


async def test_get_chatbot_surface_given_partial_budget_use_expect_remaining_percentage(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    db.add(
        FlytAiUsage(
            user_id=user.id,
            period_start=calculate_utc_week_start(),
            remaining_tokens=K_TEST_SNAPSHOT_BUDGET - 23_001,
            budget_tokens=K_TEST_SNAPSHOT_BUDGET,
        )
    )
    await db.flush()

    response = await client.get("/chatbot")

    assert response.status_code == HTTPStatus.OK
    flyt = next(model for model in response.json()["models"] if model["id"] == "flyt")
    assert flyt["remainingPercent"] == K_EXPECTED_REMAINING_PERCENT


async def test_get_chatbot_surface_given_exhausted_flyt_budget_expect_flyt_unavailable(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    db.add(
        FlytAiUsage(
            user_id=user.id,
            period_start=calculate_utc_week_start(),
            remaining_tokens=0,
            budget_tokens=K_TEST_SNAPSHOT_BUDGET,
        )
    )
    await db.flush()

    response = await client.get("/chatbot")

    assert response.status_code == HTTPStatus.OK
    flyt = next(model for model in response.json()["models"] if model["id"] == "flyt")
    assert flyt["available"] is False
    assert flyt["reason"] == "unavailable"
    assert flyt["action"] is None
    assert "remainingPercent" not in flyt
    assert '"remaining":' not in response.text
    assert "limit" not in response.text


async def test_get_chatbot_surface_given_insufficient_flyt_budget_expect_flyt_unavailable(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    db.add(
        FlytAiUsage(
            user_id=user.id,
            period_start=calculate_utc_week_start(),
            remaining_tokens=1,
            budget_tokens=K_TEST_SNAPSHOT_BUDGET,
        )
    )
    await db.flush()

    response = await client.get("/chatbot")

    assert response.status_code == HTTPStatus.OK
    flyt = next(model for model in response.json()["models"] if model["id"] == "flyt")
    assert flyt["available"] is False
    assert flyt["reason"] == "unavailable"
    assert flyt["action"] is None
    assert "remainingPercent" not in flyt


async def test_get_chatbot_surface_given_no_authentication_expect_unauthorized(
    client: AsyncClient,
) -> None:
    response = await client.get("/chatbot")

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_openrouter_key_given_authenticated_user_expect_encrypted_replace_and_delete(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    plaintext = "sk-or-user-secret-1234"

    replace_response = await client.put(
        "/chatbot/openrouter-key",
        json={"apiKey": plaintext},
    )

    assert replace_response.status_code == HTTPStatus.OK
    assert replace_response.json() == {"openrouterKeyConfigured": True}
    stored = await db.scalar(
        text(
            "SELECT api_key FROM chatbot_openrouter_credentials WHERE user_id = :user_id"
        ).bindparams(user_id=user.id)
    )
    assert isinstance(stored, str)
    assert plaintext not in stored
    assert stored.startswith("gAAAA")

    surface = await client.get("/chatbot")
    availability = {model["id"]: model for model in surface.json()["models"]}
    assert "openrouterKeySuffix" not in surface.json()
    assert availability["deepseek"]["available"] is True
    assert availability["glm"]["available"] is True

    delete_response = await client.delete("/chatbot/openrouter-key")

    assert delete_response.status_code == HTTPStatus.NO_CONTENT
    assert (
        await db.scalar(
            text(
                "SELECT api_key FROM chatbot_openrouter_credentials WHERE user_id = :user_id"
            ).bindparams(user_id=user.id)
        )
        is None
    )


async def test_openrouter_key_given_invalid_length_expect_safe_error(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    invalid_key = "sk-or-" + "x" * 600

    response = await client.put(
        "/chatbot/openrouter-key",
        json={"apiKey": invalid_key},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert response.json() == {
        "detail": {
            "code": "CHATBOT_INVALID_OPENROUTER_KEY",
            "message": "OpenRouter key is invalid.",
            "error": None,
        }
    }
    assert invalid_key not in response.text


async def test_send_chatbot_message_given_flyt_expect_answer_and_debited_usage(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    result = build_generation_result(
        "En bok is an indefinite noun phrase.", prompt_tokens=120, completion_tokens=80
    )

    with patch(
        "flyt.apps.chatbot.services.OpenRouterProvider.generate",
        new=AsyncMock(return_value=result),
    ) as generate:
        response = await client.post(
            "/chatbot/messages",
            json={
                "model": "flyt",
                "message": "Why is it en bok?",
                "context": {
                    "kind": "lesson",
                    "label": "Noun gender",
                },
                "history": [
                    {"role": "user", "content": "What does bok mean?"},
                    {"role": "chatbot", "content": "It means book."},
                ],
            },
        )

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {
        "model": "flyt",
        "content": result.text,
    }
    request = generate.await_args.args[1]
    assert "Label: Noun gender" in request.prompt
    assert "Learner question: Why is it en bok?" in request.prompt
    probe_user = await UserFactory.create()
    probe_service = AiUsageService(db)
    await probe_service.admit_request(
        probe_user.id,
        AiUsageRequest(
            instructions=request.instructions,
            prompt=request.prompt,
            max_tokens=request.max_tokens,
        ),
    )
    probe_status = await probe_service.load_week_usage(probe_user.id)
    expected_debit = probe_status.budget_tokens - probe_status.remaining_tokens
    usage = await get_flyt_usage_row(db, user.id)
    assert usage is not None
    assert usage.budget_tokens - usage.remaining_tokens == expected_debit
    assert usage.remaining_tokens < settings.FLYT_AI_WEEKLY_TOKEN_BUDGET
    assert usage.budget_tokens == settings.FLYT_AI_WEEKLY_TOKEN_BUDGET


async def test_send_chatbot_message_given_missing_usage_expect_conservative_charge(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)
    result = build_generation_result("An answer without reported usage.")

    with patch(
        "flyt.apps.chatbot.services.OpenRouterProvider.generate",
        new=AsyncMock(return_value=result),
    ):
        response = await client.post(
            "/chatbot/messages",
            json={"model": "flyt", "message": "Explain this."},
        )

    assert response.status_code == HTTPStatus.OK
    usage = await get_flyt_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < settings.FLYT_AI_WEEKLY_TOKEN_BUDGET


async def test_send_chatbot_message_given_oversized_answer_expect_safe_error(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    with patch(
        "flyt.apps.chatbot.services.OpenRouterProvider.generate",
        new=AsyncMock(
            return_value=build_generation_result(
                "x" * (K_CHATBOT_OUTPUT_MAX_CHARACTERS + 1),
                prompt_tokens=100,
                completion_tokens=100,
            )
        ),
    ):
        response = await client.post(
            "/chatbot/messages",
            json={"model": "flyt", "message": "Explain this."},
        )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json()["detail"]["code"] == "CHATBOT_PROVIDER_REQUEST_REJECTED"
    assert "x" * 100 not in response.text
    usage = await get_flyt_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < settings.FLYT_AI_WEEKLY_TOKEN_BUDGET


async def test_send_chatbot_message_given_flyt_expect_low_reasoning(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    response_body = {"choices": [{"message": {"content": "Answer."}}]}
    openrouter_client = AsyncMock()
    openrouter_client.post = AsyncMock(
        return_value=httpx.Response(HTTPStatus.OK, json=response_body)
    )
    openrouter_client.__aenter__ = AsyncMock(return_value=openrouter_client)
    openrouter_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "flyt.clients.openrouter.httpx.AsyncClient",
        return_value=openrouter_client,
    ):
        response = await send_message_as_route(
            db,
            user.id,
            ChatbotMessageCreate(
                model=ChatbotModel.FLYT,
                message="What is the V2 rule?",
            ),
        )

    assert response.content == "Answer."
    payload = openrouter_client.post.await_args.kwargs["json"]
    assert payload["reasoning"] == {"effort": "low"}


async def test_send_chatbot_message_given_flyt_upstream_failure_expect_tokens_debited(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    request = ChatbotMessageCreate(model=ChatbotModel.FLYT, message="Help me.")
    with patch(
        "flyt.apps.chatbot.services.OpenRouterProvider.generate",
        new=AsyncMock(
            side_effect=ProviderFailure(ProviderFailureClass.TRANSIENT, "failed")
        ),
    ):
        with pytest.raises(ChatbotProviderError):
            await send_message_as_route(db, user.id, request)

    usage = await get_flyt_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_send_chatbot_message_given_cancellation_expect_tokens_debited(
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    started = asyncio.Event()
    blocked = asyncio.Event()
    request = ChatbotMessageCreate(model=ChatbotModel.FLYT, message="Help me.")

    async def block_provider(*args, **kwargs):
        started.set()
        await blocked.wait()

    service = ChatbotService(db)
    with patch(
        "flyt.apps.chatbot.services.OpenRouterProvider.generate",
        new=block_provider,
    ):
        dispatch = await service.prepare_message(user.id, request)
        await db.commit()
        task = asyncio.create_task(service.dispatch_message(dispatch))
        await started.wait()
        task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await task

    usage = await get_flyt_usage_row(db, user.id)
    assert usage is not None
    assert usage.remaining_tokens < usage.budget_tokens


async def test_send_chatbot_message_given_exhausted_budget_expect_provider_not_called(
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = await UserFactory.create()
    monkeypatch.setattr(settings, "FLYT_AI_WEEKLY_TOKEN_BUDGET", 10)
    request = ChatbotMessageCreate(model=ChatbotModel.FLYT, message="Help me.")
    generate = AsyncMock()

    with patch("flyt.apps.chatbot.services.OpenRouterProvider.generate", new=generate):
        with pytest.raises(ChatbotQuotaExceededError):
            service = ChatbotService(db)
            await service.prepare_message(user.id, request)

    generate.assert_not_awaited()
    usage = await get_flyt_usage_row(db, user.id)
    assert usage is None


async def test_send_chatbot_message_given_direct_model_and_user_key_expect_no_flyt_usage(
    db: AsyncSession,
) -> None:
    from pydantic import SecretStr

    user = await UserFactory.create()
    await UserOpenRouterKeyService(db).replace_api_key(
        user.id,
        SecretStr("sk-or-user-secret-5678"),
    )
    request = ChatbotMessageCreate(model=ChatbotModel.GLM, message="Help me.")
    with patch(
        "flyt.apps.chatbot.services.OpenRouterProvider.generate",
        new=AsyncMock(return_value=build_generation_result("Answer.")),
    ):
        response = await send_message_as_route(db, user.id, request)

    assert response.model is ChatbotModel.GLM
    usage = await get_flyt_usage_row(db, user.id)
    assert usage is None


async def test_send_chatbot_message_given_chatgpt_expect_no_flyt_usage(
    db: AsyncSession,
) -> None:
    from flyt.apps.chatgpt_link.models import ChatGPTLinkState
    from tests.factories import ChatGPTLinkFactory

    user = await UserFactory.create()
    await ChatGPTLinkFactory.create_async(
        user_id=user.id, state=ChatGPTLinkState.WORKING
    )
    await db.flush()
    request = ChatbotMessageCreate(model=ChatbotModel.CHATGPT, message="Help me.")

    with patch(
        "flyt.apps.chatbot.services.ChatGPTProvider.generate",
        new=AsyncMock(return_value=build_generation_result("Answer.")),
    ):
        await send_message_as_route(db, user.id, request)

    usage = await get_flyt_usage_row(db, user.id)
    assert usage is None


async def test_send_chatbot_message_given_invalid_body_expect_no_usage_record(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        "/chatbot/messages",
        json={"model": "flyt", "message": "   "},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert await get_flyt_usage_row(db, user.id) is None


async def test_send_chatbot_message_given_funded_admission_expect_debit_committed_and_no_open_transaction_during_dispatch(
    client: AsyncClient,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R-003: the funded debit is durable before the provider call, and
    funded dispatch holds no open transaction. Linked ChatGPT and
    learner-key OpenRouter inference still re-open a transaction for their
    post-commit credential reads."""
    user = await UserFactory.create()
    await authenticate(client, user)

    original_commit = db.commit
    commits_at_dispatch: list[int] = []

    async def counting_commit() -> None:
        await original_commit()
        commits_at_dispatch.append(0)

    monkeypatch.setattr(db, "commit", counting_commit)

    observed: dict[str, object] = {}

    async def probe_generate(
        _self: object, user_id: int, request: GenerationRequest
    ) -> GenerationResult:
        observed["in_transaction"] = db.in_transaction()
        observed["commits"] = len(commits_at_dispatch)
        observed["usage"] = await get_flyt_usage_row(db, user_id)
        return build_generation_result("Answer.")

    with patch(
        "flyt.apps.chatbot.services.OpenRouterProvider.generate",
        new=probe_generate,
    ):
        response = await client.post(
            "/chatbot/messages",
            json={"model": "flyt", "message": "Explain this."},
        )

    assert response.status_code == HTTPStatus.OK
    assert observed["in_transaction"] is False
    assert observed["commits"] >= 1
    usage = observed["usage"]
    assert isinstance(usage, FlytAiUsage)
    assert usage.remaining_tokens < usage.budget_tokens


async def test_prepare_message_given_caller_ends_without_commit_expect_debit_not_durable(
    setup_database: None,
) -> None:
    """R-004: a flushed admission is durable only once its caller commits."""
    async with AsyncSessionLocal() as session:
        user = User(
            uuid=uuid4(),
            email="chatbot-flush-only@example.com",
            display_name="Chatbot Flush Only",
            avatar_url=None,
            role=UserRole.USER,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    try:
        async with AsyncSessionLocal() as caller:
            dispatch = await ChatbotService(caller).prepare_message(
                user_id,
                ChatbotMessageCreate(model=ChatbotModel.FLYT, message="Hei."),
            )
            assert dispatch.entry.definition.funded_by_flyt is True

            async with AsyncSessionLocal() as verify:
                assert await get_flyt_usage_row(verify, user_id) is None

            await caller.commit()

        async with AsyncSessionLocal() as verify:
            usage = await get_flyt_usage_row(verify, user_id)
        assert usage is not None
        assert usage.remaining_tokens < usage.budget_tokens
    finally:
        async with AsyncSessionLocal() as cleanup:
            await cleanup.execute(delete(User).where(User.id == user_id))
            await cleanup.commit()


def build_generation_result(
    text: str,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> GenerationResult:
    return GenerationResult(
        text=text,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )
