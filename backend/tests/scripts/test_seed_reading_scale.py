import pytest

from scripts.seed_reading_scale import is_isolated_database_url


@pytest.mark.parametrize(
    "database_url",
    [
        "postgresql+psycopg://postgres:postgres@localhost:5432/flyt",
        "postgresql+psycopg://postgres:postgres@db.example.com:5432/reading_seed",
    ],
)
def test_is_isolated_database_url_given_shared_database_expect_false(
    database_url: str,
) -> None:
    assert is_isolated_database_url(database_url) is False


@pytest.mark.parametrize(
    "query_string",
    [
        "dbname=flyt",
        "host=db.example.com",
        "hostaddr=203.0.113.5",
        "service=x",
        "sslmode=require",
        "dbname=",
        "service",
        "",
    ],
)
def test_is_isolated_database_url_given_query_string_expect_false(
    query_string: str,
) -> None:
    database_url = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/reading_seed"
        f"?{query_string}"
    )
    assert is_isolated_database_url(database_url) is False


def test_is_isolated_database_url_given_local_reading_seed_database_expect_true() -> (
    None
):
    assert (
        is_isolated_database_url(
            "postgresql+psycopg://postgres:postgres@127.0.0.1:56645/reading_seed"
        )
        is True
    )
