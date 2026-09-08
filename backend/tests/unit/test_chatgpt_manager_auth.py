import base64
import json
from datetime import datetime
from datetime import timedelta
from datetime import UTC

import httpx
import pytest
from pydantic import SecretStr

from flyt.apps.chatgpt_link.clients import api
from flyt.apps.chatgpt_link.clients import config
from flyt.apps.chatgpt_link.clients.exceptions import RenewalFailedError
from flyt.apps.chatgpt_link.clients.manager import auth
from flyt.apps.chatgpt_link.types import DevicePollApproved
from flyt.apps.chatgpt_link.types import DevicePollPending
from flyt.apps.chatgpt_link.types import RenewalFailureClass
from flyt.libs.utils.date import now

pytestmark = pytest.mark.anyio

MAX_EXPIRY_DIFFERENCE_SECONDS = 5


def _jwt(payload: dict) -> str:
    def segment(data: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")

    return f"{segment({'alg': 'none'})}.{segment(payload)}."


def _access_token(exp: int | None = None) -> str:
    payload: dict = {"sub": "user"}
    if exp is not None:
        payload["exp"] = exp
    return _jwt(payload)


def _id_token(account_id: str = "acct-123") -> str:
    return _jwt({"https://api.openai.com/auth": {"chatgpt_account_id": account_id}})


def _approval() -> DevicePollApproved:
    return DevicePollApproved(
        authorization_code=SecretStr("code"), code_verifier=SecretStr("verifier")
    )


def _stub(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        api.ProviderApi,
        "http_client",
        lambda self, timeout, headers=None: httpx.AsyncClient(
            transport=transport, timeout=timeout, headers=headers
        ),
    )


async def test_exchange_given_no_expires_in_expect_expiry_from_jwt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exp = int((now() + timedelta(hours=1)).replace(tzinfo=UTC).timestamp())

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["content-type"].startswith(
            "application/x-www-form-urlencoded"
        )
        return httpx.Response(
            200,
            json={
                "id_token": _id_token(),
                "access_token": _access_token(exp=exp),
                "refresh_token": "rt-1",
            },
        )

    _stub(monkeypatch, handler)
    credential = await auth.exchange_authorization_code(_approval())
    assert credential.chatgpt_account_id == "acct-123"
    assert credential.refresh_token.get_secret_value() == "rt-1"
    expected = datetime.fromtimestamp(exp, tz=UTC).replace(tzinfo=None)
    assert (
        abs((credential.access_token_expires_at - expected).total_seconds())
        < MAX_EXPIRY_DIFFERENCE_SECONDS
    )


async def test_exchange_given_no_exp_claim_expect_8_day_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id_token": _id_token(),
                "access_token": _access_token(exp=None),
                "refresh_token": "rt-1",
            },
        )

    _stub(monkeypatch, handler)
    before = now()
    credential = await auth.exchange_authorization_code(_approval())
    delta = credential.access_token_expires_at - before
    assert timedelta(days=7, hours=23) < delta <= timedelta(days=8, seconds=5)


async def test_renewal_given_request_expect_json_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    recorded: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        recorded["content_type"] = request.headers["content-type"]
        recorded["body"] = json.loads(request.read().decode())
        return httpx.Response(
            200,
            json={
                "access_token": _access_token(exp=None),
                "refresh_token": "rt-2",
            },
        )

    _stub(monkeypatch, handler)
    renewed = await auth.renew_credential(SecretStr("rt-1"))
    assert recorded["content_type"].startswith("application/json")
    assert recorded["body"] == {
        "client_id": config.CLIENT_ID,
        "grant_type": "refresh_token",
        "refresh_token": "rt-1",
    }
    assert renewed.refresh_token_or_keep_stored is not None
    assert renewed.refresh_token_or_keep_stored.get_secret_value() == "rt-2"


async def test_renewal_given_omitted_refresh_token_expect_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"access_token": _access_token(exp=None)})

    _stub(monkeypatch, handler)
    renewed = await auth.renew_credential(SecretStr("rt-1"))
    assert renewed.refresh_token_or_keep_stored is None


@pytest.mark.parametrize(
    "status_code,body",
    [
        (400, {"error": {"code": "refresh_token_expired"}}),
        (400, {"error": {"code": "refresh_token_reused"}}),
        (400, {"error": {"code": "refresh_token_invalidated"}}),
        (401, {}),
    ],
)
async def test_renewal_failure_given_permanent_class_expect_permanent(
    monkeypatch: pytest.MonkeyPatch, status_code: int, body: dict
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json=body)

    _stub(monkeypatch, handler)
    with pytest.raises(RenewalFailedError) as exc_info:
        await auth.renew_credential(SecretStr("rt-1"))
    assert exc_info.value.classification is RenewalFailureClass.PERMANENT


async def test_renewal_failure_given_unknown_code_expect_transient(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": {"code": "brand_new_code"}})

    _stub(monkeypatch, handler)
    with pytest.raises(RenewalFailedError) as exc_info:
        await auth.renew_credential(SecretStr("rt-1"))
    assert exc_info.value.classification is RenewalFailureClass.TRANSIENT


async def test_revoke_given_unreachable_expect_no_raise(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("unreachable")

    _stub(monkeypatch, handler)
    await auth.revoke_refresh_token(SecretStr("rt-1"))


async def test_poll_given_authorization_pending_expect_pending(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={})

    _stub(monkeypatch, handler)
    outcome = await auth.poll_device_authorization("deviceauth_1", "QYTZ-WD1Q4")
    assert isinstance(outcome, DevicePollPending)


async def test_poll_given_approved_expect_code_and_verifier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"authorization_code": "authcode", "code_verifier": "verifier"},
        )

    _stub(monkeypatch, handler)
    outcome = await auth.poll_device_authorization("deviceauth_1", "QYTZ-WD1Q4")
    assert isinstance(outcome, DevicePollApproved)
    assert outcome.authorization_code.get_secret_value() == "authcode"
    assert outcome.code_verifier.get_secret_value() == "verifier"


async def test_revoke_given_request_expect_revoke_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, float] = {}
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={}))

    def http_client(self, timeout, headers=None):  # type: ignore[no-untyped-def]
        seen["timeout"] = timeout
        return httpx.AsyncClient(transport=transport, timeout=timeout, headers=headers)

    monkeypatch.setattr(api.ProviderApi, "http_client", http_client)
    await auth.revoke_refresh_token(SecretStr("rt-1"))

    assert seen["timeout"] == config.REVOKE_TIMEOUT_SECONDS


async def test_renewal_given_empty_refresh_token_expect_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"access_token": _access_token(exp=None), "refresh_token": ""}
        )

    _stub(monkeypatch, handler)
    renewed = await auth.renew_credential(SecretStr("rt-1"))
    assert renewed.refresh_token_or_keep_stored is None
