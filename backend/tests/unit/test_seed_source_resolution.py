import json
from pathlib import Path

import pytest

import scripts.import_lexicon as import_lexicon_module
from scripts.import_lexicon import ImportFailure
from scripts.import_lexicon import ImportSummary
from scripts.import_lexicon import format_import_failure_message

EXISTING_SOURCE_ARTICLE_ID = 2
EXPECTED_IMPORTED_LEMMA_COUNT = 2
EXPECTED_UPDATED_LEMMA_COUNT = 2


def test_format_import_failure_message_given_failures_expect_file_details() -> None:
    summary = ImportSummary(
        failed_articles=2,
        failures=(
            ImportFailure(file_name="64997.json", error="IntegrityError: duplicate"),
            ImportFailure(file_name="110797.json", error="ValueError: bad payload"),
        ),
    )

    assert format_import_failure_message(summary) == (
        "Import completed with 2 failure(s):\n"
        "- 64997.json: IntegrityError: duplicate\n"
        "- 110797.json: ValueError: bad payload"
    )


class _FakeDb:
    def __init__(self) -> None:
        self.rollback_calls = 0
        self.commit_calls = 0

    async def rollback(self) -> None:
        self.rollback_calls += 1

    async def commit(self) -> None:
        self.commit_calls += 1


@pytest.mark.anyio
async def test_import_lexicon_given_mixed_results_expect_summary_and_continue(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    articles = [
        ("1.json", {"source_article_id": 1}),
        ("2.json", {"source_article_id": 2}),
        ("3.json", {"source_article_id": 3}),
    ]
    for file_name, payload in articles:
        (tmp_path / file_name).write_text(json.dumps(payload), encoding="utf-8")

    async def _fake_get_article_lemmas(db: _FakeDb, article_id: int):
        if article_id == EXISTING_SOURCE_ARTICLE_ID:
            return [object()]
        return []

    async def _fake_import_article(db: _FakeDb, data: dict):
        article_id = data["source_article_id"]
        if article_id == 1:
            return [object(), object()]
        raise ValueError("boom")

    monkeypatch.setattr(
        import_lexicon_module, "get_article_lemmas", _fake_get_article_lemmas
    )
    monkeypatch.setattr(import_lexicon_module, "import_article", _fake_import_article)

    db = _FakeDb()
    summary = await import_lexicon_module.import_lexicon(db, tmp_path)
    output = capsys.readouterr().out

    assert summary.imported_articles == 1
    assert summary.updated_articles == 0
    assert summary.skipped_articles == 1
    assert summary.failed_articles == 1
    assert summary.imported_lemmas == EXPECTED_IMPORTED_LEMMA_COUNT
    assert summary.updated_lemmas == 0
    assert summary.skipped_lemmas == 1
    assert summary.failures == (
        ImportFailure(file_name="3.json", error="ValueError: boom"),
    )
    assert db.rollback_calls == 1
    assert "Imported 2 lemma(s)" in output
    assert "Skipped" in output
    assert "Error importing 3.json: ValueError: boom" in output


@pytest.mark.anyio
async def test_import_lexicon_given_force_updates_existing_articles(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    articles = [
        ("1.json", {"source_article_id": 1}),
        ("2.json", {"source_article_id": 2}),
    ]
    for file_name, payload in articles:
        (tmp_path / file_name).write_text(json.dumps(payload), encoding="utf-8")

    existing_lemma = object()

    async def _fake_get_article_lemmas(db: _FakeDb, article_id: int):
        if article_id == EXISTING_SOURCE_ARTICLE_ID:
            return [existing_lemma]
        return []

    async def _fake_import_article(db: _FakeDb, data: dict):
        return [object()]

    async def _fake_update_article(
        db: _FakeDb,
        data: dict,
        existing_lemmas: list,
    ):
        assert existing_lemmas == [existing_lemma]
        return [object(), object()]

    monkeypatch.setattr(
        import_lexicon_module, "get_article_lemmas", _fake_get_article_lemmas
    )
    monkeypatch.setattr(import_lexicon_module, "import_article", _fake_import_article)
    monkeypatch.setattr(import_lexicon_module, "update_article", _fake_update_article)

    db = _FakeDb()
    summary = await import_lexicon_module.import_lexicon(db, tmp_path, force=True)
    output = capsys.readouterr().out

    assert summary.imported_articles == 1
    assert summary.updated_articles == 1
    assert summary.skipped_articles == 0
    assert summary.imported_lemmas == 1
    assert summary.updated_lemmas == EXPECTED_UPDATED_LEMMA_COUNT
    assert "Imported 1 lemma(s)" in output
    assert "Updated 2 lemma(s)" in output
