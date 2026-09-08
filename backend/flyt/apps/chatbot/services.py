from dataclasses import dataclass
import logging

from pydantic import SecretStr
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.ai_usage.service import AiUsageService
from flyt.apps.ai_usage.service import is_weekly_admissible
from flyt.apps.ai_usage.types import AiUsageRequest
from flyt.apps.chatbot.constants import K_CHATBOT_OPENROUTER_KEY_MAX_LENGTH
from flyt.apps.chatbot.constants import K_CHATBOT_OPENROUTER_KEY_MIN_LENGTH
from flyt.apps.chatbot.constants import K_CHATBOT_MODEL_ORDER
from flyt.apps.chatbot.constants import K_CHATBOT_OUTPUT_MAX_CHARACTERS
from flyt.apps.chatbot.exceptions import ChatbotCredentialStorageError
from flyt.apps.chatbot.exceptions import ChatbotCredentialValidationError
from flyt.apps.chatbot.exceptions import ChatbotModelUnavailableError
from flyt.apps.chatbot.exceptions import ChatbotProviderError
from flyt.apps.chatbot.exceptions import ChatbotQuotaExceededError
from flyt.apps.chatbot.models import OpenRouterCredential
from flyt.apps.chatbot.prompt import build_chatbot_prompt
from flyt.apps.chatbot.prompt import build_chatbot_instructions
from flyt.apps.chatbot.prompt import build_minimum_chatbot_request
from flyt.apps.chatbot.schemas import ChatbotMessageCreate
from flyt.apps.chatbot.schemas import ChatbotMessageRead
from flyt.apps.chatbot.schemas import ChatbotModelRead
from flyt.apps.chatbot.schemas import ChatbotSurfaceRead
from flyt.apps.chatbot.schemas import OpenRouterKeyRead
from flyt.apps.chatbot.types import ChatbotModel
from flyt.apps.chatbot.types import ChatbotModelDefinition
from flyt.apps.chatbot.types import OpenRouterKeyStatus
from flyt.clients.chatgpt import ChatGPTProvider
from flyt.clients.openrouter import OpenRouterProvider
from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderAvailability
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ChatbotCatalogEntry:
    definition: ChatbotModelDefinition
    provider: ModelProvider


@dataclass(frozen=True)
class ChatbotDispatch:
    """One admitted message ready for provider dispatch."""

    user_id: int
    entry: ChatbotCatalogEntry
    provider_request: GenerationRequest


async def _availability_from_snapshot(
    provider: ModelProvider,
    user_id: int,
    learner_key_configured: bool,
) -> ProviderAvailability:
    """Classify one catalog entry from the request-local surface snapshot.

    OpenRouter models classify the preloaded credential instead of
    re-resolving it; other providers keep their own availability behavior.
    """
    if isinstance(provider, OpenRouterProvider):
        return provider.availability_for_preloaded_key(learner_key_configured)
    return await provider.is_available(user_id)


class UserOpenRouterKeyService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def load_key_status(self, user_id: int) -> OpenRouterKeyStatus:
        credential = await self._db.scalar(
            select(OpenRouterCredential).where(OpenRouterCredential.user_id == user_id)
        )
        if credential is None:
            return OpenRouterKeyStatus(configured=False)
        return OpenRouterKeyStatus(configured=True)

    async def load_api_key(self, user_id: int) -> str | None:
        credential = await self._db.scalar(
            select(OpenRouterCredential).where(OpenRouterCredential.user_id == user_id)
        )
        if credential is None:
            return None
        return credential.api_key.get_secret_value()

    async def replace_api_key(
        self, user_id: int, api_key: SecretStr
    ) -> OpenRouterKeyRead:
        if not settings.PROVIDER_CREDENTIAL_ENCRYPTION_KEYS:
            raise ChatbotCredentialStorageError()

        secret = api_key.get_secret_value().strip()
        if not (
            K_CHATBOT_OPENROUTER_KEY_MIN_LENGTH
            <= len(secret)
            <= K_CHATBOT_OPENROUTER_KEY_MAX_LENGTH
        ):
            raise ChatbotCredentialValidationError()

        insert_statement = insert(OpenRouterCredential).values(
            user_id=user_id,
            api_key=SecretStr(secret),
        )
        await self._db.execute(
            insert_statement.on_conflict_do_update(
                index_elements=[OpenRouterCredential.user_id],
                set_={"api_key": insert_statement.excluded.api_key},
            )
        )
        return await self._build_key_status_response(user_id)

    async def delete_api_key(self, user_id: int) -> None:
        credential = await self._db.scalar(
            select(OpenRouterCredential).where(OpenRouterCredential.user_id == user_id)
        )
        if credential is not None:
            await self._db.delete(credential)

    async def _build_key_status_response(self, user_id: int) -> OpenRouterKeyRead:
        key_status = await self.load_key_status(user_id)
        return OpenRouterKeyRead(openrouterKeyConfigured=key_status.configured)


class ChatbotService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def load_surface(self, user_id: int) -> ChatbotSurfaceRead:
        catalog = self._build_catalog()
        usage_service = AiUsageService(self._db)
        minimum_chatbot_request = build_minimum_chatbot_request(
            settings.CHATBOT_MAX_OUTPUT_TOKENS
        )
        key_status = await UserOpenRouterKeyService(self._db).load_key_status(user_id)
        weekly_usage = await usage_service.load_week_usage(user_id)
        funded_admitted = is_weekly_admissible(weekly_usage, minimum_chatbot_request)
        funded_remaining_percent = (
            weekly_usage.remaining_percent if funded_admitted else None
        )
        models: list[ChatbotModelRead] = []
        for entry in catalog:
            availability = await _availability_from_snapshot(
                entry.provider, user_id, key_status.configured
            )
            remaining_percent: int | None = None
            if entry.definition.funded_by_flyt and availability.available:
                if not funded_admitted:
                    availability = ProviderAvailability(
                        available=False,
                        reason="unavailable",
                        action=None,
                    )
                else:
                    remaining_percent = funded_remaining_percent
            models.append(
                ChatbotModelRead(
                    id=entry.definition.id,
                    label=entry.definition.label,
                    detail=entry.definition.detail,
                    model=await entry.provider.model_for(user_id),
                    available=availability.available,
                    reason=availability.reason,
                    action=availability.action,
                    requiresOpenRouterKey=entry.definition.requires_openrouter_key,
                    remainingPercent=remaining_percent,
                )
            )
        return ChatbotSurfaceRead(
            models=models,
            openrouterKeyConfigured=key_status.configured,
        )

    async def prepare_message(
        self, user_id: int, request: ChatbotMessageCreate
    ) -> ChatbotDispatch:
        """Validate and admit one message; flushes only.

        The composition root commits the funded debit before dispatch_message
        invokes the provider, so a failed or cancelled dispatch still spends.
        """
        entry = self._find_entry(request.model)
        if entry is None:
            raise ChatbotModelUnavailableError(request.model.value)

        availability = await entry.provider.is_available(user_id)
        if not availability.available:
            raise ChatbotModelUnavailableError(
                request.model.value,
                availability.reason,
                availability.action,
            )

        provider_request = GenerationRequest(
            instructions=build_chatbot_instructions(),
            prompt=build_chatbot_prompt(request),
            max_tokens=settings.CHATBOT_MAX_OUTPUT_TOKENS,
        )
        if entry.definition.funded_by_flyt:
            admission = await AiUsageService(self._db).admit_request(
                user_id,
                AiUsageRequest(
                    instructions=provider_request.instructions,
                    prompt=provider_request.prompt,
                    max_tokens=provider_request.max_tokens,
                ),
            )
            if not admission.admitted:
                raise ChatbotQuotaExceededError()
        return ChatbotDispatch(
            user_id=user_id,
            entry=entry,
            provider_request=provider_request,
        )

    async def dispatch_message(self, dispatch: ChatbotDispatch) -> ChatbotMessageRead:
        """Call the provider and validate the answer; runs after the
        composition root's commit."""
        try:
            result = await dispatch.entry.provider.generate(
                dispatch.user_id, dispatch.provider_request
            )
        except ProviderFailure as error:
            logger.info(
                "chatbot provider failure: model=%s class=%s",
                dispatch.entry.definition.id.value,
                error.failure_class.value,
            )
            raise ChatbotProviderError(error.failure_class) from error

        if len(result.text) > K_CHATBOT_OUTPUT_MAX_CHARACTERS:
            raise ChatbotProviderError(ProviderFailureClass.REQUEST_REJECTED)

        return ChatbotMessageRead(
            model=dispatch.entry.definition.id, content=result.text
        )

    def _build_catalog(self) -> list[ChatbotCatalogEntry]:
        user_openrouter_key_service = UserOpenRouterKeyService(self._db)
        providers = {
            ChatbotModel.FLYT: OpenRouterProvider(
                model=settings.CHATBOT_FLYT_MODEL,
                reasoning_effort=settings.CHATBOT_OPENROUTER_REASONING_EFFORT,
                timeout_seconds=settings.CHATBOT_OPENROUTER_TIMEOUT_SECONDS,
            ),
            ChatbotModel.CHATGPT: ChatGPTProvider(
                self._db,
                timeout_seconds=settings.CHATBOT_CHATGPT_TIMEOUT_SECONDS,
            ),
            ChatbotModel.DEEPSEEK: OpenRouterProvider(
                model=settings.CHATBOT_DEEPSEEK_MODEL,
                reasoning_effort=settings.CHATBOT_OPENROUTER_REASONING_EFFORT,
                timeout_seconds=settings.CHATBOT_OPENROUTER_TIMEOUT_SECONDS,
                api_key_resolver=user_openrouter_key_service.load_api_key,
            ),
            ChatbotModel.GLM: OpenRouterProvider(
                model=settings.CHATBOT_GLM_MODEL,
                reasoning_effort=settings.CHATBOT_OPENROUTER_REASONING_EFFORT,
                timeout_seconds=settings.CHATBOT_OPENROUTER_TIMEOUT_SECONDS,
                api_key_resolver=user_openrouter_key_service.load_api_key,
            ),
        }
        definitions = {
            ChatbotModel.FLYT: ChatbotModelDefinition(
                id=ChatbotModel.FLYT,
                label="Flyt",
                detail="GLM 5.3 Flash",
                requires_openrouter_key=False,
                funded_by_flyt=True,
            ),
            ChatbotModel.CHATGPT: ChatbotModelDefinition(
                id=ChatbotModel.CHATGPT,
                label="ChatGPT",
                detail="powered by Luna",
                requires_openrouter_key=False,
            ),
            ChatbotModel.DEEPSEEK: ChatbotModelDefinition(
                id=ChatbotModel.DEEPSEEK,
                label="DeepSeek",
                detail="via OpenRouter",
                requires_openrouter_key=True,
            ),
            ChatbotModel.GLM: ChatbotModelDefinition(
                id=ChatbotModel.GLM,
                label="GLM 5.3 Flash",
                detail="via OpenRouter",
                requires_openrouter_key=True,
            ),
        }
        enabled = set(settings.CHATBOT_ENABLED_MODELS)
        entries: list[ChatbotCatalogEntry] = []
        for model_name in K_CHATBOT_MODEL_ORDER:
            if model_name not in enabled:
                continue
            model = ChatbotModel(model_name)
            entries.append(ChatbotCatalogEntry(definitions[model], providers[model]))
        return entries

    def _find_entry(self, model: ChatbotModel) -> ChatbotCatalogEntry | None:
        return next(
            (entry for entry in self._build_catalog() if entry.definition.id is model),
            None,
        )
