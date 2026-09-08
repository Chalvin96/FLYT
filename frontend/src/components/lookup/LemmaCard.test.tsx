import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { LookupProvider } from '@/components/lookup/LookupProvider';
import { useLemmaActions } from '@/hooks/lexicon/queries';
import { type ReadingLemmaDefinitionsResponse } from '@/types/api';

import { LemmaCard } from './LemmaCard';

vi.mock('@/hooks/lexicon/queries', () => ({
  useLemmaActions: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (s: Record<string, unknown>) => unknown;
  }) =>
    select({
      location: { pathname: '/home', search: {} },
    }),
}));

const openLemmaSpy = vi.fn();

vi.mock('@/components/lookup/useLookupContext', () => ({
  LookupProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useLookupContext: () => ({ openLemma: openLemmaSpy }),
}));

const sample: ReadingLemmaDefinitionsResponse = {
  lemma: {
    uuid: 'lemma-1',
    word: 'gå',
    pos: 'verb',
    primary_translation: 'go',
  },
  definitions: [
    {
      uuid: 'definition-new',
      definition: 'to walk',
      translation: 'walk',
      translation_source: null,
      examples: [{ no: 'Jeg går hjem.', en: null }],
      userState: 'new',
    },
    {
      uuid: 'definition-learning',
      definition: 'to function',
      translation: 'function',
      translation_source: null,
      examples: [],
      userState: 'learning',
    },
  ],
};

function renderWithClient(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <LookupProvider>{ui}</LookupProvider>
    </QueryClientProvider>,
  );
}

describe('LemmaCard', () => {
  it('renders lemma header with word, pos and primary translation', () => {
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck: vi.fn(),
      markLemmaKnown: vi.fn(),
      isPending: false,
    });
    renderWithClient(<LemmaCard data={sample} lemmaUuid="lemma-1" />);
    expect(screen.getByText('gå')).toBeInTheDocument();
    // POS badge now renders English uppercase via posLabel (verb → VERB).
    expect(screen.getByText('VERB')).toBeInTheDocument();
    expect(screen.getByText('go')).toBeInTheDocument();
  });

  it('renders numbered definitions', () => {
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck: vi.fn(),
      markLemmaKnown: vi.fn(),
      isPending: false,
    });
    renderWithClient(<LemmaCard data={sample} lemmaUuid="lemma-1" />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('renders a single action row for the whole lemma', () => {
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck: vi.fn(),
      markLemmaKnown: vi.fn(),
      isPending: false,
    });
    renderWithClient(<LemmaCard data={sample} lemmaUuid="lemma-1" />);
    const buttons = screen.getAllByRole('button', {
      name: /I already know this/i,
    });
    expect(buttons).toHaveLength(1);
    const addButtons = screen.getAllByRole('button', {
      name: /Add to review/i,
    });
    expect(addButtons).toHaveLength(1);
  });

  it('calls markLemmaKnown when "I already know this" pressed', async () => {
    const markLemmaKnown = vi.fn();
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck: vi.fn(),
      markLemmaKnown,
      isPending: false,
    });
    renderWithClient(<LemmaCard data={sample} lemmaUuid="lemma-1" />);
    await userEvent.click(
      screen.getByRole('button', { name: /I already know this/i }),
    );
    expect(markLemmaKnown).toHaveBeenCalledWith('lemma-1');
  });

  it('calls addLemmaToDeck when "Add to review" pressed', async () => {
    const addLemmaToDeck = vi.fn();
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck,
      markLemmaKnown: vi.fn(),
      isPending: false,
    });
    renderWithClient(<LemmaCard data={sample} lemmaUuid="lemma-1" />);
    await userEvent.click(
      screen.getByRole('button', { name: /Add to review/i }),
    );
    expect(addLemmaToDeck).toHaveBeenCalledWith('lemma-1');
  });

  it('test_card_given_mastered_lemma_expect_add_to_review_available', () => {
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck: vi.fn(),
      markLemmaKnown: vi.fn(),
      isPending: false,
    });
    const mastered = {
      ...sample,
      definitions: sample.definitions.map((definition) => ({
        ...definition,
        userState: 'mastered' as const,
      })),
    };

    renderWithClient(<LemmaCard data={mastered} lemmaUuid="lemma-1" />);

    expect(
      screen.getByRole('button', { name: /Add to review/i }),
    ).not.toBeDisabled();
  });

  it('passes isPending to DefinitionActionRow', () => {
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck: vi.fn(),
      markLemmaKnown: vi.fn(),
      isPending: true,
    });
    renderWithClient(<LemmaCard data={sample} lemmaUuid="lemma-1" />);
    expect(
      screen.getByRole('button', { name: /I already know this/i }),
    ).toBeDisabled();
  });

  // ── see_also Related row ────────────────────────────────────────────────

  function mockActions() {
    vi.mocked(useLemmaActions).mockReturnValue({
      addLemmaToDeck: vi.fn(),
      markLemmaKnown: vi.fn(),
      isPending: false,
    });
  }

  it('renders Related links for see_also entries with target_lemma_uuid', () => {
    mockActions();
    const data: ReadingLemmaDefinitionsResponse = {
      ...sample,
      lemma: {
        ...sample.lemma,
        see_also: [
          {
            article_id: 111,
            word: 'mål',
            relation: 'see',
            target_lemma_uuid: 'target-uuid-1',
          },
          {
            article_id: 222,
            word: 'teknikk',
            relation: 'compare',
            target_lemma_uuid: 'target-uuid-2',
          },
        ],
      },
    };
    renderWithClient(<LemmaCard data={data} lemmaUuid="lemma-1" />);
    expect(screen.getByRole('button', { name: 'See mål' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Compare teknikk' }),
    ).toBeInTheDocument();
  });

  it('calls openLemma(uuid, word) when a Related link is clicked', async () => {
    mockActions();
    openLemmaSpy.mockClear();
    const data: ReadingLemmaDefinitionsResponse = {
      ...sample,
      lemma: {
        ...sample.lemma,
        see_also: [
          {
            article_id: 111,
            word: 'mål',
            relation: 'see',
            target_lemma_uuid: 'target-uuid-1',
          },
        ],
      },
    };
    renderWithClient(<LemmaCard data={data} lemmaUuid="lemma-1" />);
    await userEvent.click(screen.getByRole('button', { name: 'See mål' }));
    expect(openLemmaSpy).toHaveBeenCalledWith('target-uuid-1', 'mål');
  });

  it('renders dangling see_also as muted text without a link', () => {
    mockActions();
    const data: ReadingLemmaDefinitionsResponse = {
      ...sample,
      lemma: {
        ...sample.lemma,
        see_also: [
          {
            article_id: 999,
            word: 'ukjent',
            relation: 'see',
            target_lemma_uuid: null,
          },
        ],
      },
    };
    renderWithClient(<LemmaCard data={data} lemmaUuid="lemma-1" />);
    expect(screen.getByText('See ukjent')).toBeInTheDocument();
    // No button/link role for the dangling entry.
    expect(screen.queryByRole('button', { name: /ukjent/i })).toBeNull();
  });

  it('renders nothing for Related when see_also is empty or missing', () => {
    mockActions();
    renderWithClient(<LemmaCard data={sample} lemmaUuid="lemma-1" />);
    expect(screen.queryByText('Related:')).toBeNull();
  });
});
