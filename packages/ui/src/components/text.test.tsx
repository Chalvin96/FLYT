import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Text } from './text';
import {
  TEXT_BODY_SIZE,
  TEXT_SIZE,
  TEXT_WEIGHT,
  type TextSize,
} from './text-variants';

function leadingOf(classes: string) {
  return classes.split(' ').filter((entry) => entry.startsWith('leading-'));
}

describe('Text', () => {
  it('test_text_given_no_as_expect_paragraph', () => {
    render(<Text size="sm">Sentence</Text>);

    expect(screen.getByText('Sentence').tagName).toBe('P');
  });

  it('test_text_given_as_expect_requested_element_without_wrapper', () => {
    render(
      <>
        <Text as="h2" size="2xl">
          Heading
        </Text>
        <Text as="span" size="xs">
          Inline
        </Text>
        <Text as="legend" size="sm">
          Legend
        </Text>
      </>,
    );

    expect(screen.getByRole('heading', { level: 2 }).tagName).toBe('H2');
    expect(screen.getByText('Inline').tagName).toBe('SPAN');
    expect(screen.getByText('Legend').tagName).toBe('LEGEND');
  });

  it('test_text_given_cast_and_spread_expect_injected_class_rejected', () => {
    const injected = {
      className: 'INJECTED',
      style: { color: 'red' },
    } as unknown as Record<string, never>;
    render(
      <Text {...injected} data-testid="text" size="sm">
        Closed
      </Text>,
    );

    const text = screen.getByTestId('text');
    expect(text).not.toHaveClass('INJECTED');
    expect(text).not.toHaveStyle({ color: 'red' });
  });

  it('test_text_given_cast_and_spread_beside_a_breakpoint_step_expect_injected_class_rejected', () => {
    const injected = {
      className: 'INJECTED',
      style: { color: 'red' },
    } as unknown as Record<string, never>;
    render(
      <Text {...injected} data-testid="text" size="sm" smSize="base">
        Closed
      </Text>,
    );

    const text = screen.getByTestId('text');
    expect(text).not.toHaveClass('INJECTED');
    expect(text).not.toHaveStyle({ color: 'red' });
  });

  it('test_text_given_a_step_and_its_breakpoint_step_expect_both_reach_the_dom', () => {
    render(
      <Text size="sm" smSize="base">
        Sentence
      </Text>,
    );

    expect(screen.getByText('Sentence')).toHaveClass(
      'text-sm',
      'leading-normal',
      'sm:text-base',
      'sm:leading-relaxed',
    );
  });

  it('test_text_given_a_step_and_its_container_step_expect_both_reach_the_dom', () => {
    render(
      <Text containerSize="3xl" size="2xl">
        Svar
      </Text>,
    );

    expect(screen.getByText('Svar')).toHaveClass(
      'text-2xl',
      'leading-tight',
      '@2xl:text-3xl',
      '@2xl:leading-none',
    );
  });

  it('test_text_given_no_breakpoint_step_expect_the_step_alone', () => {
    render(<Text size="sm-copy">Reader rhythm</Text>);

    expect(screen.getByText('Reader rhythm').className).toBe(
      'text-sm leading-copy',
    );
  });

  it('test_text_given_each_size_expect_exactly_one_leading_of_its_own', () => {
    for (const size of Object.keys(TEXT_SIZE) as TextSize[]) {
      expect(leadingOf(TEXT_SIZE[size]), size).toHaveLength(1);
    }
  });

  it('test_text_given_each_body_size_expect_its_record_classes', () => {
    expect(TEXT_BODY_SIZE).toEqual({
      small: 'text-body-small',
      medium: 'text-body-medium',
      large: 'text-body-large',
      fluid: 'text-body-fluid',
    });
  });

  it('test_text_given_a_body_size_expect_the_composite_class', () => {
    render(<Text size="small">Added 3 days ago</Text>);

    expect(screen.getByText('Added 3 days ago').className).toBe(
      'text-body-small',
    );
  });

  it('test_text_given_the_large_body_size_expect_the_composite_class', () => {
    render(
      <Text size="large" lang="nb">
        Etter frokost tok familien toget.
      </Text>,
    );

    expect(
      screen.getByText('Etter frokost tok familien toget.').className,
    ).toBe('text-body-large');
  });

  it('test_text_given_the_fluid_body_size_expect_the_composite_class', () => {
    render(
      <Text size="fluid" lang="nb">
        Etter frokost tok familien toget.
      </Text>,
    );

    expect(
      screen.getByText('Etter frokost tok familien toget.').className,
    ).toBe('text-body-fluid');
  });

  it('test_text_given_distinct_sizes_expect_distinct_size_leading_pairs', () => {
    const pairs = Object.values(TEXT_SIZE).map((entry) =>
      entry.split(' ').sort().join(' '),
    );

    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('test_text_given_eyebrow_role_expect_shared_label_recipe', () => {
    render(
      <Text role="eyebrow" tone="subtle">
        Current streak
      </Text>,
    );

    expect(screen.getByText('Current streak').className).toBe(
      'text-subtle text-heading-xxsmall',
    );
  });

  it('test_text_given_display_role_expect_tracking_without_a_face', () => {
    render(
      <Text role="display" size="4xl">
        Flyt
      </Text>,
    );

    expect(screen.getByText('Flyt').className).toBe(
      'text-4xl leading-tight tracking-tight',
    );
  });

  it('test_text_given_prompt_role_expect_step_and_weight_only', () => {
    render(<Text role="prompt">Kven skriv boka</Text>);

    expect(screen.getByText('Kven skriv boka').className).toBe(
      'text-prompt leading-normal font-semibold',
    );
  });

  it('test_text_given_weight_beside_a_body_size_expect_caller_weight_wins', () => {
    render(
      <Text size="medium" weight="semibold">
        Your review queue is ready.
      </Text>,
    );

    expect(screen.getByText('Your review queue is ready.')).toHaveClass(
      'text-body-medium',
      'font-semibold',
    );
  });

  it('test_text_given_weight_beside_prompt_size_expect_caller_weight_wins', () => {
    render(
      <Text size="prompt" weight="normal">
        Kven skriv boka
      </Text>,
    );

    const prompt = screen.getByText('Kven skriv boka');
    expect(prompt).toHaveClass('font-normal');
    expect(prompt).not.toHaveClass('font-semibold');
  });

  it('test_text_given_explicit_size_beside_prompt_role_expect_size_wins', () => {
    render(
      <Text role="prompt" size="prompt-roomy">
        Kven skriv boka
      </Text>,
    );

    expect(screen.getByText('Kven skriv boka')).toHaveClass('leading-roomy');
  });

  it('test_text_given_no_size_expect_the_inherited_step_untouched', () => {
    render(<Text weight="semibold">Inline emphasis</Text>);

    expect(screen.getByText('Inline emphasis').className).toBe('font-semibold');
  });

  it('test_text_given_roomy_and_loose_sizes_expect_their_own_leading', () => {
    render(
      <Text size="sm-loose" data-testid="loose">
        Reader rhythm
      </Text>,
    );

    expect(screen.getByTestId('loose')).toHaveClass('text-sm', 'leading-loose');
  });

  it('test_text_given_explicit_size_beside_eyebrow_role_expect_size_wins', () => {
    render(
      <Text role="eyebrow" size="xs-none">
        Import
      </Text>,
    );

    const label = screen.getByText('Import');
    expect(label.className).toBe('text-xs leading-none font-semibold');
  });

  it('test_text_given_explicit_weight_beside_eyebrow_role_expect_weight_wins', () => {
    render(
      <Text role="eyebrow" weight="bold">
        Import
      </Text>,
    );

    expect(screen.getByText('Import')).toHaveClass(
      'font-bold',
      'text-heading-xxsmall',
    );
  });

  it('test_text_given_no_tone_expect_no_colour_utility', () => {
    render(<Text size="base">Inherits</Text>);

    expect(screen.getByText('Inherits').className).toBe(
      'text-base leading-relaxed',
    );
  });

  it('test_text_given_weight_and_font_expect_both_applied', () => {
    render(
      <Text font="mono" size="xs" weight="semibold">
        hus
      </Text>,
    );

    expect(screen.getByText('hus')).toHaveClass(
      'font-mono',
      'font-semibold',
      'text-xs',
    );
  });

  it('test_text_weight_given_scale_expect_only_token_weights', () => {
    expect(Object.values(TEXT_WEIGHT)).toEqual([
      'font-normal',
      'font-semibold',
      'font-bold',
    ]);
  });
});
