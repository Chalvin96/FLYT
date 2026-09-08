"""Resolve configured text-generation providers."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from flyt.clients.chatgpt import ChatGPTProvider
from flyt.clients.openrouter import OpenRouterProvider
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderChoice
from flyt.clients.provider import ProviderFailure
from flyt.clients.provider import ProviderFailureClass
from flyt.clients.stub import StubProvider
from flyt.core.config import settings


@dataclass(frozen=True)
class ProviderSelection:
    provider: ModelProvider
    funded_by_flyt: bool


class ProviderRegistry:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    def offered(self) -> list[str]:
        return [selection.provider.name for selection in self._build_providers()]

    async def load_choices(self, user_id: int) -> list[ProviderChoice]:
        result: list[ProviderChoice] = []
        for selection in self._build_providers():
            provider = selection.provider
            availability = await provider.is_available(user_id)
            result.append(
                ProviderChoice(
                    name=provider.name,
                    model=provider.model,
                    available=availability.available,
                    limited_by_flyt=selection.funded_by_flyt,
                    reason=availability.reason,
                    action=availability.action,
                )
            )
        return result

    async def resolve(self, name: str, user_id: int) -> ProviderSelection:
        for selection in self._build_providers():
            provider = selection.provider
            if provider.name == name:
                availability = await provider.is_available(user_id)
                if not availability.available:
                    raise ProviderFailure(
                        ProviderFailureClass.AUTHENTICATION,
                        f"Provider {name} is unavailable: {availability.reason}",
                    )
                return selection
        raise ProviderFailure(
            ProviderFailureClass.AUTHENTICATION,
            f"Provider {name} is not configured",
        )

    def _build_providers(self) -> list[ProviderSelection]:
        providers: list[ProviderSelection] = []
        if "openrouter" in settings.STORY_GENERATION_ENABLED_PROVIDERS:
            providers.append(
                ProviderSelection(provider=OpenRouterProvider(), funded_by_flyt=True)
            )
        if "chatgpt" in settings.STORY_GENERATION_ENABLED_PROVIDERS:
            providers.append(
                ProviderSelection(
                    provider=ChatGPTProvider(self._db), funded_by_flyt=False
                )
            )
        if "stub" in settings.STORY_GENERATION_ENABLED_PROVIDERS:
            providers.append(
                ProviderSelection(provider=StubProvider(), funded_by_flyt=True)
            )
        return providers
