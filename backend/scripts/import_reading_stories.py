from pathlib import Path
import argparse
import asyncio
import json

import anyio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from flyt.apps.reading.models import ReadingGroup
from flyt.apps.reading.models import Story
from flyt.apps.reading.models import StoryVisibility
from flyt.apps.reading.models import StoryPage
from flyt.apps.reading.annotation import load_lemmas_by_word
from flyt.apps.reading.annotation import load_word_forms_by_form
from flyt.apps.reading.annotation import resolve_lemma_uuid_from_lemma
from flyt.apps.reading.annotation import resolve_lemma_uuid
from flyt.core.db import AsyncSessionLocal


async def import_stories(json_path: Path) -> int:
    nlp = _load_nlp()
    payload = json.loads(await anyio.Path(json_path).read_text())

    async with AsyncSessionLocal() as db:
        created = 0
        for item in payload:
            group = await db.scalar(
                select(ReadingGroup).where(
                    ReadingGroup.key == item["reading_group_key"]
                )
            )
            if group is None:
                group = ReadingGroup(
                    key=item["reading_group_key"],
                    title=item["reading_group_title"],
                    order=item["reading_group_order"],
                )
                db.add(group)
                await db.flush()
            else:
                group.title = item["reading_group_title"]
                group.order = item["reading_group_order"]

            existing_story = await db.scalar(
                select(Story.id)
                .where(Story.reading_group_id == group.id)
                .where(Story.title == item["title"])
            )
            if existing_story is not None:
                continue

            doc = nlp(item["content"])
            tokens = await _build_token_annotations(doc, db)

            story = Story(
                title=item["title"],
                slug=item["slug"],
                content=item["content"],
                cefr_level=item["cefr_level"],
                visibility=StoryVisibility.PUBLIC,
                is_ready=item["is_ready"],
                word_count=len(item["content"].split()),
                reading_group_id=group.id,
            )
            db.add(story)
            await db.flush()
            db.add(
                StoryPage(
                    story_id=story.id,
                    index=0,
                    content=item["content"],
                    text_annotations_json=tokens,
                    word_count=story.word_count,
                )
            )
            created += 1

        await db.commit()
        return created


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path")
    args = parser.parse_args()
    created = asyncio.run(import_stories(Path(args.json_path)))
    print(f"Imported {created} stories")


def _load_nlp():
    try:
        import spacy
    except ImportError as exc:
        raise RuntimeError("spacy is required to import reading stories") from exc

    try:
        return spacy.load("nb_core_news_md")
    except OSError as exc:
        raise RuntimeError(
            "Install nb_core_news_md before importing reading stories"
        ) from exc


async def _build_token_annotations(doc, db: AsyncSession) -> list[dict]:
    alpha_forms = {
        token.text.lower() for token in doc if token.text.strip() and token.is_alpha
    }
    lemma_words = {
        token.lemma_.lower() if token.lemma_ else token.text.lower()
        for token in doc
        if token.text.strip() and token.is_alpha
    }
    word_forms_by_form = await load_word_forms_by_form(alpha_forms, db)
    lemmas_by_word = await load_lemmas_by_word(lemma_words, db)

    tokens: list[dict] = []
    for token in doc:
        if not token.text.strip():
            continue
        tokens.append(
            {
                "word": token.text,
                "start": token.idx,
                "end": token.idx + len(token.text),
                "lemmaUuid": _resolve_token_lemma_uuid(
                    token, word_forms_by_form, lemmas_by_word
                ),
            }
        )
    return tokens


def _resolve_token_lemma_uuid(token, word_forms_by_form, lemmas_by_word):
    if not token.is_alpha:
        return None

    token_word = token.text.lower()
    token_lemma = token.lemma_.lower() if token.lemma_ else token_word
    lemma_uuid = resolve_lemma_uuid(
        word_forms_by_form.get(token_word),
        token_lemma=token_lemma,
        token_pos=token.pos_,
    )
    if lemma_uuid is not None or token_lemma == token_word:
        return lemma_uuid
    return resolve_lemma_uuid_from_lemma(
        lemmas_by_word.get(token_lemma),
        token_pos=token.pos_,
    )


if __name__ == "__main__":
    main()
