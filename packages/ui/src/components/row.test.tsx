import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Row } from './row';

describe('Row', () => {
  it('test_row_given_unavailable_expect_own_surface_without_opacity', () => {
    render(<Row aria-disabled="true">Unavailable pill</Row>);

    const row = screen.getByRole('button', { name: 'Unavailable pill' });
    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row).toHaveClass('aria-disabled:bg-neutral');
    expect(row).toHaveClass('aria-disabled:text-subtle');
    expect(row).not.toHaveClass('opacity-45');
  });

  it('test_row_given_selected_expect_selected_state', () => {
    render(<Row selected>Selected row</Row>);

    expect(
      screen.getByRole('button', { name: 'Selected row' }),
    ).toHaveAttribute('data-state', 'selected');
  });

  it('test_row_given_unselected_expect_idle_state', () => {
    render(<Row selected={false}>Idle row</Row>);

    expect(screen.getByRole('button', { name: 'Idle row' })).toHaveAttribute(
      'data-state',
      'idle',
    );
  });

  it('test_row_given_selection_unknown_expect_no_state_attribute', () => {
    render(<Row>Stateless row</Row>);

    expect(
      screen.getByRole('button', { name: 'Stateless row' }),
    ).not.toHaveAttribute('data-state');
  });

  it('test_row_given_unselected_plain_expect_hover_lighter_than_selected_surface', () => {
    render(<Row selected={false}>Plain row</Row>);

    const row = screen.getByRole('button', { name: 'Plain row' });
    expect(row).toHaveClass('hover:bg-neutral');
    expect(row).not.toHaveClass('bg-neutral-subtle');
  });

  it('test_row_given_selected_plain_expect_selected_surface_holds_on_hover', () => {
    render(<Row selected>Plain row</Row>);

    const row = screen.getByRole('button', { name: 'Plain row' });
    expect(row).toHaveClass('bg-neutral-subtle');
    expect(row).toHaveClass('text-default');
    expect(row).toHaveClass('hover:bg-neutral-subtle');
  });

  it('test_row_given_busy_expect_wait_treatment', () => {
    render(<Row aria-busy="true">Loading row</Row>);

    const row = screen.getByRole('button', { name: 'Loading row' });
    expect(row).toHaveClass('aria-busy:cursor-wait');
    expect(row).toHaveClass('aria-busy:bg-neutral-subtle');
    expect(row).toHaveClass('aria-busy:text-subtle');
  });
});
