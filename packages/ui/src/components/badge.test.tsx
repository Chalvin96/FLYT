import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('test_badge_given_no_tone_expect_neutral_surface', () => {
    render(<Badge>Verb</Badge>);

    const badge = screen.getByText('Verb');
    expect(badge).toHaveClass('bg-neutral-subtle');
  });

  it('test_badge_given_each_tone_expect_matching_colour_roles', () => {
    render(
      <>
        <Badge tone="brand">A2</Badge>
        <Badge tone="success">Ready</Badge>
        <Badge tone="warning">Unavailable</Badge>
        <Badge tone="danger">Failed</Badge>
      </>,
    );

    expect(screen.getByText('A2')).toHaveClass('bg-brand-subtle');
    expect(screen.getByText('Ready')).toHaveClass('bg-success-subtle');
    expect(screen.getByText('Unavailable')).toHaveClass('bg-warning-subtle');
    expect(screen.getByText('Failed')).toHaveClass('bg-danger-subtle');
  });

  it('test_badge_given_size_and_shape_props_expect_matching_geometry', () => {
    render(
      <>
        <Badge size="md">Medium</Badge>
        <Badge shape="pill">Pill</Badge>
      </>,
    );

    expect(screen.getByText('Medium')).toHaveClass('text-sm');
    expect(screen.getByText('Pill')).toHaveClass('rounded-full');
  });

  it('test_badge_given_eyebrow_expect_only_eyebrow_tone_and_typography', () => {
    render(<Badge eyebrow>Noun</Badge>);

    const eyebrow = screen.getByText('Noun');
    expect(eyebrow).toHaveClass('bg-overlay', 'text-heading-xxsmall');
    expect(eyebrow).not.toHaveClass('text-xs', 'font-semibold', 'font-bold');
  });
});
