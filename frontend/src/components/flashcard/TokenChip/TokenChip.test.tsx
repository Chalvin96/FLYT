import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TokenChip, type TokenChipState } from './TokenChip';

describe('TokenChip', () => {
  it('renders the text with lang="no"', () => {
    render(<TokenChip text="snakker" />);
    const word = screen.getByText('snakker');
    expect(word).toBeInTheDocument();
    expect(word).toHaveAttribute('lang', 'no');
    expect(word).toHaveClass('whitespace-normal', 'break-words', 'min-w-0');
  });

  it('defaults to the idle state', () => {
    render(<TokenChip text="Jeg" />);
    const chip = screen.getByTestId('token-chip');
    expect(chip).toHaveAttribute('data-state', 'idle');
    expect(chip).toHaveClass('bg-card', 'text-foreground');
  });

  it.each([
    ['idle', ['bg-card', 'text-foreground', 'border-border', 'shadow-tile']],
    ['selected', ['bg-primary-5', 'border-primary-60', 'shadow-tile']],
    ['dragging', ['bg-primary-5', 'border-primary-60', 'shadow-lift']],
    ['correct', ['bg-primary-5', 'text-primary-90', 'border-primary-30']],
    [
      'wrong',
      ['bg-destructive-10', 'text-destructive-90', 'border-destructive-40'],
    ],
    ['fixed', ['bg-secondary-10', 'text-muted-foreground']],
  ] as Array<[TokenChipState, string[]]>)(
    'applies the expected tokens for the %s state',
    (state, expectedClasses) => {
      render(<TokenChip text="ord" state={state} />);
      const chip = screen.getByTestId('token-chip');
      for (const cls of expectedClasses) {
        expect(chip).toHaveClass(cls);
      }
    },
  );

  it('renders as a focusable button for interactive states', () => {
    render(<TokenChip text="snakker" state="idle" />);
    const chip = screen.getByTestId('token-chip');
    expect(chip.tagName).toBe('BUTTON');
    expect(chip).toHaveAttribute('type', 'button');
  });

  it('fires onClick when interactive', async () => {
    const onClick = vi.fn();
    render(<TokenChip text="snakker" onClick={onClick} />);
    await userEvent.click(screen.getByTestId('token-chip'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<TokenChip text="snakker" disabled onClick={onClick} />);
    await userEvent.click(screen.getByTestId('token-chip'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a non-interactive span when state is "fixed"', () => {
    const onClick = vi.fn();
    render(<TokenChip text="snakker" state="fixed" onClick={onClick} />);
    const chip = screen.getByTestId('token-chip');
    expect(chip.tagName).toBe('SPAN');
    expect(chip).toHaveAttribute('data-state', 'fixed');
    expect(chip).not.toHaveAttribute('disabled');
  });

  it('does not fire onClick when fixed', async () => {
    const onClick = vi.fn();
    render(<TokenChip text="snakker" state="fixed" onClick={onClick} />);
    await userEvent.click(screen.getByTestId('token-chip'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('supports aria-pressed passthrough', () => {
    render(<TokenChip text="snakker" aria-pressed />);
    expect(screen.getByTestId('token-chip')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('supports a forwarded ref', () => {
    const ref = vi.fn();
    render(<TokenChip text="snakker" ref={ref} />);
    expect(ref).toHaveBeenCalledWith(
      expect.objectContaining({ tagName: 'BUTTON' }),
    );
  });

  it('supports keyboard focus and activation', async () => {
    const onClick = vi.fn();
    render(<TokenChip text="snakker" onClick={onClick} />);
    const chip = screen.getByTestId('token-chip');
    chip.focus();
    expect(chip).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });
});
