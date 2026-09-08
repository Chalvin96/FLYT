from pathlib import Path
from types import ModuleType

from flyt.core import model_registry
from flyt.core.base import Base

APPS_DIR = Path(model_registry.__file__).resolve().parents[1] / "apps"

CLASSIFIED_TABLES = frozenset(
    {
        "user_users",
        "user_auth_identities",
        "user_user_lemmas",
        "user_lemma_contexts",
        "user_settings",
        "user_stories",
        "flashcard_user_cards",
        "stats_review_logs",
        "lesson_user_progress",
        "story_import_quota",
        "chatgpt_link",
        "chatbot_openrouter_credentials",
        "flyt_ai_usage",
        "flyt_ai_aggregate_usage",
        "reading_stories",
        "import_meta",
        "reading_story_pages",
        "reading_groups",
        "flashcard_decks",
        "flashcard_card_pools",
        "flashcard_cards",
        "lesson_releases",
        "lesson_lessons",
        "lexicon_lemmas",
        "lexicon_word_forms",
        "lexicon_definitions",
        "lexicon_lemma_see_also",
        "story_generation_generations",
        "story_generation_provider_requests",
    }
)


def test_ownership_inventory_given_mapped_tables_expect_every_table_classified() -> (
    None
):
    unclassified = set(Base.metadata.tables) - CLASSIFIED_TABLES
    assert unclassified == set()


def test_ownership_inventory_given_mapping_expect_no_table_that_no_longer_exists() -> (
    None
):
    stale = CLASSIFIED_TABLES - set(Base.metadata.tables)
    assert stale == set()


def test_model_registry_given_app_model_modules_expect_all_imported() -> None:
    on_disk = {path.parent.name for path in APPS_DIR.glob("*/models.py")}
    registered = {
        value.__name__.split(".")[-2]
        for value in vars(model_registry).values()
        if isinstance(value, ModuleType) and value.__name__.endswith(".models")
    }
    assert on_disk - registered == set()
