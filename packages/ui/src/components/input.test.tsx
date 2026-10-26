import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it.each(['default', 'solid'] as const)(
    'test_input_given_editable_presentation_expect_strong_boundary',
    (presentation) => {
      render(<Input aria-label="Topic" presentation={presentation} />);

      const input = screen.getByLabelText('Topic');
      expect(input).toHaveClass('border-strong-hovered');
      expect(input).not.toHaveClass('border-strong');
    },
  );

  it('test_input_given_no_size_expect_default_field_height', () => {
    render(<Input aria-label="Topic" />);

    expect(screen.getByLabelText('Topic')).toHaveClass('h-9');
  });

  it('test_input_given_lg_size_expect_taller_field_height', () => {
    render(<Input aria-label="Display name" size="lg" />);

    expect(screen.getByLabelText('Display name')).toHaveClass('h-11');
  });

  it('test_input_given_quiet_without_read_only_expect_semantically_read_only_and_unchanged', async () => {
    const user = userEvent.setup();
    render(
      <Input
        presentation="quiet"
        aria-label="Display name"
        defaultValue="Ada"
      />,
    );

    const input = screen.getByLabelText('Display name');
    expect(input).toHaveClass('cursor-default');
    expect(input).toHaveClass('focus-visible:ring-0');
    expect(input).toHaveAttribute('readonly');

    await user.type(input, ' Lovelace');

    expect(input).toHaveValue('Ada');
  });
});
