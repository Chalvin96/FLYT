import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InlineTrigger } from './inline-trigger';

describe('InlineTrigger', () => {
  it('test_inline_trigger_given_current_token_expect_current_state_and_aria', () => {
    render(<InlineTrigger current>bok</InlineTrigger>);

    const trigger = screen.getByRole('button', { name: 'bok' });
    expect(trigger).toHaveAttribute('data-state', 'current');
    expect(trigger).toHaveAttribute('aria-current', 'true');
  });

  it('test_inline_trigger_given_resting_token_expect_idle_state_without_aria', () => {
    render(<InlineTrigger>bok</InlineTrigger>);

    const trigger = screen.getByRole('button', { name: 'bok' });
    expect(trigger).toHaveAttribute('data-state', 'idle');
    expect(trigger).not.toHaveAttribute('aria-current');
  });

  it('test_inline_trigger_given_no_explicit_type_expect_a_non_submitting_button', () => {
    render(<InlineTrigger>bok</InlineTrigger>);

    expect(screen.getByRole('button', { name: 'bok' })).toHaveAttribute(
      'type',
      'button',
    );
  });
});
