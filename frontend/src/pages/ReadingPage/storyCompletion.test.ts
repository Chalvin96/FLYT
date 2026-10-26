import { describe, expect, it } from 'vitest';

import type {
  ReadingStoryPageResponse,
  ReadingStorySummary,
} from '@/types/api';

import {
  getOtherThemes,
  getStoryContinuation,
  mergeStoryLookup,
  summarizeStoryVocabulary,
  type StoryLookupWord,
} from './storyCompletion';

const theme = {
  id: 1,
  key: 'daily',
  title: 'Daily life',
  order: 1,
  storyCount: 3,
};
const story = (
  uuid: string,
  isRead = false,
  completed = false,
): ReadingStorySummary => ({
  uuid,
  title: uuid,
  cefrLevel: 'A1',
  wordCount: 100,
  readingMinutes: 1,
  isRead,
  completed,
  createdAt: '2026-10-01T00:00:00',
});
const lookup: StoryLookupWord = {
  key: '0-0',
  text: 'butikken',
  dictionaryForm: 'butikk',
  lemmaUuid: 'shop',
  state: 'new',
  sentence: 'Hun går til butikken.',
  observedAt: 3,
};
const page = (
  index: number,
  states: ReadingStoryPageResponse['userStates'],
): ReadingStoryPageResponse => ({
  uuid: 'current',
  title: 'Story',
  cefrLevel: 'A1',
  groupKey: theme.key,
  groupTitle: theme.title,
  totalPages: 2,
  readingMinutes: 1,
  lastPageIndex: 0,
  completed: false,
  page: {
    index,
    content: 'butikken butikk ukjent',
    tokens: [
      { word: 'butikken', start: 0, end: 8, lemmaUuid: 'shop' },
      { word: 'butikk', start: 9, end: 15, lemmaUuid: 'shop' },
      { word: 'ukjent', start: 16, end: 22, lemmaUuid: null },
    ],
  },
  userStates: states,
});

describe('storyCompletion', () => {
  it('test_visit_lookup_given_repeated_lemma_expect_one_dictionary_chip_and_original_context', () => {
    const recorded = mergeStoryLookup([], lookup);
    expect(mergeStoryLookup(recorded, { ...lookup })).toBe(recorded);
    expect(
      mergeStoryLookup(recorded, {
        ...lookup,
        state: 'learning',
        observedAt: 4,
      }),
    ).toEqual([{ ...lookup, state: 'learning', observedAt: 4 }]);
    expect(recorded[0].text).toBe('butikken');
    expect(recorded[0].dictionaryForm).toBe('butikk');
    expect(recorded[0].sentence).toBe('Hun går til butikken.');
  });

  it('test_visit_lookup_given_unresolved_then_dictionary_response_expect_resolved_identity_without_duplicate', () => {
    const unresolved = mergeStoryLookup([], {
      ...lookup,
      lemmaUuid: null,
      dictionaryForm: 'butikken',
    });
    expect(mergeStoryLookup(unresolved, lookup)).toEqual([lookup]);
  });

  it('test_story_vocabulary_given_repeated_and_unresolved_words_expect_unique_counts_and_total_occurrences', () => {
    const result = summarizeStoryVocabulary(
      [
        { data: page(0, { shop: 'mastered' }), updatedAt: 1 },
        { data: page(1, { shop: 'mastered' }), updatedAt: 2 },
      ],
      [],
    );
    expect(result).toMatchObject({
      mastered: 1,
      learning: 0,
      new: 1,
      wordCount: 6,
    });
  });

  it('test_story_vocabulary_given_different_snapshot_ages_expect_latest_state_across_pages_and_lookups', () => {
    const result = summarizeStoryVocabulary(
      [
        { data: page(0, { shop: 'new' }), updatedAt: 1 },
        { data: page(1, { shop: 'mastered' }), updatedAt: 2 },
      ],
      [{ ...lookup, state: 'learning' }],
    );
    expect(result).toMatchObject({ mastered: 0, learning: 1, new: 1 });
    const fresh = summarizeStoryVocabulary(
      [{ data: page(0, { shop: 'mastered' }), updatedAt: 4 }],
      [{ ...lookup, state: 'learning' }],
    );
    expect(fresh.mastered).toBe(1);
  });

  it('test_theme_continuation_given_read_stories_between_unread_stories_expect_first_unread_after_current', () => {
    const stories = [
      story('earlier'),
      story('current', true),
      story('started', true),
      story('finished', true, true),
      story('next'),
      story('later'),
    ];
    expect(getStoryContinuation('current', theme, stories)).toEqual({
      kind: 'next',
      theme,
      story: stories[4],
    });
  });

  it('test_theme_continuation_given_no_unread_stories_expect_verified_completion_only', () => {
    expect(
      getStoryContinuation('current', theme, [
        story('one', true, true),
        story('two', true, true),
        story('current'),
      ]),
    ).toEqual({ kind: 'last', theme, allRead: true });
    expect(
      getStoryContinuation('current', theme, [
        story('one', true),
        story('two', true, true),
        story('current'),
      ]),
    ).toEqual({ kind: 'last', theme, allRead: false });
    expect(getStoryContinuation('absent', theme, [story('current')])).toEqual({
      kind: 'none',
    });
    expect(
      getStoryContinuation('current', theme, [
        story('current'),
        story('read', true, true),
      ]),
    ).toEqual({ kind: 'last', theme, allRead: false });
  });

  it('test_theme_continuation_given_out_of_order_completion_expect_theme_end_and_all_read', () => {
    const completeTheme = { ...theme, storyCount: 5 };
    expect(
      getStoryContinuation('three', completeTheme, [
        story('one', true, true),
        story('two', true, true),
        story('three'),
        story('four', true, true),
        story('five', true, true),
      ]),
    ).toEqual({ kind: 'last', theme: completeTheme, allRead: true });
  });

  it('test_theme_continuation_given_only_earlier_unread_stories_expect_first_earlier_story', () => {
    const stories = [story('one'), story('two'), story('current')];
    expect(getStoryContinuation('current', theme, stories)).toEqual({
      kind: 'next',
      theme,
      story: stories[0],
    });
  });

  it('test_other_themes_given_unsorted_groups_expect_next_two_nonempty_themes_in_order', () => {
    const second = {
      ...theme,
      id: 2,
      key: 'second',
      title: 'Second',
      order: 2,
    };
    const third = { ...theme, id: 3, key: 'third', title: 'Third', order: 3 };
    expect(
      getOtherThemes(theme, [
        third,
        { ...theme, key: 'empty', storyCount: 0 },
        theme,
        second,
      ]),
    ).toEqual([second, third]);
  });
});
