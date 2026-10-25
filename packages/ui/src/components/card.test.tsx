import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardFooter, CardTitle } from './card';
import { Row } from './row';

describe('Card', () => {
  it('test_card_given_no_padding_expect_default_inset_and_app_surface', () => {
    render(<Card data-testid="c">Body</Card>);

    const card = screen.getByTestId('c');
    expect(card).toHaveClass('radius-section');
    expect(card).toHaveClass('bg-raised');
    expect(card).toHaveClass('p-5');
  });

  it('test_card_given_each_padding_step_expect_matching_inset', () => {
    render(
      <>
        <Card data-testid="none" padding="none" />
        <Card data-testid="compact" padding="compact" />
        <Card data-testid="roomy" padding="roomy" />
      </>,
    );

    expect(screen.getByTestId('none')).toHaveClass('p-0');
    expect(screen.getByTestId('compact')).toHaveClass('p-4');
    expect(screen.getByTestId('roomy')).toHaveClass('p-6');
  });

  it('test_card_given_interactive_expect_group_hover_and_focus_treatment', () => {
    render(
      <Card clipContent data-testid="c" groupInteractive surface="solid" />,
    );

    const card = screen.getByTestId('c');
    expect(card).toHaveClass('overflow-hidden');
    expect(card).toHaveClass('bg-overlay');
    expect(card).toHaveClass('group-hover:border-selected');
  });

  it('test_row_given_single_row_clipped_card_expect_focus_ring_inside_row', () => {
    render(
      <Card clipContent padding="none">
        <Row insetFocusRing>Word</Row>
      </Card>,
    );

    const row = screen.getByRole('button', { name: 'Word' });
    row.focus();

    expect(row).toHaveFocus();
    expect(row).toHaveClass('focus-visible:ring-inset');
    expect(row).toHaveClass('focus-visible:ring-offset-0');
    expect(row).not.toHaveClass('focus-visible:ring-offset-2');
    expect(row).toHaveClass('focus-visible:ring-2');
    expect(row).toHaveClass('focus-visible:ring-[var(--border-focused)]');
  });

  it('test_card_parts_given_size_and_divided_props_expect_matching_classes', () => {
    render(
      <>
        <CardTitle data-testid="t" size="title" truncate>
          Chalvin
        </CardTitle>
        <CardFooter data-testid="f" divided />
      </>,
    );

    expect(screen.getByTestId('t')).toHaveClass('truncate');
    expect(screen.getByTestId('t')).toHaveClass('text-2xl leading-tight');
    expect(screen.getByTestId('f')).toHaveClass('border-t');
  });
});
