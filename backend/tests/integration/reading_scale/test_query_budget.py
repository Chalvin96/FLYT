from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from scripts.seed_reading_scale import K_READING_SEED_PRESETS
from scripts.seed_reading_scale import build_reading_endpoint_paths
from scripts.seed_reading_scale import seed_reading_scale
from tests.helpers.auth import authenticate
from tests.helpers.sql_log import capture_sql
from tests.helpers.sql_log import statements_reading

pytestmark = pytest.mark.anyio

K_READING_ENDPOINT_QUERY_BUDGETS = {
    "reading home": 4,
    "theme list": 1,
    "theme stories": 5,
    "story page": 6,
    "recommendations": 3,
    "imports": 3,
}


@pytest.mark.parametrize("endpoint", sorted(K_READING_ENDPOINT_QUERY_BUDGETS))
async def test_reading_endpoint_given_small_seed_expect_query_count_within_budget(
    endpoint: str,
    client: AsyncClient,
    async_session: AsyncSession,
) -> None:
    seed = await seed_reading_scale(async_session, K_READING_SEED_PRESETS["small"])
    await authenticate(client, seed.learner)
    path = build_reading_endpoint_paths(seed)[endpoint]

    with capture_sql(async_session) as executed:
        response = await client.get(path)

    assert response.status_code == HTTPStatus.OK, response.text
    budget = K_READING_ENDPOINT_QUERY_BUDGETS[endpoint]
    statements = "\n".join(statement for statement, _ in executed)
    assert len(executed) <= budget, (
        f"{endpoint} ran {len(executed)} statements, budget {budget}:\n{statements}"
    )
    if endpoint in {"reading home", "theme list", "recommendations"}:
        assert statements_reading(executed, "reading_story_pages") == []
