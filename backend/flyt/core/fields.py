from typing import Any

from cryptography.fernet import Fernet
from cryptography.fernet import MultiFernet
from pydantic import SecretStr
from sqlalchemy import Text
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

from flyt.core.config import settings

_fernet_keyring_instance: MultiFernet | None = None


def build_fernet_keyring(keys: list[str]) -> MultiFernet:
    return MultiFernet([Fernet(key.encode("ascii")) for key in keys])


def _fernet_keyring() -> MultiFernet:
    global _fernet_keyring_instance
    if _fernet_keyring_instance is None:
        keys = settings.PROVIDER_CREDENTIAL_ENCRYPTION_KEYS
        if not keys:
            raise RuntimeError("PROVIDER_CREDENTIAL_ENCRYPTION_KEYS is not configured")
        _fernet_keyring_instance = build_fernet_keyring(keys)
    return _fernet_keyring_instance


class EncryptedTextField(TypeDecorator[SecretStr]):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any | None, dialect: Dialect) -> str | None:
        if value is None:
            return None
        if not isinstance(value, SecretStr):
            msg = f"EncryptedTextField binds SecretStr only, got {type(value).__name__}"
            raise TypeError(msg)
        return (
            _fernet_keyring()
            .encrypt(value.get_secret_value().encode("utf-8"))
            .decode("ascii")
        )

    def process_result_value(
        self, value: str | None, dialect: Dialect
    ) -> SecretStr | None:
        if value is None:
            return None
        return SecretStr(
            _fernet_keyring().decrypt(value.encode("ascii")).decode("utf-8")
        )
