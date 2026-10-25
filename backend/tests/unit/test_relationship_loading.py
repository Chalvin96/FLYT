from importlib import import_module

from sqlalchemy.orm import configure_mappers

from flyt.core.base import Base


def test_relationships_given_all_mappers_expect_no_implicit_loads() -> None:
    import_module("flyt.core.model_registry")
    configure_mappers()

    implicit_relationships = {
        f"{mapper.class_.__name__}.{relationship.key}"
        for mapper in Base.registry.mappers
        for relationship in mapper.relationships
        if relationship.lazy not in {"raise", "write_only"}
    }

    assert implicit_relationships == set()
