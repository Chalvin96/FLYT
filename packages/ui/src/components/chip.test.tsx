import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './chip';

describe('Chip', () => {
  it('test_chip_given_no_pressed_prop_expect_no_aria_pressed_and_filter_surface', () => {
    render(<Chip>Show not-started cards</Chip>);

    const chip = screen.getByRole('button', { name: 'Show not-started cards' });
    expect(chip).toHaveAttribute('type', 'button');
    expect(chip).not.toHaveAttribute('aria-pressed');
    expect(chip).toHaveClass('bg-raised');
  });

  it('test_chip_given_pressed_expect_aria_pressed_true_and_pressed_surface', () => {
    render(<Chip pressed>Ready</Chip>);

    const chip = screen.getByRole('button', { name: 'Ready' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).toHaveAttribute('data-state', 'pressed');
    expect(chip).toHaveClass('aria-pressed:bg-neutral-bold');
  });

  it('test_chip_given_pressed_false_expect_aria_pressed_false', () => {
    render(<Chip pressed={false}>Failed</Chip>);

    const chip = screen.getByRole('button', { name: 'Failed' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip).toHaveAttribute('data-state', 'idle');
  });

  it('test_chip_given_suggestion_variant_expect_dashed_boundary', () => {
    render(<Chip variant="suggestion">Weekend in Bergen</Chip>);

    expect(
      screen.getByRole('button', { name: 'Weekend in Bergen' }),
    ).toHaveClass('border-dashed');
  });

  it('test_chip_given_removable_expect_hidden_glyph_and_forwarded_click', () => {
    const onClick = vi.fn();
    render(
      <Chip aria-label='Clear search "hus"' onClick={onClick} removable>
        "hus"
      </Chip>,
    );

    const chip = screen.getByRole('button', { name: 'Clear search "hus"' });
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('test_chip_given_suggestion_hover_expect_border_stays_dashed', () => {
    render(<Chip variant="suggestion">Weekend in Bergen</Chip>);

    expect(
      screen.getByRole('button', { name: 'Weekend in Bergen' }),
    ).not.toHaveClass('hover:border-solid');
  });
});
