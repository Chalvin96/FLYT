import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('test_button_given_no_variant_expect_primary_control_surface', () => {
    render(<Button>Continue</Button>);

    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass(
      'bg-brand-bold',
    );
  });

  it('test_button_given_outline_expect_strong_boundary_and_hover_fill', () => {
    render(<Button variant="outline">Review</Button>);

    const button = screen.getByRole('button', { name: 'Review' });
    expect(button).toHaveClass(
      'border-strong-hovered',
      'hover:bg-neutral-subtle',
    );
    expect(button).not.toHaveClass('border-strong');
    expect(button).not.toHaveClass('hover:border-strong-hovered');
  });

  it('test_button_given_as_child_expect_ref_forwarded_to_rendered_element', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Button asChild ref={ref as React.Ref<HTMLButtonElement>}>
        <a href="/lesson">Open lesson</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Open lesson' })).toBe(ref.current);
  });

  it('test_button_given_disabled_expect_disabled_surface_without_opacity', () => {
    render(<Button disabled>Unavailable</Button>);

    const button = screen.getByRole('button', { name: 'Unavailable' });
    expect(button).toBeDisabled();
    expect(button.className).not.toContain('opacity-50');
    expect(button).toHaveClass('disabled:bg-disabled');
  });

  it('test_button_given_spread_carrying_a_class_expect_the_recipe_to_survive', () => {
    // `Omit` only rejects a literal JSX attribute; a spread still carries the key.
    const injected = {
      className: 'INJECTED',
      style: { color: 'red' },
    } as unknown as Record<string, never>;
    render(<Button {...injected}>Spread</Button>);

    const button = screen.getByRole('button', { name: 'Spread' });
    expect(button.className).not.toContain('INJECTED');
    expect(button).not.toHaveAttribute('style');
    expect(button).toHaveClass('bg-brand-bold');
  });

  it('test_button_given_styled_as_child_expect_the_child_visuals_dropped', () => {
    render(
      <Button asChild>
        <a className="INJECTED" href="#somewhere" style={{ color: 'red' }}>
          Composed
        </a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Composed' });
    expect(link.className).not.toContain('INJECTED');
    expect(link).not.toHaveAttribute('style');
    expect(link).toHaveClass('bg-brand-bold');
  });

  it('test_button_given_icon_sm_size_expect_44px_touch_target', () => {
    render(
      <Button aria-label="Clear search" size="icon-sm" variant="ghost">
        <svg />
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Clear search' });
    expect(button).toHaveClass('size-8');
    expect(button).toHaveClass('after:-inset-1.5');
  });

  it('test_button_given_link_variant_with_pill_shape_expect_no_padding', () => {
    render(
      <Button shape="pill" variant="link">
        Read more
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Read more' });
    expect(button).toHaveClass('px-0');
    expect(button).not.toHaveClass('px-6');
  });

  it('test_button_given_width_full_expect_shrinkable_padding_and_wrapping_label', () => {
    render(<Button width="full">Again</Button>);

    const button = screen.getByRole('button', { name: 'Again' });
    expect(button).toHaveClass('px-2');
    expect(button).toHaveClass('whitespace-normal');
  });
});
