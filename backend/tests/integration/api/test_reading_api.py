from datetime import datetime
from http import HTTPStatus

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.flashcards.models import UserCard
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import UserStory
from flyt.apps.users.models import UserLemma
from flyt.core.config import settings
from tests.factories import CardPoolFactory
from tests.factories import DefinitionFactory
from tests.factories import FlashCardFactory
from tests.factories import LemmaFactory
from tests.factories import ReadingGroupFactory
from tests.factories import StoryFactory
from tests.factories import StoryPageFactory
from tests.factories import UserCardFactory
from tests.factories import UserFactory
from tests.factories import UserLemmaFactory
from tests.factories import UserStoryFactory
from tests.helpers.auth import authenticate

pytestmark = pytest.mark.anyio

K_EXPECTED_STORY_COUNT = 2
K_EXPECTED_READ_STORY_WORD_COUNT = 6
K_EXPECTED_UNREAD_STORY_WORD_COUNT = 8
K_EXPECTED_PAGE_STORY_COUNT = 3
K_HOME_SECTION_STORY_LIMIT = 6
K_HOME_SECTION_SEED_STORY_COUNT = 8
K_NONPUBLIC_SECTION_STORY_COUNT = 2


async def test_get_groups_returns_counts(client: AsyncClient) -> None:
    group = await ReadingGroupFactory.create(key="daily_life", title="Daily Life")
    s1 = await StoryFactory.create(reading_group=group)
    s2 = await StoryFactory.create(reading_group=group)
    await StoryPageFactory.create(story=s1, index=0)
    await StoryPageFactory.create(story=s2, index=0)

    response = await client.get("/reading/groups")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["groups"][0]["key"] == "daily_life"
    assert body["groups"][0]["storyCount"] == K_EXPECTED_STORY_COUNT


async def test_get_stories_returns_read_state(client: AsyncClient) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="travel", title="Travel")
    read_story = await StoryFactory.create(
        reading_group=group,
        title="Read story",
        content="Read stories keep their progress data.",
    )
    unread_story = await StoryFactory.create(
        reading_group=group,
        title="Unread story",
        content="Unread stories still show their total word count.",
    )
    await StoryPageFactory.create(story=read_story, index=0)
    await StoryPageFactory.create(story=unread_story, index=0)
    await authenticate(client, user)
    await client.post(
        f"/reading/stories/{read_story.uuid}/progress", json={"pageIndex": 0}
    )

    response = await client.get("/reading/stories", params={"group_key": group.key})

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    stories_by_title = {story["title"]: story for story in body["stories"]}
    assert stories_by_title["Read story"]["isRead"] is True
    assert stories_by_title["Unread story"]["isRead"] is False
    assert (
        stories_by_title["Read story"]["wordCount"] == K_EXPECTED_READ_STORY_WORD_COUNT
    )
    assert (
        stories_by_title["Unread story"]["wordCount"]
        == K_EXPECTED_UNREAD_STORY_WORD_COUNT
    )
    assert body["group"]["key"] == "travel"
    assert body["group"]["title"] == "Travel"
    assert body["nextCursor"] is None
    assert body["totalCount"] == K_EXPECTED_STORY_COUNT
    assert body["levelCounts"] == {"A1": K_EXPECTED_STORY_COUNT}


async def test_get_stories_paginates_with_cursor(client: AsyncClient) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="news", title="News")
    s1 = await StoryFactory.create(
        reading_group=group,
        title="Newest",
        created_at=datetime(2026, 4, 11, 10, 0, 0),
    )
    s2 = await StoryFactory.create(
        reading_group=group,
        title="Middle",
        created_at=datetime(2026, 4, 10, 10, 0, 0),
    )
    s3 = await StoryFactory.create(
        reading_group=group,
        title="Oldest",
        created_at=datetime(2026, 4, 9, 10, 0, 0),
    )
    await StoryPageFactory.create(story=s1, index=0)
    await StoryPageFactory.create(story=s2, index=0)
    await StoryPageFactory.create(story=s3, index=0)
    await authenticate(client, user)

    first_response = await client.get(
        "/reading/stories",
        params={"group_key": group.key, "limit": 2},
    )

    assert first_response.status_code == HTTPStatus.OK
    first_body = first_response.json()
    assert first_body["group"]["key"] == "news"
    assert [story["title"] for story in first_body["stories"]] == ["Newest", "Middle"]
    assert first_body["totalCount"] == K_EXPECTED_PAGE_STORY_COUNT
    assert first_body["nextCursor"] is not None
    assert "|" in first_body["nextCursor"]
    assert "+00:00" not in first_body["nextCursor"]

    second_response = await client.get(
        "/reading/stories",
        params={
            "group_key": group.key,
            "limit": 2,
            "cursor": first_body["nextCursor"],
        },
    )

    assert second_response.status_code == HTTPStatus.OK
    second_body = second_response.json()
    assert [story["title"] for story in second_body["stories"]] == ["Oldest"]
    assert second_body["nextCursor"] is None
    assert second_body["totalCount"] == K_EXPECTED_PAGE_STORY_COUNT
    assert second_body["levelCounts"] == {"A1": K_EXPECTED_PAGE_STORY_COUNT}


async def test_get_stories_filters_server_side(client: AsyncClient) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="daily_life", title="Daily Life")
    unread_story = await StoryFactory.create(
        reading_group=group,
        title="Unread A1",
        cefr_level="A1",
        created_at=datetime(2026, 4, 11, 10, 0, 0),
    )
    read_story = await StoryFactory.create(
        reading_group=group,
        title="Read A2",
        cefr_level="A2",
        created_at=datetime(2026, 4, 10, 10, 0, 0),
    )
    await StoryPageFactory.create(story=unread_story, index=0)
    await StoryPageFactory.create(story=read_story, index=0)
    await authenticate(client, user)
    await client.post(
        f"/reading/stories/{read_story.uuid}/progress", json={"pageIndex": 0}
    )

    default_response = await client.get(
        "/reading/stories",
        params={"group_key": group.key, "show_read": False},
    )

    assert default_response.status_code == HTTPStatus.OK
    assert [story["title"] for story in default_response.json()["stories"]] == [
        unread_story.title
    ]

    filtered_response = await client.get(
        "/reading/stories",
        params={
            "group_key": group.key,
            "levels": "A2",
            "show_read": True,
        },
    )

    assert filtered_response.status_code == HTTPStatus.OK
    body = filtered_response.json()
    assert [story["title"] for story in body["stories"]] == [read_story.title]
    assert body["levelCounts"] == {"A1": 1, "A2": 1}

    multiple_levels_response = await client.get(
        "/reading/stories",
        params={
            "group_key": group.key,
            "levels": "A1,A2",
            "show_read": True,
        },
    )

    assert multiple_levels_response.status_code == HTTPStatus.OK
    assert [story["title"] for story in multiple_levels_response.json()["stories"]] == [
        unread_story.title,
        read_story.title,
    ]

    empty_levels_response = await client.get(
        "/reading/stories",
        params={
            "group_key": group.key,
            "levels": "",
            "show_read": True,
        },
    )

    assert empty_levels_response.status_code == HTTPStatus.OK
    assert [story["title"] for story in empty_levels_response.json()["stories"]] == [
        unread_story.title,
        read_story.title,
    ]


async def test_get_stories_accepts_naive_cursor(client: AsyncClient) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="history", title="History")
    newest_story = await StoryFactory.create(
        reading_group=group,
        title="Newest",
        created_at=datetime(2026, 4, 11, 10, 0, 0),
    )
    older_story = await StoryFactory.create(
        reading_group=group,
        title="Older",
        created_at=datetime(2026, 4, 10, 10, 0, 0),
    )
    await StoryPageFactory.create(story=newest_story, index=0)
    await StoryPageFactory.create(story=older_story, index=0)
    await authenticate(client, user)

    response = await client.get(
        "/reading/stories",
        params={
            "group_key": group.key,
            "cursor": f"{newest_story.created_at.isoformat()}|{newest_story.id}",
        },
    )

    assert response.status_code == HTTPStatus.OK
    assert [story["title"] for story in response.json()["stories"]] == [
        older_story.title
    ]


async def test_get_story_recommendations_prioritizes_unread_same_theme(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    current_group = await ReadingGroupFactory.create(
        key="daily_life",
        title="Daily Life",
    )
    other_group = await ReadingGroupFactory.create(
        key="food_dining",
        title="Food & Dining",
    )
    current_story = await StoryFactory.create(
        reading_group=current_group,
        title="Morning Coffee",
        cefr_level="A1",
        created_at=datetime(2026, 4, 11, 10, 0, 0),
        content="Morning coffee starts a calm day in Oslo.",
    )
    same_group_unread = await StoryFactory.create(
        reading_group=current_group,
        title="After Work",
        cefr_level="B1",
        created_at=datetime(2026, 4, 10, 10, 0, 0),
        content="Two friends talk after work about dinner plans.",
    )
    same_group_read = await StoryFactory.create(
        reading_group=current_group,
        title="Rainy Saturday",
        cefr_level="A2",
        created_at=datetime(2026, 4, 12, 10, 0, 0),
        content="A rainy Saturday brings books, soup, and music.",
    )
    other_group_same_level = await StoryFactory.create(
        reading_group=other_group,
        title="Lunch Menu",
        cefr_level="A1",
        created_at=datetime(2026, 4, 13, 10, 0, 0),
        content="A lunch menu helps a student order soup and bread.",
    )
    await StoryPageFactory.create(story=current_story, index=0)
    await StoryPageFactory.create(story=same_group_unread, index=0)
    await StoryPageFactory.create(story=same_group_read, index=0)
    await StoryPageFactory.create(story=other_group_same_level, index=0)
    await UserStoryFactory.create(user=user, story=same_group_read)
    await authenticate(client, user)

    response = await client.get(
        f"/reading/stories/{current_story.uuid}/recommendations",
    )

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert [story["title"] for story in body["stories"]] == [
        same_group_unread.title,
        other_group_same_level.title,
        same_group_read.title,
    ]
    assert body["stories"][2]["isRead"] is True


async def test_get_story_recommendations_returns_404_for_missing_story(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get(
        "/reading/stories/00000000-0000-0000-0000-000000000000/recommendations",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json()["detail"]["code"] == "NOT_FOUND"


async def test_get_story_returns_user_states_without_marking_read(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="food_dining", title="Food & Dining")
    learning_lemma = await LemmaFactory.create(word="gå")
    mastered_lemma = await LemmaFactory.create(word="være")
    await UserLemmaFactory.create(
        user=user,
        lemma=learning_lemma,
        is_mastered=False,
    )
    await UserLemmaFactory.create(
        user=user,
        lemma=mastered_lemma,
        is_mastered=True,
    )
    story = await StoryFactory.create(
        reading_group=group,
        content="Jeg går hjem og er glad.",
    )
    await StoryPageFactory.create(
        story=story,
        index=0,
        content="Jeg går hjem og er glad.",
        text_annotations_json=[
            {"word": "Jeg", "start": 0, "end": 3, "lemmaUuid": None},
            {
                "word": "går",
                "start": 4,
                "end": 7,
                "lemmaUuid": str(learning_lemma.uuid),
            },
            {"word": " ", "start": 7, "end": 8, "lemmaUuid": None},
            {
                "word": "er",
                "start": 16,
                "end": 18,
                "lemmaUuid": str(mastered_lemma.uuid),
            },
        ],
    )
    await authenticate(client, user)

    response = await client.get(f"/reading/stories/{story.uuid}")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["userStates"][str(learning_lemma.uuid)] == "learning"
    assert body["userStates"][str(mastered_lemma.uuid)] == "mastered"

    user_story = await db.scalar(
        select(UserStory).where(
            UserStory.user_id == user.id,
            UserStory.story_id == story.id,
        )
    )
    assert user_story is None


async def test_save_progress_creates_user_story(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    story = await StoryFactory.create()
    await StoryPageFactory.create(story=story, index=0)
    await authenticate(client, user)

    response = await client.post(
        f"/reading/stories/{story.uuid}/progress", json={"pageIndex": 0}
    )

    assert response.status_code == HTTPStatus.OK
    user_story = await db.scalar(
        select(UserStory).where(
            UserStory.user_id == user.id,
            UserStory.story_id == story.id,
        )
    )
    assert user_story is not None


async def test_get_lemma_definitions_returns_lemma_state(client: AsyncClient) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create(word="gå")
    await DefinitionFactory.create(lemma=lemma, definition="walk", translation="walk")
    await DefinitionFactory.create(
        lemma=lemma, definition="function", translation="to function"
    )
    await DefinitionFactory.create(
        lemma=lemma,
        definition="stride",
        translation="stride",
    )
    await UserLemmaFactory.create(
        user=user,
        lemma=lemma,
        is_mastered=False,
    )
    await authenticate(client, user)

    response = await client.get(f"/lexicons/lemmas/{lemma.uuid}/definitions")

    assert response.status_code == HTTPStatus.OK
    for definition in response.json()["definitions"]:
        assert definition["userState"] == "learning"


async def test_get_lemma_definitions_given_anonymous_expect_public_with_new_state(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="gå")
    await DefinitionFactory.create(lemma=lemma, definition="walk", translation="walk")

    response = await client.get(f"/lexicons/lemmas/{lemma.uuid}/definitions")

    assert response.status_code == HTTPStatus.OK
    definitions = response.json()["definitions"]
    assert len(definitions) == 1
    for definition in definitions:
        assert definition["userState"] == "new"


async def test_get_lemma_definitions_given_invalid_cookie_expect_public_not_401(
    client: AsyncClient,
) -> None:
    lemma = await LemmaFactory.create(word="gå")
    await DefinitionFactory.create(lemma=lemma, definition="walk", translation="walk")
    client.cookies.set(settings.ACCESS_COOKIE_NAME, "not-a-real-token")

    response = await client.get(f"/lexicons/lemmas/{lemma.uuid}/definitions")

    assert response.status_code == HTTPStatus.OK
    for definition in response.json()["definitions"]:
        assert definition["userState"] == "new"


async def test_add_to_deck_creates_user_card_and_user_lemma(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="vocab-pool")
    await FlashCardFactory.create(pool=pool, is_addable=True)
    await authenticate(client, user)

    response = await client.post(f"/me/cards/lemmas/{lemma.uuid}/add-to-deck")

    assert response.status_code == HTTPStatus.OK
    user_card = await db.scalar(
        select(UserCard).where(UserCard.user_id == user.id, UserCard.pool_id == pool.id)
    )
    assert user_card is not None


async def test_mark_known_given_already_in_deck_expect_mastered(
    client: AsyncClient,
    db: AsyncSession,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="vocab-known")
    await UserCardFactory.create(user=user, pool=pool)
    await authenticate(client, user)

    response = await client.post(f"/lexicons/lemmas/{lemma.uuid}/mark-known")

    assert response.status_code == HTTPStatus.OK
    user_lemma = await db.scalar(
        select(UserLemma).where(
            UserLemma.user_id == user.id,
            UserLemma.lemma_id == lemma.id,
        )
    )
    assert user_lemma is not None
    assert user_lemma.is_mastered is True


async def test_get_home_returns_hero_and_sections(client: AsyncClient) -> None:
    user = await UserFactory.create()
    daily_life = await ReadingGroupFactory.create(
        key="daily_life",
        title="Daily Life",
        order=1,
    )
    food_dining = await ReadingGroupFactory.create(
        key="food_dining",
        title="Food & Dining",
        order=2,
    )
    latest = await StoryFactory.create(
        reading_group=daily_life,
        title="Latest",
        cefr_level="A1",
        created_at=datetime(2026, 4, 11, 10, 0, 0),
    )
    bakery = await StoryFactory.create(
        reading_group=food_dining,
        title="Bakery",
        cefr_level="A2",
        created_at=datetime(2026, 4, 10, 10, 0, 0),
    )
    await StoryPageFactory.create(story=latest, index=0)
    await StoryPageFactory.create(story=bakery, index=0)
    await authenticate(client, user)

    response = await client.get("/reading/home")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["todaysStory"]["uuid"] == str(latest.uuid)
    assert [section["group"]["key"] for section in body["sections"]] == [
        "daily_life",
        "food_dining",
    ]
    assert body["sections"][0]["stories"][0]["title"] == "Latest"


async def test_reading_home_given_groups_with_stories_expect_sections_in_group_order_with_top_stories(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    groups = [
        await ReadingGroupFactory.create(key="home_first", title="First", order=1),
        await ReadingGroupFactory.create(key="home_second", title="Second", order=2),
    ]
    stories_by_group_key: dict[str, list[Story]] = {}
    for group in groups:
        seeded = []
        for offset in range(K_HOME_SECTION_SEED_STORY_COUNT):
            story = await StoryFactory.create(
                reading_group=group,
                title=f"{group.key} story {offset}",
                content=f"{group.key} innhold {offset}",
                created_at=datetime(2026, 4, 1 + offset, 10, 0),
            )
            await StoryPageFactory.create(story=story, index=0)
            seeded.append(story)
        stories_by_group_key[group.key] = seeded
    await authenticate(client, user)

    response = await client.get("/reading/home")

    assert response.status_code == HTTPStatus.OK
    expected_sections = [
        {
            "group": {
                "id": group.id,
                "key": group.key,
                "title": group.title,
                "order": group.order,
                "storyCount": K_HOME_SECTION_SEED_STORY_COUNT,
            },
            "stories": [
                _expected_home_story(story)
                for story in stories_by_group_key[group.key][
                    -K_HOME_SECTION_STORY_LIMIT:
                ][::-1]
            ],
        }
        for group in groups
    ]
    assert response.json()["sections"] == expected_sections


async def test_reading_home_given_read_and_completed_stories_expect_user_state_flags(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    other_user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="home_flags", title="Flags", order=1)
    read_story = await StoryFactory.create(
        reading_group=group,
        title="Read story",
        content="Lest historie.",
        created_at=datetime(2026, 4, 2, 10, 0),
    )
    unread_story = await StoryFactory.create(
        reading_group=group,
        title="Unread story",
        content="Ulest historie.",
        created_at=datetime(2026, 4, 1, 10, 0),
    )
    await StoryPageFactory.create(story=read_story, index=0)
    await StoryPageFactory.create(story=unread_story, index=0)
    await UserStoryFactory.create(
        user=user, story=read_story, last_page_index=1, completed=True
    )
    await authenticate(client, user)

    response = await client.get("/reading/home")

    assert response.status_code == HTTPStatus.OK
    stories_by_title = {
        story["title"]: story
        for section in response.json()["sections"]
        for story in section["stories"]
    }
    assert stories_by_title["Read story"]["isRead"] is True
    assert stories_by_title["Read story"]["completed"] is True
    assert stories_by_title["Unread story"]["isRead"] is False
    assert stories_by_title["Unread story"]["completed"] is False

    await authenticate(client, other_user)
    other_response = await client.get("/reading/home")
    other_stories_by_title = {
        story["title"]: story
        for section in other_response.json()["sections"]
        for story in section["stories"]
    }
    assert other_stories_by_title["Read story"]["isRead"] is False
    assert other_stories_by_title["Read story"]["completed"] is False


async def test_reading_home_given_empty_group_expect_empty_section_present(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    filled = await ReadingGroupFactory.create(
        key="home_filled", title="Filled", order=1
    )
    filled_story = await StoryFactory.create(
        reading_group=filled,
        title="Filled story",
        content="Historie.",
        created_at=datetime(2026, 4, 1, 10, 0),
    )
    await StoryPageFactory.create(story=filled_story, index=0)
    await ReadingGroupFactory.create(key="home_empty", title="Empty", order=2)
    await authenticate(client, user)

    response = await client.get("/reading/home")

    assert response.status_code == HTTPStatus.OK
    sections_by_key = {
        section["group"]["key"]: section for section in response.json()["sections"]
    }
    assert set(sections_by_key) == {"home_filled", "home_empty"}
    assert [story["title"] for story in sections_by_key["home_filled"]["stories"]] == [
        "Filled story"
    ]
    assert sections_by_key["home_empty"]["stories"] == []


async def test_reading_home_given_nonpublic_story_expect_excluded(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="home_hidden", title="Hidden", order=1)
    oldest_public = await StoryFactory.create(
        reading_group=group,
        title="Oldest public",
        content="Eldst.",
        created_at=datetime(2026, 4, 1, 10, 0),
    )
    newest_public = await StoryFactory.create(
        reading_group=group,
        title="Newest public",
        content="Nyest.",
        created_at=datetime(2026, 4, 2, 10, 0),
    )
    private_newest = await StoryFactory.create(
        reading_group=group,
        title="Private newest",
        visibility=StoryVisibility.PRIVATE,
        content="Skjult.",
        created_at=datetime(2026, 4, 3, 10, 0),
    )
    for story in (oldest_public, newest_public, private_newest):
        await StoryPageFactory.create(story=story, index=0)
    await authenticate(client, user)

    response = await client.get("/reading/home")

    assert response.status_code == HTTPStatus.OK
    section = next(
        section
        for section in response.json()["sections"]
        if section["group"]["key"] == "home_hidden"
    )
    assert [story["title"] for story in section["stories"]] == [
        "Newest public",
        "Oldest public",
    ]
    assert section["group"]["storyCount"] == K_NONPUBLIC_SECTION_STORY_COUNT


async def test_add_to_deck_is_idempotent_when_already_in_deck(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    lemma = await LemmaFactory.create()
    pool = await CardPoolFactory.create(lemma=lemma, key="vocab-conflict")
    await UserCardFactory.create(user=user, pool=pool)
    await authenticate(client, user)

    response = await client.post(f"/me/cards/lemmas/{lemma.uuid}/add-to-deck")

    assert response.status_code == HTTPStatus.OK


async def test_get_hero_returns_latest_daily_life_story(client: AsyncClient) -> None:
    group = await ReadingGroupFactory.create(key="daily_life", title="Daily Life")
    older = await StoryFactory.create(
        reading_group=group,
        title="Older",
        created_at=datetime(2026, 4, 10, 10, 0, 0),
    )
    latest = await StoryFactory.create(
        reading_group=group,
        title="Latest",
        created_at=datetime(2026, 4, 11, 10, 0, 0),
    )
    await StoryPageFactory.create(story=older, index=0)
    await StoryPageFactory.create(story=latest, index=0)

    response = await client.get("/reading/hero")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["todaysStory"]["uuid"] == str(latest.uuid)
    assert response.json()["todaysStory"]["title"] == "Latest"
    assert response.json()["todaysStory"]["groupTitle"] == "Daily Life"
    assert response.json()["todaysStory"]["cefrLevel"] == latest.cefr_level


async def test_get_stories_given_missing_group_key_expect_404(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get(
        "/reading/stories",
        params={"group_key": "nonexistent"},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json()["detail"]["code"] == "NOT_FOUND"


async def test_get_stories_given_invalid_cursor_format_expect_400(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    group = await ReadingGroupFactory.create(key="bad_cursor", title="Bad Cursor")
    await StoryFactory.create(reading_group=group)
    await StoryPageFactory.create(
        story=await StoryFactory.create(reading_group=group), index=0
    )
    await authenticate(client, user)

    response = await client.get(
        "/reading/stories",
        params={"group_key": group.key, "cursor": "not-a-valid-cursor"},
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
    assert response.json()["detail"]["code"] == "INVALID_CURSOR"


async def test_get_stories_given_empty_group_key_expect_422(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get(
        "/reading/stories",
        params={"group_key": ""},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


async def test_save_progress_given_missing_story_uuid_expect_404(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.post(
        "/reading/stories/00000000-0000-0000-0000-000000000000/progress",
        json={"pageIndex": 0},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json()["detail"]["code"] == "NOT_FOUND"


async def test_get_story_detail_given_missing_story_uuid_expect_404(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await authenticate(client, user)

    response = await client.get(
        "/reading/stories/00000000-0000-0000-0000-000000000000",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert response.json()["detail"]["code"] == "NOT_FOUND"


async def test_get_stories_given_unauthenticated_expect_401(
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/reading/stories",
        params={"group_key": "daily_life"},
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


async def test_get_hero_given_no_stories_expect_null_hero(
    client: AsyncClient,
) -> None:
    response = await client.get("/reading/hero")

    assert response.status_code == HTTPStatus.OK
    assert response.json()["todaysStory"] is None


async def test_get_home_given_no_stories_expect_empty_sections(
    client: AsyncClient,
) -> None:
    user = await UserFactory.create()
    await ReadingGroupFactory.create(key="empty_group", title="Empty")
    await authenticate(client, user)

    response = await client.get("/reading/home")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body["todaysStory"] is None
    assert len(body["sections"]) >= 1
    for section in body["sections"]:
        # daily_life may not exist; empty_group definitely has no stories.
        if section["group"]["key"] == "empty_group":
            assert section["stories"] == []


async def test_get_groups_given_empty_db_expect_groups_returned(
    client: AsyncClient,
) -> None:
    # The groups endpoint should always return 200 even when no stories exist.
    await ReadingGroupFactory.create(key="test_group", title="Test Group")

    response = await client.get("/reading/groups")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    group_keys = [g["key"] for g in body["groups"]]
    assert "test_group" in group_keys
    test_group = next(g for g in body["groups"] if g["key"] == "test_group")
    assert test_group["storyCount"] == 0


def _expected_home_story(story: Story) -> dict[str, object]:
    # Seeded content stays under the 18-word preview limit, so preview == content.
    return {
        "uuid": str(story.uuid),
        "title": story.title,
        "cefrLevel": story.cefr_level,
        "createdAt": story.created_at.isoformat(),
        "preview": story.content,
        "wordCount": len((story.content or "").split()),
        "isRead": False,
        "completed": False,
    }
