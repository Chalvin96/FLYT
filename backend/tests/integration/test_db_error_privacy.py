import pytest
from sqlalchemy import text
from sqlalchemy.exc import DataError

from flyt.core.db import AsyncSessionLocal
from flyt.core.db import async_engine


@pytest.mark.anyio
async def test_db_error_given_private_bound_text_expect_parameters_omitted() -> None:
    private_marker = "private-learner-text-db-error-regression"

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("CREATE TEMP TABLE private_text_probe (content varchar(1))")
            )
            with pytest.raises(DataError) as error:
                await session.execute(
                    text("INSERT INTO private_text_probe (content) VALUES (:content)"),
                    {"content": private_marker},
                )

            assert private_marker not in str(error.value)
    finally:
        await async_engine.dispose()
