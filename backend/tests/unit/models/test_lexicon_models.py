import pytest
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.lexicons.models import Definition
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaAlias
from flyt.apps.lexicons.models import WordForm
from tests.factories import DefinitionFactory
from tests.factories import LemmaAliasFactory
from tests.factories import LemmaFactory
from tests.factories import WordFormFactory

pytestmark = pytest.mark.anyio


async def test_cascade_delete_lemma_deletes_word_forms(db: AsyncSession) -> None:
    lemma = await LemmaFactory.create(word="test")
    await WordFormFactory.create(form="test1", lemma=lemma)
    await WordFormFactory.create(form="test2", lemma=lemma)

    lemma_id = lemma.id
    await db.delete(lemma)
    await db.flush()

    word_forms = (
        (await db.execute(select(WordForm).where(WordForm.lemma_id == lemma_id)))
        .scalars()
        .all()
    )
    assert len(word_forms) == 0


async def test_cascade_delete_lemma_deletes_definitions(db: AsyncSession) -> None:
    lemma = await LemmaFactory.create(word="test")
    await DefinitionFactory.create(lemma=lemma, definition="First")
    await DefinitionFactory.create(lemma=lemma, definition="Second")

    lemma_id = lemma.id
    await db.delete(lemma)
    await db.flush()

    definitions = (
        (await db.execute(select(Definition).where(Definition.lemma_id == lemma_id)))
        .scalars()
        .all()
    )
    assert len(definitions) == 0


async def test_lemma_given_delete_expect_expression_aliases_cascaded(
    db: AsyncSession,
) -> None:
    lemma = await LemmaFactory.create(pos="expression")
    await LemmaAliasFactory.create(lemma=lemma, alias="ta opp")
    await LemmaAliasFactory.create(lemma=lemma, alias="ta ned", ordinal=1)

    lemma_id = lemma.id
    await db.delete(lemma)
    await db.flush()

    aliases = (
        await db.scalars(select(LemmaAlias).where(LemmaAlias.lemma_id == lemma_id))
    ).all()
    assert aliases == []


async def test_lemma_given_fresh_load_delete_expect_aliases_cascaded(
    db: AsyncSession,
) -> None:
    lemma = await LemmaFactory.create(pos="expression")
    await LemmaAliasFactory.create(lemma=lemma, alias="fresh delete")
    await db.flush()

    lemma_id = lemma.id
    db.expire_all()
    loaded = await db.scalar(select(Lemma).where(Lemma.id == lemma_id))
    assert loaded is not None
    await db.delete(loaded)
    await db.flush()

    assert (
        await db.scalar(select(LemmaAlias.id).where(LemmaAlias.lemma_id == lemma_id))
        is None
    )


def test_expression_alias_indexes_and_constraint_given_model_metadata_expect_declared() -> (
    None
):
    index_names = {idx.name for idx in LemmaAlias.__table__.indexes}
    assert index_names == {
        "ix_lexicon_lemma_aliases_lemma_id",
        "ix_lexicon_lemma_aliases_normalized_exact",
        "ix_lexicon_lemma_aliases_normalized_pattern",
    }
    constraint_names = {
        constraint.name for constraint in LemmaAlias.__table__.constraints
    }
    assert "uq_lexicon_lemma_alias_lemma_normalized" in constraint_names


async def test_definition_translation_column_given_valid_creation_expect_saved(
    db: AsyncSession,
) -> None:
    definition = await DefinitionFactory.create(
        definition="Test definition",
        translation="Primary translation",
        translation_source="machine",
    )

    assert definition.id is not None
    assert definition.translation == "Primary translation"
    assert definition.translation_source == "machine"


async def test_definition_translation_column_given_defaults_expect_none_source(
    db: AsyncSession,
) -> None:
    definition = await DefinitionFactory.create(
        definition="Test",
        translation="Test trans",
    )

    assert definition.translation_source is None


def test_word_form_lower_expression_index_given_model_metadata_expect_declared() -> (
    None
):
    """Regression: the model must declare a ``lower(form)`` expression index to
    support case-insensitive lookups without a seq scan."""
    index_names = {idx.name for idx in WordForm.__table__.indexes}
    assert "ix_lexicon_word_forms_form_lower" in index_names
    lower_index = next(
        idx
        for idx in WordForm.__table__.indexes
        if idx.name == "ix_lexicon_word_forms_form_lower"
    )
    assert len(lower_index.expressions) == 1


@pytest.mark.anyio
async def test_word_form_case_insensitive_lookup_given_different_stored_case_expect_match(
    db: AsyncSession,
) -> None:
    """Regression: ``func.lower(WordForm.form)`` matching must return a row
    regardless of stored casing, preserving the annotation/search contract."""
    lemma = await LemmaFactory.create()
    await WordFormFactory.create(lemma=lemma, form="Katt")

    result = (
        await db.scalars(select(WordForm).where(func.lower(WordForm.form) == "katt"))
    ).all()

    assert len(result) == 1
    assert result[0].form == "Katt"
