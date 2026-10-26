import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('test_skeleton_given_no_variant_expect_text_line_form', () => {
    render(<Skeleton data-testid="s" />);

    const skeleton = screen.getByTestId('s');
    expect(skeleton).toHaveClass('h-[var(--skeleton-text-md)]');
    expect(skeleton).toHaveClass('bg-brand-subtle');
  });

  it('test_skeleton_given_length_prop_expect_matching_width', () => {
    render(
      <>
        <Skeleton data-testid="short" length="short" />
        <Skeleton data-testid="default" />
      </>,
    );

    const short = screen.getByTestId('short');
    expect(short).toHaveClass('w-[var(--skeleton-length-short)]');
    expect(short).not.toHaveClass('w-full');
    expect(screen.getByTestId('default')).toHaveClass('w-full');
  });

  it('test_skeleton_given_heading_or_control_variant_expect_matching_height', () => {
    render(
      <>
        <Skeleton data-testid="h" size="lg" variant="heading" />
        <Skeleton data-testid="c" shape="pill" variant="control" />
      </>,
    );

    expect(screen.getByTestId('h')).toHaveClass(
      'h-[var(--skeleton-heading-lg)]',
    );
    expect(screen.getByTestId('c')).toHaveClass('rounded-full');
  });

  it('test_skeleton_given_block_variant_expect_fills_caller_frame', () => {
    render(<Skeleton data-testid="s" shape="section" variant="block" />);

    const skeleton = screen.getByTestId('s');
    expect(skeleton).toHaveClass('size-full');
    expect(skeleton).toHaveClass('radius-section');
  });

  it('test_skeleton_given_default_render_expect_motion_safe_pulse', () => {
    render(<Skeleton data-testid="s" />);

    expect(screen.getByTestId('s')).toHaveClass('motion-safe:animate-pulse');
  });
});
