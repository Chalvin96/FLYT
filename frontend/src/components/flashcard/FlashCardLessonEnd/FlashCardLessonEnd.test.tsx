import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FlashCardLessonEnd } from './FlashCardLessonEnd';

describe('FlashCardLessonEnd', () => {
  it('renders the completion message', () => {
    render(<FlashCardLessonEnd />);

    expect(screen.getByText('Lesson complete!')).toBeInTheDocument();
  });

  it('renders the Finish button when onFinished is provided', () => {
    render(<FlashCardLessonEnd onFinished={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  it('calls onFinished when Finish is clicked', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();

    render(<FlashCardLessonEnd onFinished={onFinished} />);

    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it('does not render Finish button when onFinished is omitted', () => {
    render(<FlashCardLessonEnd />);

    expect(
      screen.queryByRole('button', { name: 'Finish' }),
    ).not.toBeInTheDocument();
  });
});
