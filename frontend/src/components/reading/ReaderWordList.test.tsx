import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { server } from '@/test/msw/server';
import { createStoryRouter } from '@/test/router';
import type { ReadingWordState } from '@/types/api';

import type { ReaderWord } from './readerVocabulary';
import { EasierStoryNotice, ReaderWordList } from './ReaderWordList';

function words(
  count: number,
  state: ReadingWordState = 'new',
  start = 0,
): ReaderWord[] {
  return Array.from({ length: count }, (_, index) => ({
    key: String(start + index),
    text: `ord${start + index}`,
    lemmaUuid: `ord${start + index}`,
    state,
    sentence: '',
  }));
}

function renderList(items: ReaderWord[], easierStoryNotice?: React.ReactNode) {
  const onSelect = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ReaderWordList
        words={items}
        onSelect={onSelect}
        easierStoryNotice={easierStoryNotice}
      />
    </QueryClientProvider>,
  );
  return { onSelect };
}

function renderNotice(cefrLevel: string | null, groupKey = 'daily_life') {
  const onDismiss = vi.fn();
  const router = createStoryRouter(
    <EasierStoryNotice
      newCount={33}
      story={{ cefrLevel, groupKey, groupTitle: 'Hverdagsliv' }}
      onDismiss={onDismiss}
    />,
    ['/reading'],
    ['/reading', '/reading/themes/$key'],
  );
  render(<RouterProvider router={router} />);
  return { onDismiss, router };
}

beforeEach(() => {
  server.use(
    http.get('*/lexicons/lemmas/:uuid/definitions', ({ params }) =>
      HttpResponse.json({
        lemma: {
          uuid: params.uuid,
          word: String(params.uuid),
          pos: 'noun',
          primary_translation: 'word',
        },
        definitions: [],
      }),
    ),
  );
});

describe('ReaderWordList', () => {
  it('test_word_list_given_empty_page_expect_no_dictionary_words_notice', () => {
    renderList([]);
    expect(
      screen.getByRole('heading', { name: 'No dictionary words on this page' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('test_word_list_given_all_mastered_expect_encouragement_without_empty_groups', () => {
    renderList(words(5, 'mastered'));
    expect(
      screen.getByRole('heading', { name: 'You know every word on this page' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'New' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Still learning' }),
    ).not.toBeInTheDocument();
  });

  it('test_word_list_given_no_dictionary_words_and_difficult_page_expect_notice_retained', () => {
    renderList([], <p>12 words on this page are new to you.</p>);
    expect(
      screen.getByText('12 words on this page are new to you.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'No dictionary words on this page' }),
    ).toBeInTheDocument();
  });

  it('test_word_list_given_one_new_word_expect_only_populated_group_and_selection', async () => {
    const user = userEvent.setup();
    const word = words(1)[0];
    const { onSelect } = renderList([word, ...words(4, 'mastered', 1)]);
    expect(
      screen.getByRole('region', { name: 'Page vocabulary' }),
    ).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('heading', { name: 'New' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Still learning' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Everything else on this page is known to you.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: word.text }));
    expect(onSelect).toHaveBeenCalledWith(word);
  });

  it('test_word_list_given_everything_new_expect_twelve_words_and_expand_all', async () => {
    const user = userEvent.setup();
    renderList(words(33));
    expect(screen.getAllByRole('button', { name: /^ord/ })).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: 'Show all 33' }));
    expect(screen.getAllByRole('button', { name: /^ord/ })).toHaveLength(33);
    expect(
      screen.queryByRole('heading', { name: 'Still learning' }),
    ).not.toBeInTheDocument();
  });

  it('test_word_list_given_sixty_four_mixed_words_expect_learning_capped_at_ten', async () => {
    const user = userEvent.setup();
    renderList([...words(38), ...words(26, 'learning', 38)]);
    expect(screen.getAllByRole('button', { name: /^ord/ })).toHaveLength(48);
    expect(
      screen.getByRole('heading', { name: 'Still learning' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all 26' }));
    expect(screen.getAllByRole('button', { name: /^ord/ })).toHaveLength(64);
  });

  it('test_word_list_given_dictionary_form_expect_canonical_label_once', async () => {
    server.use(
      http.get('*/lexicons/lemmas/:uuid/definitions', () =>
        HttpResponse.json({
          lemma: {
            uuid: 'lemma',
            word: 'fortau',
            pos: 'noun',
            primary_display_form: 'fortau',
            primary_translation: 'pavement',
          },
          definitions: [],
        }),
      ),
    );
    renderList([
      {
        key: '0',
        text: 'fortauet',
        lemmaUuid: 'lemma',
        state: 'new',
        sentence: '',
      },
    ]);
    expect(
      await screen.findByRole('button', { name: 'fortau' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'fortauet' }),
    ).not.toBeInTheDocument();
  });

  it('test_easier_notice_given_b1_story_expect_same_theme_at_a2', async () => {
    const { router } = renderNotice('B1');
    const link = await screen.findByRole('link', {
      name: 'Show A2 stories in Hverdagsliv',
    });
    const url = new URL(link.getAttribute('href') ?? '', 'http://flyt.test');
    expect(url.pathname).toBe('/reading/themes/daily_life');
    expect(JSON.parse(url.searchParams.get('levels') ?? 'null')).toEqual([
      'A2',
    ]);
    await userEvent.setup().click(link);
    expect(router.state.location.pathname).toBe('/reading/themes/daily_life');
    expect(router.state.location.search).toEqual({ levels: ['A2'] });
  });

  it('test_easier_notice_given_a1_story_expect_unfiltered_reading_home', async () => {
    renderNotice('A1');
    expect(
      await screen.findByRole('link', { name: 'Browse other stories' }),
    ).toHaveAttribute('href', '/reading');
  });

  it('test_easier_notice_given_import_without_level_expect_unfiltered_reading_home', async () => {
    renderNotice(null);
    expect(
      await screen.findByRole('link', { name: 'Browse other stories' }),
    ).toHaveAttribute('href', '/reading');
  });

  it('test_easier_notice_given_keep_reading_expect_dismiss_and_exact_new_count', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderNotice('A2');
    expect(
      await screen.findByText('33 words on this page are new to you.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep reading' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
