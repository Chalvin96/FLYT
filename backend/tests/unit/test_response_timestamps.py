from datetime import datetime
from datetime import timedelta
from datetime import timezone
from datetime import UTC
import importlib
import inspect
import json
import pkgutil

import flyt.apps
from pydantic import BaseModel
from pydantic import TypeAdapter
import pytest


def response_datetime_fields():
    for domain in pkgutil.iter_modules(flyt.apps.__path__, prefix="flyt.apps."):
        if not domain.ispkg:
            continue
        schema_module = f"{domain.name}.schemas"
        if importlib.util.find_spec(schema_module) is None:
            continue
        module = importlib.import_module(schema_module)
        for name, model in vars(module).items():
            if not inspect.isclass(model) or not issubclass(model, BaseModel):
                continue
            if model.__module__ != module.__name__:
                continue
            for field_name, field in model.model_fields.items():
                if "datetime" in str(field.annotation):
                    yield pytest.param(model, field_name, id=f"{name}.{field_name}")


@pytest.mark.parametrize(("model", "field_name"), list(response_datetime_fields()))
@pytest.mark.parametrize("offset", [None, timezone(timedelta(hours=2))])
def test_response_datetime_given_storage_or_offset_expect_explicit_utc_instant(
    model: type[BaseModel],
    field_name: str,
    offset: timezone | None,
) -> None:
    value = datetime(2026, 10, 25, 12, 30, tzinfo=offset)
    response = model.model_construct(**{field_name: value})
    serialized = json.loads(response.model_dump_json(exclude_unset=True))[field_name]
    assert serialized.endswith("Z")
    schema = model.model_json_schema(mode="serialization")["properties"][field_name]
    alternatives = schema.get("anyOf", [schema])
    assert {"type": "string", "format": "date-time"} in [
        {key: choice[key] for key in ("type", "format") if key in choice}
        for choice in alternatives
    ]
    parsed = TypeAdapter(datetime).validate_python(serialized)
    expected = value.replace(tzinfo=UTC) if offset is None else value
    assert parsed == expected
