import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FlashCardLessonEnd } from './FlashCardLessonEnd';

describe('FlashCardLessonEnd', () => {
  it('test_lesson_end_given_no_action_expect_completion_message', () => {
    render(<FlashCardLessonEnd />);

    expect(screen.getByText('Lesson complete!')).toBeInTheDocument();
  });

  it('test_lesson_end_given_secondary_action_expect_caller_action_rendered', async () => {
    const user = userEvent.setup();
    const onSecondaryAction = vi.fn();
    render(
      <FlashCardLessonEnd
        onPrimaryAction={vi.fn()}
        secondaryAction={<button onClick={onSecondaryAction}>Close</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onSecondaryAction).toHaveBeenCalledOnce();
  });

  it('test_lesson_end_given_done_click_expect_primary_action_handler_called', async () => {
    const user = userEvent.setup();
    const onPrimaryAction = vi.fn();

    render(<FlashCardLessonEnd onPrimaryAction={onPrimaryAction} />);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onPrimaryAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('test_lesson_end_given_no_primary_action_handler_expect_no_done_button', () => {
    render(<FlashCardLessonEnd />);

    expect(
      screen.queryByRole('button', { name: 'Done' }),
    ).not.toBeInTheDocument();
  });
});
