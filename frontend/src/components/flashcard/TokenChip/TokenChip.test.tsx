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
  });

  it('defaults to the idle state', () => {
    render(<TokenChip text="Jeg" />);
    const chip = screen.getByTestId('token-chip');
    expect(chip).toHaveAttribute('data-state', 'idle');
  });

  it('test_token_chip_given_every_state_expect_matching_state_attribute', () => {
    const states: TokenChipState[] = [
      'idle',
      'selected',
      'dragging',
      'correct',
      'incorrect',
      'fixed',
    ];

    for (const state of states) {
      const { unmount } = render(<TokenChip text="ord" state={state} />);
      expect(screen.getByTestId('token-chip')).toHaveAttribute(
        'data-state',
        state,
      );
      unmount();
    }
  });

  it.each([
    ['correct', 'correct'],
    ['incorrect', 'incorrect'],
  ] as Array<[TokenChipState, string]>)(
    'test_token_chip_given_graded_state_expect_announced_verdict',
    (state, verdict) => {
      render(<TokenChip state={state} text="ord" />);

      expect(screen.getByTestId('token-chip')).toHaveAccessibleName(
        new RegExp(verdict),
      );
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
