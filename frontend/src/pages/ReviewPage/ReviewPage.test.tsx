import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import type { DeckSummaryItem, UserCard } from '@/types/api';

import { KeepPracticingPanel } from './KeepPracticingPanel';
import { ReviewPage } from './ReviewPage';

// Render TanStack's <Link> as a plain anchor so the empty state's "Browse
// lessons" link works without a full router context in unit tests.
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const lowDueCards = [{ id: 1 }, { id: 2 }, { id: 3 }] as UserCard[];
const manyDueCards = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
})) as UserCard[];

const SAMPLE_DECKS: DeckSummaryItem[] = [
  {
    id: 1,
    name: 'Everyday Essentials',
    description: 'Common words for daily life',
    card_count: 120,
    cefr_range: null,
    is_subscribed: false,
    studied_count: 0,
  },
  {
    id: 2,
    name: 'Food & Drink',
    description: 'Vocabulary for restaurants and cooking',
    card_count: 75,
    cefr_range: null,
    is_subscribed: true,
    studied_count: 30,
  },
];

describe('ReviewPage', () => {
  it('starts a quick session by default when enough cards are due', async () => {
    const onStart = vi.fn();

    render(<ReviewPage dueCards={manyDueCards} onStart={onStart} />);

    await userEvent.click(
      screen.getByRole('button', { name: /start practice/i }),
    );

    expect(onStart).toHaveBeenCalledWith('quick');
  });

  it('resets selection when the initial selection changes', async () => {
    const onStart = vi.fn();
    const { rerender } = render(
      <ReviewPage
        dueCards={manyDueCards}
        initialSelection="full"
        onStart={onStart}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /^full/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /start practice/i }),
    );

    expect(onStart).toHaveBeenLastCalledWith('full');

    rerender(
      <ReviewPage
        dueCards={manyDueCards}
        initialSelection="quick"
        onStart={onStart}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /start practice/i }),
    );

    expect(onStart).toHaveBeenLastCalledWith('quick');
  });

  it('keeps quick available when fewer than the quick-session cap are due', async () => {
    const onStart = vi.fn();

    render(<ReviewPage dueCards={lowDueCards} onStart={onStart} />);

    const quickButton = screen.getByRole('button', { name: /quick/i });
    expect(quickButton).toBeEnabled();
    expect(quickButton).toHaveTextContent('3 cards');
    expect(quickButton).not.toHaveTextContent(/need 10/i);

    await userEvent.click(
      screen.getByRole('button', { name: /start practice/i }),
    );

    expect(onStart).toHaveBeenCalledWith('quick');
  });

  it('offers a queue fill action when no cards are due', () => {
    render(<ReviewPage dueCards={[]} />);

    // Empty state leads with a lesson CTA instead of a disabled practice button.
    expect(
      screen.getByRole('link', { name: /browse lessons/i }),
    ).toBeInTheDocument();
    // No keep-practicing shelf in the onboarding (not-caught-up) state.
    expect(screen.queryByText(/add more new words/i)).not.toBeInTheDocument();
  });
});

describe('ReviewPage caught-up state', () => {
  it('renders the keep practicing panel with Add more new words button', () => {
    const onAddMoreNew = vi.fn();
    render(
      <ReviewPage dueCards={[]} hasPracticed onAddMoreNew={onAddMoreNew} />,
    );

    expect(screen.getByText(/keep practicing/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add more new words/i }),
    ).toBeInTheDocument();
  });

  it('calls onAddMoreNew when the button is clicked', async () => {
    const onAddMoreNew = vi.fn();
    render(
      <ReviewPage dueCards={[]} hasPracticed onAddMoreNew={onAddMoreNew} />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /add more new words/i }),
    );

    expect(onAddMoreNew).toHaveBeenCalledTimes(1);
  });

  it('does not render the keep practicing panel when not caught up', () => {
    render(<ReviewPage dueCards={[]} hasPracticed={false} />);

    expect(screen.queryByText(/keep practicing/i)).not.toBeInTheDocument();
  });

  it('does not render the keep practicing panel when no handler is provided', () => {
    render(<ReviewPage dueCards={[]} hasPracticed />);

    expect(screen.queryByText(/add more new words/i)).not.toBeInTheDocument();
  });
});

describe('KeepPracticingPanel', () => {
  it('hides itself when no onAddMoreNew handler is provided', () => {
    const { container } = render(<KeepPracticingPanel />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the Add more new words button when a handler is provided', async () => {
    const onAddMoreNew = vi.fn();
    render(<KeepPracticingPanel onAddMoreNew={onAddMoreNew} />);

    const btn = screen.getByRole('button', { name: /add more new words/i });
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);
    expect(onAddMoreNew).toHaveBeenCalledTimes(1);
  });

  it('disables the button while a mutation is pending', () => {
    render(<KeepPracticingPanel onAddMoreNew={vi.fn()} isAddMoreNewPending />);

    expect(
      screen.getByRole('button', { name: /add more new words/i }),
    ).toBeDisabled();
  });
});

describe('ReviewPage deck browse', () => {
  it('renders the word packs section heading and deck cards', () => {
    render(<ReviewPage dueCards={manyDueCards} decks={SAMPLE_DECKS} />);

    expect(
      screen.getByRole('heading', { name: /word packs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Everyday Essentials')).toBeInTheDocument();
    expect(screen.getByText('Common words for daily life')).toBeInTheDocument();
    expect(screen.getByText('120 words')).toBeInTheDocument();
  });

  it('shows a Subscribed badge instead of a subscribe button for subscribed decks', () => {
    render(<ReviewPage dueCards={manyDueCards} decks={SAMPLE_DECKS} />);

    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    // The un-subscribed deck still shows a Subscribe button.
    expect(
      screen.getByRole('button', { name: /subscribe/i }),
    ).toBeInTheDocument();
  });

  it('calls onSubscribeDeck when the Subscribe button is clicked', async () => {
    const onSubscribeDeck = vi.fn();

    render(
      <ReviewPage
        dueCards={manyDueCards}
        decks={SAMPLE_DECKS}
        onSubscribeDeck={onSubscribeDeck}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    expect(onSubscribeDeck).toHaveBeenCalledWith(1);
  });

  it('disables the Subscribe button while its deck subscription is pending', () => {
    render(
      <ReviewPage
        dueCards={manyDueCards}
        decks={SAMPLE_DECKS}
        subscribingDeckId={1}
        onSubscribeDeck={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /subscribe/i })).toBeDisabled();
  });

  it('shows studied progress text for decks with progress', () => {
    render(<ReviewPage dueCards={manyDueCards} decks={SAMPLE_DECKS} />);

    expect(screen.getByText('30 / 75 studied')).toBeInTheDocument();
  });

  it('renders the word packs section in the empty onboarding state', () => {
    render(<ReviewPage dueCards={[]} decks={SAMPLE_DECKS} />);

    expect(
      screen.getByRole('heading', { name: /word packs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Everyday Essentials')).toBeInTheDocument();
  });

  it('renders the word packs section in the caught-up state', () => {
    render(<ReviewPage dueCards={[]} hasPracticed decks={SAMPLE_DECKS} />);

    expect(
      screen.getByRole('heading', { name: /word packs/i }),
    ).toBeInTheDocument();
  });

  it('does not render the word packs section when there are no decks and not loading', () => {
    render(<ReviewPage dueCards={manyDueCards} decks={[]} />);

    expect(
      screen.queryByRole('heading', { name: /word packs/i }),
    ).not.toBeInTheDocument();
  });
});
