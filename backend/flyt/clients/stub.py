"""Canned text provider for the E2E stack."""

from flyt.clients.provider import GenerationRequest
from flyt.clients.provider import GenerationResult
from flyt.clients.provider import ModelProvider
from flyt.clients.provider import ProviderAvailability

_STUB_STORY = """\
Jeg er liten. Du er stor.

Jeg ser boka. Boka er liten. Jeg går. Du går.

Jeg så bøkene. Bøkene var store. Du var større.

Maten er god. Jeg snakker. Du snakker bedre. Vær god.
"""


class StubProvider(ModelProvider):
    """Canned Norwegian text for the E2E stack; settings reject it in production.

    Every surface form is committed in the e2e lexicon fixture, so token
    resolution, pagination, and lemma linking run against words guaranteed
    present in the e2e database.
    """

    @property
    def name(self) -> str:
        return "stub"

    @property
    def model(self) -> str:
        return "flyt/stub-norsk"

    async def is_available(self, user_id: int) -> ProviderAvailability:
        return ProviderAvailability(available=True)

    async def generate(
        self,
        user_id: int,
        request: GenerationRequest,
    ) -> GenerationResult:
        return GenerationResult(
            text=_STUB_STORY,
            prompt_tokens=254,
            completion_tokens=52,
        )
