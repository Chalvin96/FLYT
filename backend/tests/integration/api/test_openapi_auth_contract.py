import pytest

from flyt.core.config import settings
from flyt.main import app


@pytest.mark.parametrize(
    ("path", "method"),
    [
        pytest.param("/users/me", "get", id="users"),
        pytest.param("/reading/stories", "get", id="reading"),
        pytest.param(
            "/lexicons/lemmas/{lemma_uuid}/mark-known",
            "post",
            id="lexicons",
        ),
        pytest.param(
            "/lessons/{lesson_id}/exercises/{exercise_id}/judge-write",
            "post",
            id="lessons-additional-responses",
        ),
        pytest.param(
            "/speech/transcribe",
            "post",
            id="speech-additional-responses",
        ),
    ],
)
def test_openapi_given_authenticated_operation_expect_security_contract(
    path: str,
    method: str,
) -> None:
    operation = app.openapi()["paths"][path][method]

    assert operation["security"] == [
        {"AccessCookie": []},
        {"BearerToken": []},
    ]
    assert "401" not in operation["responses"]


@pytest.mark.parametrize(
    ("path", "method"),
    [
        pytest.param("/users/logout", "post", id="users"),
        pytest.param("/reading/groups", "get", id="reading"),
        pytest.param("/reading/hero", "get", id="reading-second-route"),
        pytest.param("/lexicons/search", "get", id="lexicons"),
        pytest.param(
            "/lexicons/lemmas/{lemma_uuid}/definitions",
            "get",
            id="lexicons-optional-auth",
        ),
    ],
)
def test_openapi_given_public_operation_expect_no_auth_contract(
    path: str,
    method: str,
) -> None:
    operation = app.openapi()["paths"][path][method]

    assert "security" not in operation
    assert "401" not in operation["responses"]


def test_openapi_given_authenticated_routes_expect_declared_security_schemes() -> None:
    assert app.openapi()["components"]["securitySchemes"] == {
        "AccessCookie": {
            "type": "apiKey",
            "in": "cookie",
            "name": settings.ACCESS_COOKIE_NAME,
        },
        "BearerToken": {"type": "http", "scheme": "bearer"},
    }
