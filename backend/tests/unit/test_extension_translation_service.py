from unittest.mock import AsyncMock
import pytest

from flyt.apps.ai_usage.types import AiUsageAdmission
from flyt.apps.extension.exceptions import ExtensionTranslationProviderError
from flyt.apps.extension.exceptions import ExtensionTranslationQuotaExceededError
from flyt.apps.extension.schemas import TranslationCreate
from flyt.apps.extension.services import ExtensionTranslationService
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ProviderAvailability
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass

pytestmark = pytest.mark.anyio

K_TEST_USER_ID = 7


async def test_prepare_translation_given_available_provider_expect_admitted_dispatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = AsyncMock()
    admission = AsyncMock(return_value=AiUsageAdmission(True, None))
    available = AsyncMock(return_value=ProviderAvailability(available=True))
    monkeypatch.setattr(
        "flyt.apps.extension.services.AiUsageService.admit_request", admission
    )
    monkeypatch.setattr(
        "flyt.apps.extension.services.OpenRouterProvider.is_available", available
    )

    dispatch = await ExtensionTranslationService(db).prepare_translation(
        K_TEST_USER_ID, TranslationCreate(text="  Jeg lærer norsk.  ")
    )

    assert dispatch.user_id == K_TEST_USER_ID
    assert dispatch.source_text == "Jeg lærer norsk."
    assert dispatch.request.prompt == "Jeg lærer norsk."
    assert (
        "If the supplied text is already English or does not require translation, "
        "reproduce it exactly without rewriting it." in dispatch.request.instructions
    )
    admission.assert_awaited_once()
    available.assert_awaited_once_with(K_TEST_USER_ID)


async def test_prepare_translation_given_exhausted_budget_expect_quota_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = AsyncMock()
    monkeypatch.setattr(
        "flyt.apps.extension.services.OpenRouterProvider.is_available",
        AsyncMock(return_value=ProviderAvailability(available=True)),
    )
    monkeypatch.setattr(
        "flyt.apps.extension.services.AiUsageService.admit_request",
        AsyncMock(return_value=AiUsageAdmission(False, None)),
    )

    with pytest.raises(ExtensionTranslationQuotaExceededError):
        await ExtensionTranslationService(db).prepare_translation(
            K_TEST_USER_ID, TranslationCreate(text="Jeg lærer norsk.")
        )


async def test_dispatch_translation_given_provider_result_expect_trimmed_translation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = AsyncMock()
    monkeypatch.setattr(
        "flyt.apps.extension.services.OpenRouterProvider.is_available",
        AsyncMock(return_value=ProviderAvailability(available=True)),
    )
    monkeypatch.setattr(
        "flyt.apps.extension.services.AiUsageService.admit_request",
        AsyncMock(return_value=AiUsageAdmission(True, None)),
    )
    dispatch = await ExtensionTranslationService(db).prepare_translation(
        K_TEST_USER_ID, TranslationCreate(text="Jeg lærer norsk.")
    )
    monkeypatch.setattr(
        dispatch.provider,
        "generate",
        AsyncMock(return_value=GenerationResult(text="  I am learning Norwegian.  ")),
    )

    result = await ExtensionTranslationService(db).dispatch_translation(dispatch)

    assert result.source_text == "Jeg lærer norsk."
    assert result.translated_text == "I am learning Norwegian."


async def test_dispatch_translation_given_provider_failure_expect_stable_domain_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = AsyncMock()
    monkeypatch.setattr(
        "flyt.apps.extension.services.OpenRouterProvider.is_available",
        AsyncMock(return_value=ProviderAvailability(available=True)),
    )
    monkeypatch.setattr(
        "flyt.apps.extension.services.AiUsageService.admit_request",
        AsyncMock(return_value=AiUsageAdmission(True, None)),
    )
    dispatch = await ExtensionTranslationService(db).prepare_translation(
        K_TEST_USER_ID, TranslationCreate(text="Jeg lærer norsk.")
    )
    monkeypatch.setattr(
        dispatch.provider,
        "generate",
        AsyncMock(side_effect=ProviderFailure(ProviderFailureClass.TIMEOUT)),
    )

    with pytest.raises(ExtensionTranslationProviderError) as raised:
        await ExtensionTranslationService(db).dispatch_translation(dispatch)

    assert raised.value.code == "EXTENSION_TRANSLATION_PROVIDER_TIMEOUT"
