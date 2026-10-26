import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.import_service import ImportService
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import StoryVisibility
from scripts.seed_reading_scale import K_READING_SEED_PRESETS
from scripts.seed_reading_scale import seed_reading_scale
from tests.helpers.sql_log import capture_sql
from tests.helpers.sql_log import statements_reading

pytestmark = pytest.mark.anyio


async def test_import_list_given_many_curated_pages_expect_only_import_pages_read(
    async_session: AsyncSession,
) -> None:
    seed = await seed_reading_scale(async_session, K_READING_SEED_PRESETS["small"])
    await async_session.execute(text("ANALYZE reading_story_pages"))
    await async_session.execute(text("ANALYZE reading_stories"))
    import_page_count = await async_session.scalar(
        select(func.count(StoryPage.id))
        .join(Story, Story.id == StoryPage.story_id)
        .where(Story.visibility == StoryVisibility.PRIVATE)
    )

    with capture_sql(async_session) as executed:
        await ImportService(async_session).list_imports(user_id=seed.learner.id)
    [(statement, parameters)] = statements_reading(executed, "reading_story_pages")
    connection = await async_session.connection()
    plan = (
        await connection.exec_driver_sql(
            f"EXPLAIN (ANALYZE, FORMAT JSON) {statement}", parameters
        )
    ).scalar_one()

    assert _page_rows_read(plan[0]["Plan"]) <= import_page_count


def _page_rows_read(node: dict) -> float:
    rows_read = 0.0
    if node.get("Relation Name") == "reading_story_pages":
        rows_per_loop = node["Actual Rows"] + node.get("Rows Removed by Filter", 0)
        rows_read += rows_per_loop * node["Actual Loops"]
    for child in node.get("Plans", []):
        rows_read += _page_rows_read(child)
    return rows_read
