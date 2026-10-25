import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Glyph } from './glyph';
import { GLYPH_SIZE, type GlyphSize } from './text-variants';

describe('Glyph', () => {
  it('test_glyph_given_no_aria_hidden_expect_mark_hidden_from_the_tree', () => {
    render(<Glyph data-testid="glyph">▼</Glyph>);

    expect(screen.getByTestId('glyph')).toHaveAttribute('aria-hidden', 'true');
  });

  it('test_glyph_given_explicit_aria_hidden_false_expect_visible_mark', () => {
    render(
      <Glyph aria-hidden={false} data-testid="glyph">
        *
      </Glyph>,
    );

    expect(screen.getByTestId('glyph')).toHaveAttribute('aria-hidden', 'false');
  });

  it('test_glyph_given_size_expect_the_step_reaches_the_dom', () => {
    render(
      <Glyph data-testid="glyph" size="3xs">
        ▼
      </Glyph>,
    );

    expect(screen.getByTestId('glyph')).toHaveClass(
      'text-[10px]',
      'leading-none',
    );
  });

  it('test_glyph_given_font_and_weight_expect_both_applied', () => {
    render(
      <Glyph data-testid="glyph" font="mono" size="4xs" weight="semibold">
        T1
      </Glyph>,
    );

    expect(screen.getByTestId('glyph')).toHaveClass(
      'text-[9px]',
      'font-mono',
      'font-semibold',
    );
  });

  it('test_glyph_given_cast_and_spread_expect_injected_class_rejected', () => {
    const injected = {
      className: 'INJECTED',
      style: { color: 'red' },
    } as unknown as Record<string, never>;
    render(
      <Glyph {...injected} data-testid="glyph" size="3xs">
        ▼
      </Glyph>,
    );

    const glyph = screen.getByTestId('glyph');
    expect(glyph).not.toHaveClass('INJECTED');
    expect(glyph).not.toHaveStyle({ color: 'red' });
  });

  it('test_glyph_given_each_size_expect_exactly_one_leading_none', () => {
    for (const size of Object.keys(GLYPH_SIZE) as GlyphSize[]) {
      const leadings = GLYPH_SIZE[size]
        .split(' ')
        .filter((entry) => entry.startsWith('leading-'));

      expect(leadings, size).toEqual(['leading-none']);
    }
  });
});
