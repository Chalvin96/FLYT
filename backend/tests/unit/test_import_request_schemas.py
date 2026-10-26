import pytest
from pydantic import ValidationError

from flyt.apps.reading.constants import K_MAX_NORMALIZED_BYTES
from flyt.apps.reading.schemas import ExtensionImportCreate
from flyt.apps.reading.schemas import PasteImportCreate


@pytest.mark.parametrize("schema", [PasteImportCreate, ExtensionImportCreate])
def test_import_text_given_over_character_limit_expect_validation_error(schema) -> None:
    with pytest.raises(ValidationError, match="String should have at most"):
        schema.model_validate(
            {
                "text": "a" * (K_MAX_NORMALIZED_BYTES + 1),
                "source_url": "https://example.com",
            }
        )


@pytest.mark.parametrize("schema", [PasteImportCreate, ExtensionImportCreate])
def test_import_text_given_character_limit_expect_accepted(schema) -> None:
    text = "a" * K_MAX_NORMALIZED_BYTES

    request = schema.model_validate({"text": text, "source_url": "https://example.com"})

    assert request.text == text
