import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { ChatbotProvider } from '@/components/chatbot/ChatbotProvider';
import { LookupProvider } from '@/components/lookup/LookupProvider';
import { useLookupContext } from '@/components/lookup/useLookupContext';
import { server } from '@/test/msw/server';
import { createStoryRouter } from '@/test/router';
import type {
  ReadingLemmaDefinitionsResponse,
  ReadingWordState,
} from '@/types/api';

import type { ReaderWord } from './readerVocabulary';
import { ReaderWordLookup } from './ReaderWordLookup';

const word: ReaderWord = {
  key: '0-0',
  text: 'kaffen',
  lemmaUuid: 'kaffe',
  state: 'new',
  sentence: 'Kaffen er varm.',
};
function definition(
  state: ReadingWordState = 'new',
): ReadingLemmaDefinitionsResponse {
  return {
    lemma: {
      uuid: 'kaffe',
      word: 'kaffe',
      pos: 'noun',
      primary_translation: 'coffee',
    },
    definitions: [
      {
        uuid: 'sense1',
        definition: 'en varm drikk',
        translation: 'coffee',
        translation_source: 'test',
        examples: [],
        userState: state,
      },
    ],
  };
}
function LookupProbe() {
  const { lemmaTarget } = useLookupContext();
  return (
    <div role="status" aria-label="Selected dictionary entry">
      {lemmaTarget?.lemmaUuid}
    </div>
  );
}
async function renderLookup(selected: ReaderWord = word) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createStoryRouter(
    <ChatbotProvider initialOpenState="closed">
      <LookupProvider>
        <ReaderWordLookup word={selected} onClose={onClose} />
        <LookupProbe />
      </LookupProvider>
    </ChatbotProvider>,
    ['/reading/story/test'],
    ['/reading/story/$uuid'],
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await router.load();
  return { onClose };
}
function serveDefinition(data: ReadingLemmaDefinitionsResponse) {
  server.use(
    http.get('*/lexicons/lemmas/:uuid/definitions', () =>
      HttpResponse.json(data),
    ),
  );
}

describe('ReaderWordLookup', () => {
  it('test_lookup_given_learning_word_expect_state_and_disabled_add', async () => {
    serveDefinition(definition('learning'));
    await renderLookup();
    expect(await screen.findByText('Learning')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Added to review' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'I already know this' }),
    ).toBeEnabled();
  });

  it('test_lookup_given_mastered_word_expect_mastered_badge_and_add_available', async () => {
    serveDefinition(definition('mastered'));
    await renderLookup();
    expect(await screen.findByText('Mastered')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'I already know this' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to review' })).toBeEnabled();
  });

  it('test_lookup_given_no_translation_expect_reason_sentence_and_close', async () => {
    serveDefinition({
      lemma: { ...definition().lemma, primary_translation: null },
      definitions: [],
    });
    const user = userEvent.setup();
    const { onClose } = await renderLookup();
    expect(await screen.findByText('No translation found')).toBeInTheDocument();
    expect(
      screen.getByText(/dictionary entry doesn't have a translation yet/),
    ).toBeInTheDocument();
    expect(screen.getByRole('blockquote')).toHaveTextContent(word.sentence);
    expect(
      screen.getByRole('button', { name: 'Ask Flyt what it means' }),
    ).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('test_lookup_given_missing_headword_expect_empty_dictionary_result', async () => {
    server.use(
      http.get('*/lexicons/browse', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 }),
      ),
    );
    await renderLookup({ ...word, text: 'ikkje', lemmaUuid: null });
    expect(await screen.findByText('No translation found')).toBeInTheDocument();
    expect(screen.getByText('Not in the dictionary')).toBeInTheDocument();
  });

  it('test_lookup_given_multiple_browse_entries_expect_each_definition', async () => {
    server.use(
      http.get('*/lexicons/browse', () =>
        HttpResponse.json({
          headword: 'bank',
          entries: [{ uuid: 'bank-one' }, { uuid: 'bank-two' }],
          selected_lemma_uuid: null,
          is_fallback: false,
        }),
      ),
      http.get('*/lexicons/lemmas/:uuid/definitions', ({ params }) =>
        HttpResponse.json({
          ...definition(),
          lemma: {
            ...definition().lemma,
            uuid: params.uuid,
            word: 'bank',
            primary_translation:
              params.uuid === 'bank-one' ? 'a bank' : 'a river bank',
          },
        }),
      ),
    );
    await renderLookup({ ...word, text: 'bank', lemmaUuid: null });
    expect(await screen.findByText('a bank')).toBeInTheDocument();
    expect(await screen.findByText('a river bank')).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: 'bank', level: 3 }),
    ).toHaveLength(2);
  });

  it('test_lookup_given_one_letter_without_lemma_expect_reason_instead_of_stuck_loading', async () => {
    await renderLookup({ ...word, text: 'Å', lemmaUuid: null });
    expect(await screen.findByText('No translation found')).toBeInTheDocument();
  });

  it('test_lookup_given_untranslated_definition_expect_sentence_and_ask_action', async () => {
    const data = definition();
    data.lemma.primary_translation = null;
    data.definitions[0].translation = '';
    serveDefinition(data);
    await renderLookup();
    expect(await screen.findByText('No translation found')).toBeInTheDocument();
    expect(screen.getByRole('blockquote')).toHaveTextContent(word.sentence);
  });

  it('test_lookup_given_compound_parts_expect_natural_accessible_headword_and_parts', async () => {
    const data = {
      ...definition(),
      lemma: {
        ...definition().lemma,
        word: 'kommunestyrerepresentant',
        primary_display_form: 'kommunestyrerepresentant',
        compoundParts: ['kommunestyre', 'representant'],
      },
    };
    serveDefinition(data);
    await renderLookup({ ...word, text: 'kommunestyrerepresentantene' });
    expect(
      await screen.findByRole('heading', {
        name: 'kommunestyrerepresentant',
        level: 3,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('kommunestyre + representant')).toBeInTheDocument();
    expect(
      screen.getByText('kommunestyrerepresentantene = coffee'),
    ).toBeInTheDocument();
  });

  it('test_lookup_given_slash_joined_gloss_expect_primary_heading_and_capped_alternates', async () => {
    serveDefinition({
      ...definition(),
      lemma: {
        ...definition().lemma,
        primary_translation: 'in / within / mixed with / towards / next to',
      },
    });
    await renderLookup();
    expect(await screen.findByText(/^in$/)).toBeInTheDocument();
    expect(
      screen.getByText('within · mixed with · towards'),
    ).toBeInTheDocument();
    expect(screen.getByText('kaffen = in')).toBeInTheDocument();
    expect(screen.queryByText(/next to/)).not.toBeInTheDocument();
  });

  it('test_lookup_given_many_meanings_expect_three_then_expand_all', async () => {
    const data = definition();
    data.definitions = Array.from({ length: 7 }, (_, index) => ({
      ...data.definitions[0],
      uuid: `sense${index}`,
      definition: `betydning ${index}`,
      translation: `meaning ${index}`,
    }));
    serveDefinition(data);
    const user = userEvent.setup();
    await renderLookup();
    await screen.findByText('meaning 0');
    expect(screen.getAllByText(/^meaning/)).toHaveLength(3);
    await user.click(
      screen.getByRole('button', { name: 'Show all 7 meanings' }),
    );
    expect(screen.getAllByText(/^meaning/)).toHaveLength(7);
  });

  it('test_lookup_given_related_word_and_other_forms_expect_preserved_dictionary_navigation', async () => {
    serveDefinition({
      ...definition(),
      lemma: {
        ...definition().lemma,
        alternative_forms: ['kaffen', 'kaffer'],
        see_also: [
          {
            article_id: 4,
            word: 'te',
            relation: 'compare',
            target_lemma_uuid: 'te',
          },
        ],
      },
    });
    const user = userEvent.setup();
    await renderLookup();
    expect(await screen.findByText(/kaffen · kaffer/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compare te' }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Selected dictionary entry' }),
      ).toHaveTextContent('te'),
    );
  });
});
