import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LookupProvider } from '@/components/lookup/LookupProvider';
import { useLookupContext } from '@/components/lookup/useLookupContext';

import { useCommandShortcut } from './useCommandShortcut';

interface RouterState {
  location: { pathname: string };
}

// Mock TanStack Router pathname for auto-close test.
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: RouterState) => string }) =>
    select({ location: { pathname: '/home' } }),
}));

function Probe() {
  useCommandShortcut();
  const ctx = useLookupContext();
  return (
    <div>
      <span data-testid="isOpen">{String(ctx.isOpen)}</span>
      <span data-testid="mode">{ctx.mode}</span>
    </div>
  );
}

describe('useCommandShortcut', () => {
  it('opens search mode when Cmd+K is pressed', async () => {
    render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('isOpen').textContent).toBe('true');
    expect(screen.getByTestId('mode').textContent).toBe('search');
  });

  it('opens search mode when Ctrl+K is pressed', async () => {
    render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('isOpen').textContent).toBe('true');
    expect(screen.getByTestId('mode').textContent).toBe('search');
  });

  it('ignores Cmd+K when focus is in an input element', async () => {
    render(
      <LookupProvider>
        <input type="text" data-testid="input" />
        <Probe />
      </LookupProvider>,
    );

    const input = screen.getByTestId('input') as HTMLInputElement;
    input.focus();

    await act(async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('isOpen').textContent).toBe('false');
  });

  it('ignores Cmd+K when focus is in a textarea element', async () => {
    render(
      <LookupProvider>
        <textarea data-testid="textarea" />
        <Probe />
      </LookupProvider>,
    );

    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    textarea.focus();

    await act(async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('isOpen').textContent).toBe('false');
  });

  it('ignores Cmd+K when document focus cannot be determined (falsy guard)', async () => {
    render(
      <LookupProvider>
        <Probe />
      </LookupProvider>,
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    });

    expect(screen.getByTestId('isOpen').textContent).toBe('true');
    expect(screen.getByTestId('mode').textContent).toBe('search');
  });
});
