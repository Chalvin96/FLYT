import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Heading } from './heading';

describe('Heading', () => {
  it('test_heading_given_no_as_expect_h2', () => {
    render(<Heading size="medium">Your words</Heading>);

    expect(screen.getByRole('heading', { level: 2 }).tagName).toBe('H2');
  });

  it('test_heading_given_as_expect_the_requested_element', () => {
    render(
      <>
        <Heading as="h1" size="large">
          Lesson complete
        </Heading>
        <Heading as="h3" size="small">
          Continue reading
        </Heading>
        <Heading as="div" size="xxsmall">
          Selected text
        </Heading>
      </>,
    );

    expect(screen.getByRole('heading', { level: 1 }).tagName).toBe('H1');
    expect(screen.getByRole('heading', { level: 3 }).tagName).toBe('H3');
    expect(screen.getByText('Selected text').tagName).toBe('DIV');
  });

  it('test_heading_given_each_size_expect_its_recipe', () => {
    render(
      <>
        <Heading data-testid="xxlarge" size="xxlarge">
          Title
        </Heading>
        <Heading data-testid="xlarge" size="xlarge">
          Title
        </Heading>
        <Heading data-testid="large" size="large">
          Title
        </Heading>
        <Heading data-testid="medium" size="medium">
          Title
        </Heading>
        <Heading data-testid="small" size="small">
          Title
        </Heading>
        <Heading data-testid="xsmall" size="xsmall">
          Title
        </Heading>
        <Heading data-testid="xxsmall" size="xxsmall">
          Title
        </Heading>
        <Heading data-testid="fluid" size="fluid">
          Title
        </Heading>
      </>,
    );

    expect(screen.getByTestId('xxlarge').className).toBe(
      'text-heading-xxlarge',
    );
    expect(screen.getByTestId('xlarge').className).toBe('text-heading-xlarge');
    expect(screen.getByTestId('large').className).toBe('text-heading-large');
    expect(screen.getByTestId('medium').className).toBe('text-heading-medium');
    expect(screen.getByTestId('small').className).toBe('text-heading-small');
    expect(screen.getByTestId('xsmall').className).toBe('text-heading-xsmall');
    expect(screen.getByTestId('xxsmall').className).toBe(
      'text-heading-xxsmall',
    );
    expect(screen.getByTestId('fluid').className).toBe('text-heading-fluid');
  });

  it('test_heading_given_the_xxsmall_size_expect_the_label_recipe', () => {
    render(
      <Heading as="div" size="xxsmall">
        Selected text
      </Heading>,
    );

    expect(screen.getByText('Selected text').className).toBe(
      'text-heading-xxsmall',
    );
  });

  it('test_heading_given_the_fluid_size_expect_the_general_heading_recipe', () => {
    render(<Heading size="fluid">Kven skriv boka</Heading>);

    expect(screen.getByText('Kven skriv boka').className).toBe(
      'text-heading-fluid',
    );
  });

  it('test_heading_given_tone_expect_the_text_tone', () => {
    render(
      <Heading data-testid="heading" size="medium" tone="subtle">
        Your words
      </Heading>,
    );

    expect(screen.getByTestId('heading')).toHaveClass('text-subtle');
  });

  it('test_heading_given_weight_beside_a_size_expect_caller_weight_wins', () => {
    render(
      <Heading data-testid="heading" size="xxlarge" weight="normal">
        Read Norwegian you love
      </Heading>,
    );

    const heading = screen.getByTestId('heading');
    expect(heading).toHaveClass('font-normal');
    expect(heading).not.toHaveClass('font-bold');
  });

  it('test_heading_given_cast_and_spread_expect_injected_class_rejected', () => {
    const injected = {
      className: 'INJECTED',
      style: { color: 'red' },
    } as unknown as Record<string, never>;
    render(
      <Heading {...injected} data-testid="heading" size="medium">
        Closed
      </Heading>,
    );

    const heading = screen.getByTestId('heading');
    expect(heading).not.toHaveClass('INJECTED');
    expect(heading).not.toHaveStyle({ color: 'red' });
  });
});
