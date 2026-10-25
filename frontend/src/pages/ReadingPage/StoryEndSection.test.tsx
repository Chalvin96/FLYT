import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from '@tanstack/react-router';

import { createStoryRouter } from '@/test/router';
import type { ReadingStorySummary } from '@/types/api';

import type { StoryLookupWord } from './storyCompletion';
import { StoryEndSection, type StoryEndSectionProps } from './StoryEndSection';

const desktop = vi.hoisted(() => vi.fn(() => false));
vi.mock('@/hooks/ui/useIsDesktop', () => ({ useIsDesktop: desktop }));
const theme = {
  id: 1,
  key: 'daily_life',
  title: 'Hverdagsliv',
  order: 1,
  storyCount: 12,
};
const next: ReadingStorySummary = {
  uuid: 'next',
  title: 'Ida på jobb',
  cefrLevel: 'A2',
  wordCount: 580,
  readingMinutes: 4,
  isRead: false,
  completed: false,
  createdAt: '2026-10-01T00:00:00',
};
function lookups(count: number): StoryLookupWord[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `word-${index}`,
    text: `ordene${index}`,
    dictionaryForm: `ord${index}`,
    lemmaUuid: `lemma-${index}`,
    state: index < 31 ? 'new' : 'learning',
    sentence: `Hun leser ordene${index}.`,
    observedAt: 1,
  }));
}
function renderEnd(overrides: Partial<StoryEndSectionProps> = {}) {
  const props: StoryEndSectionProps = {
    story: {
      title: 'En regnfull mandag',
      cefrLevel: 'A2',
      groupKey: theme.key,
      groupTitle: theme.title,
      totalPages: 5,
      readingMinutes: 7,
    },
    wordCount: 640,
    vocabulary: {
      mastered: 172,
      learning: 22,
      new: 16,
      wordCount: 640,
      states: new Map(),
    },
    lookups: lookups(6),
    continuation: { kind: 'next', theme, story: next },
    otherThemes: [],
    recommendations: [
      {
        ...next,
        uuid: 'recommendation',
        title: 'Den lille båten',
        completed: true,
      },
    ],
    onLookup: vi.fn(),
    onAddWords: vi.fn(async ({ lemmaUuids }) => ({
      added: [...lemmaUuids],
      failed: [],
    })),
    ...overrides,
  };
  const router = createStoryRouter(
    <StoryEndSection {...props} />,
    ['/'],
    [
      '/reading',
      '/reading/imports',
      '/reading/story/$uuid',
      '/reading/themes/$key',
    ],
  );
  return { props, router, ...render(<RouterProvider router={router} />) };
}

describe('StoryEndSection', () => {
  beforeEach(() => desktop.mockReturnValue(false));

  it('test_story_end_given_default_expect_mastery_breakdown_and_next_story', async () => {
    renderEnd();
    expect(await screen.findByText('82%')).toBeInTheDocument();
    expect(screen.getByText('172 mastered')).toBeInTheDocument();
    expect(screen.getByText('22 learning')).toBeVisible();
    expect(screen.getByText('16 new')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Read next story' }),
    ).toHaveAttribute('href', '/reading/story/next');
    expect(
      screen.getByRole('heading', { name: 'More to read' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('test_story_end_given_zero_lookups_and_all_mastered_expect_encouragement_without_zero_counts', async () => {
    renderEnd({
      lookups: [],
      vocabulary: {
        mastered: 96,
        learning: 0,
        new: 0,
        wordCount: 260,
        states: new Map(),
      },
    });
    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(
      screen.getByText('You know every word in this story.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/looked up|0 learning|0 new/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /review/ }),
    ).not.toBeInTheDocument();
  });

  it('test_story_end_given_forty_mobile_lookups_expect_eight_chips_and_expansion', async () => {
    const user = userEvent.setup();
    renderEnd({ lookups: lookups(40) });
    expect(
      await screen.findByRole('heading', {
        name: 'Words you looked up 40 · 31 new',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Look up/ })).toHaveLength(8);
    expect(
      screen.getByRole('button', { name: 'Add 31 new words to review' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all 40' }));
    expect(screen.getAllByRole('button', { name: /^Look up/ })).toHaveLength(
      40,
    );
  });

  it('test_story_end_given_forty_desktop_lookups_expect_twenty_chips', async () => {
    desktop.mockReturnValue(true);
    renderEnd({ lookups: lookups(40) });
    await screen.findByRole('button', { name: 'Show all 40' });
    expect(screen.getAllByRole('button', { name: /^Look up/ })).toHaveLength(
      20,
    );
  });

  it('test_story_end_given_no_mastered_words_expect_new_count_and_practice_hint', async () => {
    renderEnd({
      vocabulary: {
        mastered: 0,
        learning: 0,
        new: 74,
        wordCount: 180,
        states: new Map(),
      },
      lookups: lookups(9),
    });
    expect(await screen.findByText('74')).toBeInTheDocument();
    expect(
      screen.getByText('words in this story are new to you'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Words you add come back in Practice/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Look up/ })).toHaveLength(9);
  });

  it('test_story_end_given_last_story_expect_two_themes_without_primary_next', async () => {
    renderEnd({
      continuation: { kind: 'last', theme, allRead: true },
      otherThemes: [
        {
          id: 2,
          key: 'folk',
          title: 'Folk tales and stories',
          order: 2,
          storyCount: 9,
        },
        {
          id: 3,
          key: 'culture',
          title: 'Culture and society',
          order: 3,
          storyCount: 14,
        },
      ],
    });
    expect(
      await screen.findByText(
        'That was the last story in Hverdagsliv. You have read all 12.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Folk tales/ })).toHaveAttribute(
      'href',
      '/reading/themes/folk',
    );
    expect(
      screen.getByRole('link', { name: /Culture and society/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Read next story' }),
    ).not.toBeInTheDocument();
  });

  it('test_story_end_given_last_with_unread_earlier_stories_expect_no_all_read_claim', async () => {
    renderEnd({ continuation: { kind: 'last', theme, allRead: false } });
    expect(
      await screen.findByText('That was the last story in Hverdagsliv.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You have read all/)).not.toBeInTheDocument();
  });

  it('test_story_end_given_import_expect_no_level_or_next_and_import_return', async () => {
    renderEnd({
      story: {
        title: 'Været i helgen',
        cefrLevel: null,
        groupKey: null,
        groupTitle: null,
        totalPages: 3,
        readingMinutes: 5,
      },
      recommendations: [],
    });
    expect(
      await screen.findByText('Your import · 3 pages · 640 words'),
    ).toBeInTheDocument();
    expect(screen.queryByText('A2')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Read next story' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to your imports' }),
    ).toHaveAttribute('href', '/reading/imports');
  });

  it('test_story_end_given_one_page_and_lookup_expect_singular_copy_and_dictionary_form', async () => {
    const user = userEvent.setup();
    const lookup = {
      ...lookups(1)[0],
      text: 'butikken',
      dictionaryForm: 'butikk',
    };
    const { props } = renderEnd({
      story: {
        title: 'Kaffe',
        cefrLevel: 'A1',
        groupKey: theme.key,
        groupTitle: theme.title,
        totalPages: 1,
        readingMinutes: 1,
      },
      lookups: [lookup],
      wordCount: 48,
    });
    expect(
      await screen.findByText('Hverdagsliv · 1 page · 48 words'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add this word to review' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Look up butikk' }));
    expect(props.onLookup).toHaveBeenCalledWith(lookup);
  });

  it('test_story_end_given_learning_and_unresolved_lookups_expect_no_add_action', async () => {
    renderEnd({
      lookups: [
        { ...lookups(1)[0], state: 'learning' },
        {
          ...lookups(1)[0],
          lemmaUuid: null,
          text: 'ukjent',
          dictionaryForm: 'ukjent',
        },
      ],
    });
    await screen.findByRole('heading', { name: /Words you looked up/ });
    expect(
      screen.queryByRole('button', { name: /Add.*review/ }),
    ).not.toBeInTheDocument();
  });

  it('test_story_end_given_resolved_and_unresolved_new_lookups_expect_heading_and_review_counts_match', async () => {
    const user = userEvent.setup();
    const { props } = renderEnd({
      lookups: [
        ...lookups(2),
        {
          ...lookups(1)[0],
          lemmaUuid: null,
          text: 'ukjent',
          dictionaryForm: 'ukjent',
        },
      ],
    });
    expect(
      await screen.findByRole('heading', {
        name: 'Words you looked up 3 · 2 new',
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Add 2 new words to review' }),
    );
    expect(props.onAddWords).toHaveBeenCalledWith({
      lemmaUuids: ['lemma-0', 'lemma-1'],
      onProgress: expect.any(Function),
    });
    expect(
      await screen.findByRole('heading', { name: 'Words you looked up 3' }),
    ).toBeInTheDocument();
  });

  it.each([
    {
      readingMinutes: 7,
      sentence: 'You read En regnfull mandag in 7 minutes.',
    },
    {
      readingMinutes: 1,
      sentence: 'You read En regnfull mandag in under a minute.',
    },
  ])(
    'test_story_end_given_reading_minutes_expect_read_time_sentence',
    async ({ readingMinutes, sentence }) => {
      renderEnd({
        story: {
          title: 'En regnfull mandag',
          cefrLevel: 'A2',
          groupKey: theme.key,
          groupTitle: theme.title,
          totalPages: 5,
          readingMinutes,
        },
      });
      await screen.findByRole('heading', { name: 'Story finished' });
      expect(
        screen.getByText((_, element) => element?.textContent === sentence),
      ).toBeInTheDocument();
    },
  );

  it('test_story_end_given_missing_data_expect_empty_blocks_hidden', async () => {
    renderEnd({
      story: {
        title: 'En regnfull mandag',
        cefrLevel: 'A2',
        groupKey: theme.key,
        groupTitle: theme.title,
        totalPages: 5,
        readingMinutes: 0,
      },
      vocabulary: undefined,
      lookups: [],
      continuation: { kind: 'none' },
      recommendations: [],
      wordCount: undefined,
    });
    await screen.findByRole('heading', { name: 'Story finished' });
    expect(
      screen.queryByRole('region', { name: 'What this story gave you' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'More to read' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Reading' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/0 words|minutes/)).not.toBeInTheDocument();
  });

  it('test_story_end_given_partial_review_failure_expect_progress_and_retry_only_failed_words', async () => {
    const user = userEvent.setup();
    let release = () => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onAddWords = vi
      .fn<StoryEndSectionProps['onAddWords']>()
      .mockImplementationOnce(async ({ onProgress }) => {
        onProgress(1, 4);
        await waiting;
        return {
          added: ['lemma-0', 'lemma-1'],
          failed: ['lemma-2', 'lemma-3'],
        };
      })
      .mockImplementationOnce(async ({ lemmaUuids }) => ({
        added: [...lemmaUuids],
        failed: [],
      }));
    renderEnd({ lookups: lookups(4), onAddWords });
    await user.click(
      await screen.findByRole('button', { name: 'Add 4 new words to review' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Adding 1 of 4 words to review',
    );
    expect(
      screen.getByRole('button', { name: 'Adding words to review…' }),
    ).toBeDisabled();
    await act(async () => release());
    expect(
      await screen.findByRole('button', { name: 'Retry 2 words' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry 2 words' }));
    expect(onAddWords.mock.calls[1][0].lemmaUuids).toEqual([
      'lemma-2',
      'lemma-3',
    ]);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Added 4 words to review.',
    );
    expect(
      within(screen.getByRole('group', { name: 'Looked-up words' })).getByText(
        'ord0',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Add|Retry/ }),
    ).not.toBeInTheDocument();
  });
});
