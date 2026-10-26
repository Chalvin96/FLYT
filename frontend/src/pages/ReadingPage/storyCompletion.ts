import type { ReaderWord } from '@/components/reading/readerVocabulary';
import { getReaderWords } from '@/components/reading/readerVocabulary';
import { buildStoryParagraphs } from '@/components/reading/storyParagraphs';
import { collectLatestWordStates } from '@/lib/readingWordStates';
import type {
  ReadingGroup,
  ReadingStoryPageResponse,
  ReadingStorySummary,
  ReadingWordState,
} from '@/types/api';

export interface StoryLookupWord extends ReaderWord {
  dictionaryForm: string;
  observedAt: number;
}

export interface StoryVocabulary {
  mastered: number;
  learning: number;
  new: number;
  wordCount: number;
  states: ReadonlyMap<string, ReadingWordState>;
}

export type StoryContinuation =
  | { kind: 'none' }
  | { kind: 'next'; theme: ReadingGroup; story: ReadingStorySummary }
  | { kind: 'last'; theme: ReadingGroup; allRead: boolean };

export function mergeStoryLookup(
  lookups: readonly StoryLookupWord[],
  lookup: StoryLookupWord,
): readonly StoryLookupWord[] {
  const existing = lookups.findIndex((word) =>
    lookup.lemmaUuid === null
      ? word.lemmaUuid === null && word.text === lookup.text
      : word.lemmaUuid === lookup.lemmaUuid,
  );
  if (existing >= 0) {
    const previous = lookups[existing];
    if (
      previous.dictionaryForm === lookup.dictionaryForm &&
      previous.state === lookup.state &&
      previous.text === lookup.text &&
      previous.sentence === lookup.sentence &&
      previous.observedAt === lookup.observedAt
    )
      return lookups;
    return lookups.map((word, index) => (index === existing ? lookup : word));
  }
  const resolved = lookups.filter(
    (word) => !(word.lemmaUuid === null && word.text === lookup.text),
  );
  return [...resolved, lookup];
}

export function summarizeStoryVocabulary(
  pages: readonly { data: ReadingStoryPageResponse; updatedAt: number }[],
  lookups: readonly StoryLookupWord[],
): StoryVocabulary {
  const states = collectLatestWordStates([
    ...pages.map(({ data, updatedAt }) => ({
      updatedAt,
      states: Object.entries(data.userStates),
    })),
    ...lookups.flatMap((word) =>
      word.lemmaUuid === null
        ? []
        : [
            {
              updatedAt: word.observedAt,
              states: [[word.lemmaUuid, word.state] as const],
            },
          ],
    ),
  ]);

  const unique = new Map<string, ReadingWordState>();
  let wordCount = 0;
  for (const { data } of pages) {
    const words = getReaderWords(
      buildStoryParagraphs(data.page, data.userStates),
    );
    wordCount += words.length;
    for (const word of words) {
      const identity =
        word.lemmaUuid ?? `text:${word.text.toLocaleLowerCase('nb')}`;
      unique.set(
        identity,
        word.lemmaUuid ? (states.get(word.lemmaUuid) ?? 'new') : 'new',
      );
    }
  }
  const counts = { mastered: 0, learning: 0, new: 0 };
  for (const state of unique.values()) counts[state] += 1;
  return { ...counts, wordCount, states };
}

export function getStoryContinuation(
  currentUuid: string,
  theme: ReadingGroup,
  stories: readonly ReadingStorySummary[],
): StoryContinuation {
  const index = stories.findIndex((story) => story.uuid === currentUuid);
  if (index < 0) return { kind: 'none' };
  const next = stories
    .slice(index + 1)
    .concat(stories.slice(0, index))
    .find((story) => !story.isRead && !story.completed);
  if (next) return { kind: 'next', theme, story: next };
  return {
    kind: 'last',
    theme,
    allRead:
      stories.length === theme.storyCount &&
      stories.every((story) => story.uuid === currentUuid || story.completed),
  };
}

export function getOtherThemes(
  current: ReadingGroup,
  groups: readonly ReadingGroup[],
): ReadingGroup[] {
  const others = groups.filter(
    (group) => group.key !== current.key && group.storyCount > 0,
  );
  return others
    .sort((a, b) => {
      const aWrap = a.order <= current.order ? 1 : 0;
      const bWrap = b.order <= current.order ? 1 : 0;
      return aWrap - bWrap || a.order - b.order || a.id - b.id;
    })
    .slice(0, 2);
}
