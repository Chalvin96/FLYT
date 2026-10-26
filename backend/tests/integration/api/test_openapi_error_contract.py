from http import HTTPStatus

from jsonschema import Draft202012Validator
import pytest
from httpx import AsyncClient

from flyt.main import app
from tests.factories import UserFactory
from tests.helpers.auth import authenticate


@pytest.mark.parametrize(
    ("path", "method", "statuses"),
    [
        ("/lessons/{lesson_id}/start", "post", [401, 403, 404, 413, 422]),
        (
            "/lessons/{lesson_id}/exercises/{exercise_id}/judge-write",
            "post",
            [400, 401, 403, 404, 413, 422, 429, 503],
        ),
        ("/me/cards/{user_card_id}/review", "post", [400, 401, 403, 404, 409, 422]),
        ("/me/decks/{deck_id}/subscribe", "post", [401, 403, 404, 422]),
        ("/lexicons/search", "get", [400, 422, 429]),
        ("/lexicons/browse", "get", [400, 404, 422, 429]),
        ("/reading/stories/{story_uuid}", "get", [401, 404, 409, 422]),
        ("/imports", "post", [401, 403, 413, 422, 429]),
        ("/imports/{import_uuid}/retry", "post", [401, 403, 404, 409, 422, 429]),
        ("/chatgpt/link/start", "post", [401, 403, 422, 503]),
        ("/chatbot/messages", "post", [400, 401, 403, 409, 422, 429, 502, 503, 504]),
        ("/extension/translate", "post", [400, 401, 403, 422, 429, 502, 503, 504]),
        ("/story-generation/generations", "post", [401, 403, 422, 429]),
    ],
)
def test_openapi_errors_given_route_failures_expect_declared_json_schemas(
    path: str, method: str, statuses: list[int]
) -> None:
    responses = app.openapi()["paths"][path][method]["responses"]

    for status_code in statuses:
        assert "schema" in responses[str(status_code)]["content"]["application/json"]


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("path", "payload"),
    [("/imports", {"text": "   "}), ("/imports", {})],
    ids=["domain-validation", "request-validation"],
)
async def test_openapi_validation_given_domain_or_request_error_expect_matching_body(
    client: AsyncClient, path: str, payload: dict
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(path, json=payload)

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    openapi = app.openapi()
    response_schema = openapi["paths"][path]["post"]["responses"]["422"]["content"][
        "application/json"
    ]["schema"]
    Draft202012Validator(
        {**response_schema, "components": openapi["components"]}
    ).validate(response.json())


@pytest.mark.anyio
async def test_openapi_not_found_given_missing_lesson_expect_matching_error_envelope(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post("/lessons/2147483647/start")

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json() == {
        "detail": {
            "code": "LESSON_NOT_FOUND",
            "message": "Lesson not found",
            "error": None,
        }
    }
    openapi = app.openapi()
    response_schema = openapi["paths"]["/lessons/{lesson_id}/start"]["post"][
        "responses"
    ]["404"]["content"]["application/json"]["schema"]
    Draft202012Validator(
        {**response_schema, "components": openapi["components"]}
    ).validate(response.json())
