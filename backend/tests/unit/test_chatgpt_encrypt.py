import pytest
from pydantic import SecretStr
from pydantic import ValidationError

from flyt.core import fields
from flyt.core.config import Settings
from flyt.core.fields import EncryptedTextField
from flyt.core.fields import build_fernet_keyring

KEY_A = "kkx-ZViSkteSQGh9z5FDskkiQGFImdcA1ceQt2DnwAk="
KEY_B = "nIsoQZxBYRCiAp8vobUudWJcaFx8wL8OZ6qWycgNagw="


@pytest.fixture
def encrypted_type() -> EncryptedTextField:
    return EncryptedTextField()


def test_encrypted_secret_given_secret_str_expect_plaintext_round_trip(
    encrypted_type: EncryptedTextField,
) -> None:
    bound = encrypted_type.process_bind_param(SecretStr("live-token"), None)
    assert bound is not None
    assert "live-token" not in bound
    read_back = encrypted_type.process_result_value(bound, None)
    assert isinstance(read_back, SecretStr)
    assert read_back.get_secret_value() == "live-token"


def test_encrypted_secret_given_bare_str_expect_type_error(
    encrypted_type: EncryptedTextField,
) -> None:
    with pytest.raises(TypeError):
        encrypted_type.process_bind_param("bare-token", None)


def test_encrypted_secret_given_none_expect_none(
    encrypted_type: EncryptedTextField,
) -> None:
    assert encrypted_type.process_bind_param(None, None) is None
    assert encrypted_type.process_result_value(None, None) is None


def test_encrypted_secret_given_other_type_expect_type_error(
    encrypted_type: EncryptedTextField,
) -> None:
    with pytest.raises(TypeError):
        encrypted_type.process_bind_param(42, None)


def test_keyring_given_prepended_key_expect_old_values_still_decrypt(
    encrypted_type: EncryptedTextField,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        fields, "_fernet_keyring_instance", build_fernet_keyring([KEY_B])
    )
    bound = encrypted_type.process_bind_param(SecretStr("rotatable-token"), None)
    assert bound is not None

    monkeypatch.setattr(
        fields,
        "_fernet_keyring_instance",
        build_fernet_keyring([KEY_A, KEY_B]),
    )
    read_back = encrypted_type.process_result_value(bound, None)
    assert read_back is not None
    assert read_back.get_secret_value() == "rotatable-token"


def test_settings_given_missing_keys_expect_validation_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PROVIDER_CREDENTIAL_ENCRYPTION_KEYS", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_given_empty_keys_expect_validation_error() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[])


def test_settings_given_malformed_key_expect_validation_error() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=["not-a-fernet-key"],
        )


def test_decrypted_value_given_repr_expect_no_plaintext(
    encrypted_type: EncryptedTextField,
) -> None:
    bound = encrypted_type.process_bind_param(SecretStr("sensitive-token"), None)
    assert bound is not None
    read_back = encrypted_type.process_result_value(bound, None)
    assert read_back is not None
    assert "sensitive-token" not in repr(read_back)
    assert "sensitive-token" not in str(read_back)


def test_sentry_scrubber_given_credential_field_names_expect_values_redacted() -> None:
    from sentry_sdk.scrubber import EventScrubber

    from flyt.core.observability import SCRUBBED_FIELD_NAMES

    frame_locals = {
        "access_token": "SECRET",
        "refresh_token": "SECRET",
        "tokens": {"id_token": "SECRET"},
        "api_key": "SECRET",
        "apiKey": "SECRET",
        "model": "gpt-5.6-luna",
    }
    EventScrubber(denylist=SCRUBBED_FIELD_NAMES, recursive=True).scrub_dict(
        frame_locals
    )

    assert frame_locals["model"] == "gpt-5.6-luna"
    assert all(
        not isinstance(frame_locals[field], (str, dict))
        for field in ("access_token", "refresh_token", "tokens", "api_key", "apiKey")
    )
