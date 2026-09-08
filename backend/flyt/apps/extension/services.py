from dataclasses import dataclass
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.ai_usage.types import AiUsageRequest
from flyt.apps.extension.exceptions import ExtensionTranslationProviderError
from flyt.apps.extension.exceptions import ExtensionTranslationQuotaExceededError
from flyt.apps.extension.exceptions import ExtensionTranslationValidationError
from flyt.apps.extension.schemas import K_TRANSLATION_RESULT_MAX_CHARACTERS
from flyt.apps.extension.schemas import TranslationCreate
from flyt.apps.extension.schemas import TranslationRead
from flyt.clients.openrouter import OpenRouterProvider
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.core.config import settings

logger = logging.getLogger(__name__)

K_TRANSLATION_INSTRUCTIONS = (
    "Translate the supplied Norwegian text into natural English. Return only "
    "the translation, without quotation marks, explanation, labels, or markdown. "
    "Preserve paragraph breaks and punctuation. If the supplied text is already "
    "English or does not require translation, reproduce it exactly without "
    "rewriting it."
)
K_TRANSLATION_MAX_TOKENS = 800


@dataclass(frozen=True)
class TranslationDispatch:
    user_id: int
    source_text: str
    provider: OpenRouterProvider
    request: GenerationRequest


class ExtensionTranslationService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def prepare_translation(
        self,
        user_id: int,
        request: TranslationCreate,
    ) -> TranslationDispatch:
        source_text = request.text
        provider = OpenRouterProvider(
            model=settings.CHATBOT_FLYT_MODEL,
            reasoning_effort=settings.CHATBOT_OPENROUTER_REASONING_EFFORT,
            timeout_seconds=settings.CHATBOT_OPENROUTER_TIMEOUT_SECONDS,
        )
        availability = await provider.is_available(user_id)
        if not availability.available:
            raise ExtensionTranslationProviderError(
                # A static Flyt provider with no configured key is still an
                # authentication-shaped provider failure at the public edge.
                ProviderFailureClass.AUTHENTICATION
            )

        provider_request = GenerationRequest(
            instructions=K_TRANSLATION_INSTRUCTIONS,
            prompt=source_text,
            max_tokens=K_TRANSLATION_MAX_TOKENS,
        )
        admission = await AiUsageService(self._db).admit_request(
            user_id,
            AiUsageRequest(
                instructions=provider_request.instructions,
                prompt=provider_request.prompt,
                max_tokens=provider_request.max_tokens,
            ),
        )
        if not admission.admitted:
            raise ExtensionTranslationQuotaExceededError()
        return TranslationDispatch(
            user_id=user_id,
            source_text=source_text,
            provider=provider,
            request=provider_request,
        )

    async def dispatch_translation(
        self,
        dispatch: TranslationDispatch,
    ) -> TranslationRead:
        try:
            result = await dispatch.provider.generate(
                dispatch.user_id,
                dispatch.request,
            )
        except ProviderFailure as error:
            logger.info(
                "extension translation provider failure: class=%s",
                error.failure_class.value,
            )
            raise ExtensionTranslationProviderError(error.failure_class) from error

        translated_text = result.text.strip()
        if (
            not translated_text
            or len(translated_text) > K_TRANSLATION_RESULT_MAX_CHARACTERS
        ):
            raise ExtensionTranslationValidationError(
                "Translation was too long to display. Try a shorter selection."
            )
        return TranslationRead(
            source_text=dispatch.source_text,
            translated_text=translated_text,
        )
