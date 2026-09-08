import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LookupProvider } from './LookupProvider';
import { useLookupContext } from './useLookupContext';

interface RouterState {
  location: { pathname: string; search: Record<string, unknown> };
}

// Mock TanStack Router pathname for auto-close test.
const mockLocation = {
  pathname: '/home',
  search: {} as Record<string, unknown>,
};
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: RouterState) => unknown }) =>
    select({ location: mockLocation }),
}));

function Probe() {
  const ctx = useLookupContext();
  return (
    <div>
      <span data-testid="isOpen">{String(ctx.isOpen)}</span>
      <span data-testid="mode">{ctx.mode}</span>
      <span data-testid="word">{ctx.lemmaTarget?.wordText ?? ''}</span>
      <span data-testid="prior">{ctx.priorQuery ?? ''}</span>
      <button onClick={() => ctx.openLemma('uuid-1', 'hus')}>openLemma</button>
      <button onClick={() => ctx.openSearch('hu')}>openSearch</button>
      <button onClick={ctx.switchToSearch}>switchToSearch</button>
      <button onClick={() => ctx.switchToLemma('uuid-2', 'huset')}>
        switchToLemma
      </button>
      <button onClick={ctx.close}>close</button>
    </div>
  );
}

describe('LookupProvider', () => {
  beforeEach(() => {
    mockLocation.pathname = '/home';
    mockLocation.search = {};
  });

  it('test_open_lemma_given_lemma_target_expect_lookup_state', () => {
    render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );
    fireEvent.click(screen.getByText('openLemma'));
    expect(screen.getByTestId('isOpen').textContent).toBe('true');
    expect(screen.getByTestId('mode').textContent).toBe('lemma');
    expect(screen.getByTestId('word').textContent).toBe('hus');
  });

  it('test_open_search_given_query_expect_search_mode', () => {
    render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );
    fireEvent.click(screen.getByText('openSearch'));
    expect(screen.getByTestId('mode').textContent).toBe('search');
  });

  it('test_switch_to_search_given_prior_query_expect_query_preserved', () => {
    render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );
    fireEvent.click(screen.getByText('openSearch'));
    fireEvent.click(screen.getByText('switchToLemma'));
    expect(screen.getByTestId('mode').textContent).toBe('lemma');
    fireEvent.click(screen.getByText('switchToSearch'));
    expect(screen.getByTestId('mode').textContent).toBe('search');
    expect(screen.getByTestId('prior').textContent).toBe('hu');
  });

  it('test_close_given_open_lookup_expect_closed_state', () => {
    render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );
    fireEvent.click(screen.getByText('openLemma'));
    fireEvent.click(screen.getByText('close'));
    expect(screen.getByTestId('isOpen').textContent).toBe('false');
  });

  it('throws when useLookupContext used outside provider', () => {
    expect(() => render(<Probe />)).toThrow();
  });

  it('closes the sheet when pathname changes', () => {
    const { rerender } = render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );
    fireEvent.click(screen.getByText('openLemma'));
    expect(screen.getByTestId('isOpen').textContent).toBe('true');

    // Change the pathname
    mockLocation.pathname = '/lesson';
    rerender(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );

    expect(screen.getByTestId('isOpen').textContent).toBe('false');
  });

  it('keeps lookup open when navigating to home with a lookup param', () => {
    mockLocation.pathname = '/reading';
    const { rerender } = render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );
    fireEvent.click(screen.getByText('openSearch'));
    expect(screen.getByTestId('isOpen').textContent).toBe('true');

    mockLocation.pathname = '/home';
    mockLocation.search = { lookup: 'kaffe' };
    rerender(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );

    expect(screen.getByTestId('isOpen').textContent).toBe('true');
  });
});
