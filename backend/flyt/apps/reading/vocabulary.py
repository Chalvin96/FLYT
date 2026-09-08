from uuid import UUID

from flyt.apps.lexicons.types import K_USER_LEMMA_STATE_NEW
from flyt.apps.lexicons.types import UserLemmaState
from flyt.apps.users.services import UserVocabularyQueries


async def resolve_user_states_for_tokens(
    tokens: list[dict],
    user_id: int,
    user_vocabulary_queries: UserVocabularyQueries,
) -> dict[str, UserLemmaState]:
    lemma_uuids = {
        UUID(token["lemmaUuid"])
        for token in tokens
        if token.get("lemmaUuid") is not None
    }
    if not lemma_uuids:
        return {}

    states = await user_vocabulary_queries.get_states_for_lemma_uuids(
        user_id, list(lemma_uuids)
    )

    result: dict[str, UserLemmaState] = {}
    for lemma_uuid in lemma_uuids:
        key = str(lemma_uuid)
        result[key] = states.get(key, K_USER_LEMMA_STATE_NEW)
    return result
