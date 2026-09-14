import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RatingButtons } from './RatingButtons';

describe('RatingButtons', () => {
  it('calls onRate with correct value when clicked', async () => {
    const onRate = vi.fn();
    render(<RatingButtons onRate={onRate} />);

    await userEvent.click(screen.getByRole('button', { name: /good/i }));
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('calls onRate when Again clicked', async () => {
    const onRate = vi.fn();
    render(<RatingButtons onRate={onRate} />);

    await userEvent.click(screen.getByRole('button', { name: /again/i }));
    expect(onRate).toHaveBeenCalledWith(1);
  });

  it('calls onRate when Hard clicked', async () => {
    const onRate = vi.fn();
    render(<RatingButtons onRate={onRate} />);

    await userEvent.click(screen.getByRole('button', { name: /hard/i }));
    expect(onRate).toHaveBeenCalledWith(2);
  });

  it('calls onRate when Easy clicked', async () => {
    const onRate = vi.fn();
    render(<RatingButtons onRate={onRate} />);

    await userEvent.click(screen.getByRole('button', { name: /easy/i }));
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it('disables all buttons when disabled prop is true', () => {
    render(<RatingButtons onRate={vi.fn()} disabled />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('test_rating_buttons_given_default_state_expect_accessible_rating_group', () => {
    render(<RatingButtons onRate={vi.fn()} />);

    expect(
      screen.getByRole('group', { name: 'Rate this card' }),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Again',
      'Hard',
      'Good',
      'Easy',
    ]);
    buttons.forEach((button) =>
      expect(button).toHaveAccessibleDescription(
        'Rate this card from 1 for Again to 4 for Easy.',
      ),
    );
  });

  it('renders the FSRS interval under each rating when previews are given', () => {
    render(
      <RatingButtons
        onRate={vi.fn()}
        previews={{ again: '1m', hard: '6m', good: '10m', easy: '4d' }}
      />,
    );

    expect(screen.getByText('1m')).toBeInTheDocument();
    expect(screen.getByText('10m')).toBeInTheDocument();
    expect(screen.getByText('4d')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /again, next in 1m/i }),
    ).toBeInTheDocument();
  });

  it('omits intervals when no previews are provided', () => {
    render(<RatingButtons onRate={vi.fn()} />);
    expect(screen.queryByText('1m')).not.toBeInTheDocument();
  });

  it('supports number shortcuts when the rating group is focused', async () => {
    const onRate = vi.fn();
    render(<RatingButtons onRate={onRate} />);

    await userEvent.click(screen.getByRole('button', { name: /again/i }));
    onRate.mockClear();
    await userEvent.keyboard('3');

    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('ignores number shortcuts when focus is outside the rating group', async () => {
    const onRate = vi.fn();
    render(
      <div>
        <input aria-label="Outside" />
        <RatingButtons onRate={onRate} />
      </div>,
    );

    await userEvent.click(screen.getByRole('textbox', { name: 'Outside' }));
    await userEvent.keyboard('2');

    expect(onRate).not.toHaveBeenCalled();
  });
});
