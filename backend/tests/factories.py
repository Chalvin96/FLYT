from itertools import count
from typing import ClassVar
from uuid import uuid4

from faker import Faker
from polyfactory.factories.sqlalchemy_factory import SQLAlchemyFactory
from polyfactory.factories.sqlalchemy_factory import SQLAlchemyPersistenceMethod
from polyfactory.fields import Ignore
from polyfactory.fields import Use
from pydantic import SecretStr
from flyt.apps.chatgpt_link.models import ChatGPTLink
from flyt.apps.flashcards.models import CardState
from flyt.apps.flashcards.models import CardPool
from flyt.apps.flashcards.models import CardType
from flyt.apps.flashcards.models import Deck
from flyt.apps.flashcards.models import Enrollment
from flyt.apps.flashcards.models import FlashCard
from flyt.apps.flashcards.models import StatsReviewLog
from flyt.apps.flashcards.models import UserCard
from flyt.apps.reading.models import ImportMeta
from flyt.apps.reading.models import ImportStatus
from flyt.apps.story_generation.models import Generation
from flyt.apps.story_generation.models import GenerationOutcome
from flyt.apps.story_generation.models import ProviderRequest
from flyt.apps.story_generation.models import ProviderRequestOutcome
from flyt.apps.flashcards.schemas import DefinitionPayload
from flyt.apps.lessons.models import Lesson
from flyt.apps.lessons.models import LessonRelease
from flyt.apps.lessons.models import UserLessonProgress
from flyt.apps.lexicons.models import Definition
from flyt.apps.lexicons.models import Lemma
from flyt.apps.lexicons.models import LemmaPos
from flyt.apps.lexicons.models import SeeAlso
from flyt.apps.lexicons.models import WordForm
from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.users.models import AuthIdentity
from flyt.apps.users.models import User
from flyt.apps.users.models import UserLemma
from flyt.apps.users.models import UserSettings
from flyt.apps.users.types import UserRole
from flyt.libs.utils.date import now

fake = Faker()

_release_sequence = count(0)
_lesson_order = count(0)
_lesson_source_id_sequence = count(0)
_pool_key_sequence = count(0)
_reading_group_key_sequence = count(1)
_reading_group_order = count(1)


def _generate_definition_payload() -> dict:
    return DefinitionPayload(
        word=fake.word(),
        pos=LemmaPos.NOUN,
        primary_translation=fake.word(),
        definitions=[
            {
                "uuid": str(fake.uuid4()),
                "definition": fake.sentence(),
                "translation": fake.sentence(),
                "examples_json": [],
            }
        ],
    ).model_dump(mode="json")


def _generate_payload_for_type(card_type: CardType) -> dict:
    if card_type == CardType.DEFINITION:
        return _generate_definition_payload()
    raise ValueError(f"Unsupported card type for generated payload: {card_type}")


class AsyncSQLAlchemyFactory(SQLAlchemyFactory):
    __is_base_factory__ = True
    __async_session__ = None
    __persistence_method__ = SQLAlchemyPersistenceMethod.FLUSH
    __set_primary_key__ = False
    __set_foreign_keys__ = False

    @classmethod
    async def create(cls, **kwargs):
        return await cls.create_async(**kwargs)


class UserFactory(AsyncSQLAlchemyFactory):
    __model__ = User
    __set_as_default_factory_for_type__ = True

    uuid = Use(uuid4)
    email = Use(fake.email)
    display_name = Use(fake.name)
    avatar_url = None
    role = UserRole.USER
    is_active = True


class AuthIdentityFactory(AsyncSQLAlchemyFactory):
    __model__ = AuthIdentity
    __set_as_default_factory_for_type__ = True

    provider = "google"
    provider_subject = Use(lambda: fake.unique.random_int(min=1, max=999999999))
    email_at_link = Use(fake.email)

    @classmethod
    async def create_async(cls, **kwargs):
        user = kwargs.pop("user", None)

        if "user_id" not in kwargs:
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id

        return await super().create_async(**kwargs)


class LemmaFactory(AsyncSQLAlchemyFactory):
    __model__ = Lemma
    __set_as_default_factory_for_type__ = True

    source_article_id = None
    word = Use(fake.word)
    pos = LemmaPos.NOUN
    hgno = Use(lambda: fake.random_int(min=1, max=100))
    is_sub_article = False
    primary_translation = Use(fake.word)
    frequency_rank = None
    frequency_ambiguous = False
    definitions = Ignore()
    word_forms = Ignore()
    see_also = Ignore()


class DefinitionFactory(AsyncSQLAlchemyFactory):
    __model__ = Definition
    __set_as_default_factory_for_type__ = True

    definition = Use(fake.sentence)
    translation = Use(fake.sentence)
    translation_source = None
    examples_json: ClassVar[list] = []
    lemma = Ignore()

    @classmethod
    async def create_async(cls, **kwargs):
        lemma = kwargs.pop("lemma", None)

        if lemma is None and "lemma_id" not in kwargs:
            lemma = await LemmaFactory.create()

        if lemma is not None:
            kwargs["lemma"] = lemma
            kwargs.pop("lemma_id", None)

        return await super().create_async(**kwargs)


class WordFormFactory(AsyncSQLAlchemyFactory):
    __model__ = WordForm
    __set_as_default_factory_for_type__ = True

    lemma = Ignore()
    form = Use(fake.word)
    tags_json: ClassVar[list] = []

    @classmethod
    async def create_async(cls, **kwargs):
        lemma = kwargs.pop("lemma", None)

        if lemma is None and "lemma_id" not in kwargs:
            lemma = await LemmaFactory.create()

        if lemma is not None:
            kwargs["lemma"] = lemma
            kwargs.pop("lemma_id", None)

        return await super().create_async(**kwargs)


class SeeAlsoFactory(AsyncSQLAlchemyFactory):
    __model__ = SeeAlso
    __set_as_default_factory_for_type__ = True

    lemma = Ignore()
    target_article_id = Use(lambda: fake.random_int(min=1, max=999999))
    target_word = Use(fake.word)
    relation = "see"
    ordinal = 0

    @classmethod
    async def create_async(cls, **kwargs):
        lemma = kwargs.pop("lemma", None)

        if lemma is None and "lemma_id" not in kwargs:
            lemma = await LemmaFactory.create()

        if lemma is not None:
            kwargs["lemma"] = lemma
            kwargs.pop("lemma_id", None)

        return await super().create_async(**kwargs)


class UserLemmaFactory(AsyncSQLAlchemyFactory):
    __model__ = UserLemma
    __set_as_default_factory_for_type__ = True

    @classmethod
    async def create_async(cls, **kwargs):
        user = kwargs.pop("user", None)
        lemma = kwargs.pop("lemma", None)

        if "user_id" not in kwargs:
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id

        if "lemma_id" not in kwargs:
            if lemma is None:
                lemma = await LemmaFactory.create()
            kwargs["lemma_id"] = lemma.id

        return await super().create_async(**kwargs)


class DeckFactory(AsyncSQLAlchemyFactory):
    __model__ = Deck
    __set_as_default_factory_for_type__ = True

    name = Use(lambda: fake.sentence()[:20])
    description = Use(fake.sentence)
    source = None
    license = None
    cefr_range = None
    cards = Ignore()


class FlashCardFactory(AsyncSQLAlchemyFactory):
    __model__ = FlashCard
    __set_as_default_factory_for_type__ = True

    type = CardType.DEFINITION
    is_addable = True
    payload_json: ClassVar[dict] = {}
    deck = Ignore()
    pool = Ignore()

    @classmethod
    async def create_async(cls, **kwargs):
        raw_type = kwargs.get("type", CardType.DEFINITION)
        card_type = raw_type if isinstance(raw_type, CardType) else CardType(raw_type)
        deck = kwargs.pop("deck", None)
        pool = kwargs.pop("pool", None)

        if "payload_json" not in kwargs:
            kwargs["payload_json"] = _generate_payload_for_type(card_type)

        if deck is not None:
            kwargs["deck_id"] = deck.id
        if pool is not None:
            kwargs["pool_id"] = pool.id

        return await super().create_async(**kwargs)


class CardPoolFactory(AsyncSQLAlchemyFactory):
    __model__ = CardPool
    __set_as_default_factory_for_type__ = True

    lesson = Ignore()
    lemma = Ignore()
    key = Use(lambda: f"pool-{next(_pool_key_sequence)}")
    description = Ignore()
    frequency_rank = None
    cards = Ignore()

    @classmethod
    async def create_async(cls, **kwargs):
        lesson = kwargs.pop("lesson", None)
        lemma = kwargs.pop("lemma", None)

        if lemma is not None:
            kwargs["lemma"] = lemma
            kwargs.pop("lemma_id", None)
            kwargs.setdefault("lesson_id", None)
        elif lesson is None and "lesson_id" not in kwargs:
            lesson = await LessonFactory.create()

        if lesson is not None:
            kwargs["lesson_id"] = lesson.id
            kwargs.setdefault("lemma_id", None)

        pool = await super().create_async(**kwargs)
        if lesson is not None and pool not in lesson.pools:
            lesson.pools.append(pool)
        return pool


class ReadingGroupFactory(AsyncSQLAlchemyFactory):
    __model__ = ReadingGroup
    __set_as_default_factory_for_type__ = True

    key = Use(lambda: f"reading-group-{next(_reading_group_key_sequence)}")
    title = Use(lambda: fake.sentence()[:30])
    order = Use(lambda: next(_reading_group_order))
    stories = Ignore()


class StoryFactory(AsyncSQLAlchemyFactory):
    __model__ = Story
    __set_as_default_factory_for_type__ = True

    reading_group = Ignore()
    title = Use(lambda: fake.sentence()[:30])
    content = Use(fake.paragraph)
    cefr_level = "A1"
    slug = Use(lambda: f"story-{uuid4().hex[:8]}")
    visibility = StoryVisibility.PUBLIC
    is_ready = True
    created_at = Use(now)
    user_stories = Ignore()
    pages = Ignore()

    @classmethod
    async def create_async(cls, **kwargs):
        reading_group = kwargs.pop("reading_group", None)

        if reading_group is None and "reading_group_id" not in kwargs:
            reading_group = await ReadingGroupFactory.create()

        if reading_group is not None:
            kwargs["reading_group_id"] = reading_group.id

        if "word_count" not in kwargs:
            content = kwargs.get("content")
            if content is None:
                story = await super().create_async(**kwargs)
                # A null content (e.g. an import-kind story before ingress populates
                # it) yields a zero word count.
                story.word_count = len((story.content or "").split())
                await cls.__async_session__.flush()
                if reading_group is not None and story not in reading_group.stories:
                    reading_group.stories.append(story)
                return story
            kwargs["word_count"] = len((content or "").split())

        story = await super().create_async(**kwargs)
        if reading_group is not None and story not in reading_group.stories:
            reading_group.stories.append(story)
        return story


class UserStoryFactory(AsyncSQLAlchemyFactory):
    __model__ = UserStory
    __set_as_default_factory_for_type__ = True

    user = Ignore()
    story = Ignore()
    uuid = Use(uuid4)
    title = None
    source_url = None
    last_page_index = 0
    completed = False

    @classmethod
    async def create_async(cls, **kwargs):
        user = kwargs.pop("user", None)
        story = kwargs.pop("story", None)

        if "user_id" not in kwargs:
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id

        if "story_id" not in kwargs:
            if story is None:
                story = await StoryFactory.create()
            kwargs["story_id"] = story.id

        user_story = await super().create_async(**kwargs)
        if story is not None and user_story not in story.user_stories:
            story.user_stories.append(user_story)
        return user_story


class StoryPageFactory(AsyncSQLAlchemyFactory):
    __model__ = StoryPage
    __set_as_default_factory_for_type__ = True

    index = 0
    content = "En katt."
    text_annotations_json = Use(list)
    word_count = 2

    story = Ignore()

    @classmethod
    async def create_async(cls, **kwargs):
        story = kwargs.pop("story", None)
        if "story_id" not in kwargs:
            if story is None:
                story = await StoryFactory.create()
            kwargs["story_id"] = story.id
        page = await super().create_async(**kwargs)
        if story is not None and page not in story.pages:
            story.pages.append(page)
        return page


class LessonReleaseFactory(AsyncSQLAlchemyFactory):
    __model__ = LessonRelease
    __set_as_default_factory_for_type__ = True

    source = Use(lambda: f"release-{next(_release_sequence)}")
    digest = Use(lambda: f"digest-{uuid4().hex}")
    schema_version = "4.0"
    language = "nb-NO"
    translation_language = "en"
    lesson_count = 0
    is_active = True
    lessons = Ignore()


def _minimal_packet(source_id: str, title: str) -> dict:
    return {
        "schema_version": "4.0",
        "id": source_id,
        "kind": "grammar",
        "language": "nb-NO",
        "title": title,
        "cefr_level": "A1",
        "goal": "Practice.",
        "objectives": [{"id": "obj-1", "statement": "Use the pattern."}],
        "content": [],
        "sections": [],
        "exercises": [],
        "practice_groups": [],
        "media": {"audio": []},
    }


class LessonFactory(AsyncSQLAlchemyFactory):
    __model__ = Lesson
    __set_as_default_factory_for_type__ = True

    release = Ignore()
    source_id = Use(lambda: f"lesson-{next(_lesson_source_id_sequence)}")
    release_order = Use(lambda: next(_lesson_order))
    kind = "grammar"
    family_id = None
    title = Use(lambda: fake.sentence()[:30])
    cefr_level = "A1"
    goal = "Practice."
    packet_json = None
    user_progress = Ignore()
    pools = Ignore()

    @classmethod
    async def create_async(cls, **kwargs):
        release = kwargs.pop("release", None)
        if "release_id" not in kwargs:
            if release is None:
                release = await LessonReleaseFactory.create()
            kwargs["release_id"] = release.id

        if "packet_json" not in kwargs:
            source_id = (
                kwargs.get("source_id") or f"lesson-{next(_lesson_source_id_sequence)}"
            )
            kwargs["packet_json"] = _minimal_packet(source_id, kwargs.get("title", ""))

        return await super().create_async(**kwargs)


class UserLessonProgressFactory(AsyncSQLAlchemyFactory):
    __model__ = UserLessonProgress
    __set_as_default_factory_for_type__ = True

    user = Ignore()
    lesson = Ignore()
    completed_exercise_ids_json: ClassVar[list] = []
    completed_at = None

    @classmethod
    async def create_async(cls, **kwargs):
        user = kwargs.pop("user", None)
        lesson = kwargs.pop("lesson", None)

        if "user_id" not in kwargs:
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id

        if "lesson_id" not in kwargs:
            if lesson is None:
                lesson = await LessonFactory.create()
            kwargs["lesson_id"] = lesson.id

        return await super().create_async(**kwargs)


class UserCardFactory(AsyncSQLAlchemyFactory):
    __model__ = UserCard
    __set_as_default_factory_for_type__ = True

    user = Ignore()
    pool = Ignore()
    last_shown_card = Ignore()
    active_card = Ignore()
    fsrs_stability = None
    fsrs_difficulty = None
    fsrs_step = None
    last_review_at = None
    introduced_at = None
    due_at = Use(now)
    state = CardState.NEW
    enrollment_state = Enrollment.ACTIVE

    @classmethod
    async def create_async(cls, **kwargs):
        user = kwargs.pop("user", None)
        pool = kwargs.pop("pool", None)
        last_shown_card = kwargs.pop("last_shown_card", None)
        active_card = kwargs.pop("active_card", None)

        if "user_id" not in kwargs:
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id

        if pool is None and "pool_id" not in kwargs:
            pool = await CardPoolFactory.create()

        if pool is not None:
            kwargs["pool_id"] = pool.id

        if last_shown_card is not None:
            kwargs["last_shown_card_id"] = last_shown_card.id
        if active_card is not None:
            kwargs["active_card_id"] = active_card.id

        return await super().create_async(**kwargs)


class StatsReviewLogFactory(AsyncSQLAlchemyFactory):
    __model__ = StatsReviewLog
    __set_as_default_factory_for_type__ = True

    user = Ignore()
    user_card = Ignore()
    rating = 3
    reviewed_at = Use(now)

    @classmethod
    async def create_async(cls, **kwargs):
        user_card = kwargs.pop("user_card", None)

        if user_card is None and "user_card_id" not in kwargs:
            user_card = await UserCardFactory.create()

        if user_card is not None:
            kwargs.setdefault("user_id", user_card.user_id)
            kwargs.setdefault("user_card_id", user_card.id)

        return await super().create_async(**kwargs)


class UserSettingsFactory(AsyncSQLAlchemyFactory):
    __model__ = UserSettings
    __set_as_default_factory_for_type__ = True

    user = Ignore()
    daily_new_limit = 20

    @classmethod
    async def create_async(cls, **kwargs):
        user = kwargs.pop("user", None)

        if "user_id" not in kwargs:
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id

        return await super().create_async(**kwargs)


class ChatGPTLinkFactory(AsyncSQLAlchemyFactory):
    __model__ = ChatGPTLink
    __set_as_default_factory_for_type__ = True

    user = Ignore()

    @classmethod
    def access_token(cls) -> SecretStr:
        return SecretStr(cls.__faker__.pystr())

    @classmethod
    def refresh_token(cls) -> SecretStr:
        return SecretStr(cls.__faker__.pystr())

    @classmethod
    async def create_async(cls, **kwargs):
        user = kwargs.pop("user", None)

        if "user_id" not in kwargs:
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id

        for field in ("access_token", "refresh_token"):
            if isinstance(kwargs.get(field), str):
                kwargs[field] = SecretStr(kwargs[field])

        return await super().create_async(**kwargs)


class ImportMetaFactory(AsyncSQLAlchemyFactory):
    __model__ = ImportMeta
    __set_as_default_factory_for_type__ = True

    content_hash = Use(lambda: uuid4().hex + uuid4().hex)
    status = ImportStatus.PENDING
    error_code = None
    error_message = None
    story = Ignore()

    @classmethod
    async def create_async(cls, **kwargs):
        """Create the sidecar that marks a Story as import-kind.

        Defaults to a private story with no curated columns. Real ingress also
        populates ``Story.content`` with the normalized source text; tests that
        exercise the worker set it explicitly (or leave it null to test the
        missing-content failure path).
        """
        story = kwargs.pop("story", None)

        if "story_id" not in kwargs:
            if story is None:
                # reading_group_id must be passed explicitly: StoryFactory
                # auto-creates a group when it is absent, and imports have none.
                story = await StoryFactory.create(
                    content=None,
                    cefr_level=None,
                    slug=None,
                    reading_group_id=None,
                    visibility=StoryVisibility.PRIVATE,
                    is_ready=False,
                )
            kwargs["story_id"] = story.id

        return await super().create_async(**kwargs)


class GenerationFactory(AsyncSQLAlchemyFactory):
    __model__ = Generation
    __set_as_default_factory_for_type__ = True

    provider_requests = Ignore()
    anchor = None
    requested_length = 250
    requested_targets = 3
    mastered_lemma_count = None
    in_progress_lemma_count = None
    unknown_lemma_count = None
    mastered_token_count = None
    in_progress_token_count = None
    unknown_token_count = None
    lexical_token_count = None
    target_occurrences = None
    unresolved_token_rate = None
    produced_length = None
    outcome = GenerationOutcome.PROCESSING
    failure_code = None
    failure_message = None

    @classmethod
    async def create_async(cls, **kwargs):
        if "user_id" not in kwargs:
            user = kwargs.pop("user", None)
            if user is None:
                user = await UserFactory.create()
            kwargs["user_id"] = user.id
        else:
            kwargs.pop("user", None)

        defaults: dict = {
            "anchor": None,
            "requested_length": 250,
            "requested_targets": 3,
            "mastered_lemma_count": None,
            "in_progress_lemma_count": None,
            "unknown_lemma_count": None,
            "mastered_token_count": None,
            "in_progress_token_count": None,
            "unknown_token_count": None,
            "lexical_token_count": None,
            "target_occurrences": None,
            "unresolved_token_rate": None,
            "produced_length": None,
            "outcome": GenerationOutcome.PROCESSING,
            "failure_code": None,
            "failure_message": None,
        }
        defaults.update(kwargs)
        gen = Generation(**defaults)
        cls.__async_session__.add(gen)
        await cls.__async_session__.flush()
        return gen


class ProviderRequestFactory(AsyncSQLAlchemyFactory):
    __model__ = ProviderRequest
    __set_as_default_factory_for_type__ = True

    provider = "openrouter"
    model = "deepseek-v4-flash"
    outcome = ProviderRequestOutcome.SUCCESS
    latency_ms = Use(lambda: fake.random_int(min=100, max=5000))
    prompt_tokens = Use(lambda: fake.random_int(min=50, max=500))
    completion_tokens = Use(lambda: fake.random_int(min=100, max=1000))
    failure_class = None
    upstream_identifier = None

    @classmethod
    async def create_async(cls, **kwargs):
        if "generation_id" not in kwargs:
            generation = kwargs.pop("generation", None)
            if generation is None:
                generation = await GenerationFactory.create()
            kwargs["generation_id"] = generation.id
        else:
            kwargs.pop("generation", None)

        defaults: dict = {
            "provider": "openrouter",
            "model": "deepseek-v4-flash",
            "outcome": ProviderRequestOutcome.SUCCESS,
            "latency_ms": fake.random_int(min=100, max=5000),
            "prompt_tokens": fake.random_int(min=50, max=500),
            "completion_tokens": fake.random_int(min=100, max=1000),
            "failure_class": None,
            "upstream_identifier": None,
        }
        defaults.update(kwargs)
        req = ProviderRequest(**defaults)
        cls.__async_session__.add(req)
        await cls.__async_session__.flush()
        return req
