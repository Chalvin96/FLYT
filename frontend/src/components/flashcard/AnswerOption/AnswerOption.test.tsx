import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnswerOption } from './AnswerOption';

describe('AnswerOption', () => {
  it('test_answer_option_given_checked_expect_radio_semantics_with_aria_checked', () => {
    render(<AnswerOption checked label="god" marker="A" state="selected" />);

    expect(screen.getByRole('radio', { name: 'god' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('test_answer_option_given_aria_label_and_grade_expect_verdict_in_the_name', () => {
    render(
      <AnswerOption
        aria-label="god"
        checked
        disabled
        label={<em>god</em>}
        state="correct"
      />,
    );

    expect(
      screen.getByRole('radio', { name: 'god — correct' }),
    ).toBeInTheDocument();
  });

  it('test_answer_option_given_incorrect_grade_expect_verdict_in_the_name', () => {
    render(<AnswerOption checked disabled label="godt" state="incorrect" />);

    expect(
      screen.getByRole('radio', { name: /godt.*incorrect/ }),
    ).toBeInTheDocument();
  });

  it('test_answer_option_given_revealed_state_expect_neutral_feedback_visible', () => {
    render(
      <AnswerOption
        checked={false}
        detail="Common-gender singular noun."
        disabled
        label="god"
        marker="✓"
        state="revealed"
      />,
    );

    const option = screen.getByRole('radio', { name: /god.*common-gender/i });
    expect(option).toBeDisabled();
    expect(option).toHaveAttribute('data-state', 'revealed');
    expect(option).not.toHaveAccessibleName(/correct|incorrect/i);
    expect(screen.getByText(/common-gender/i)).toBeVisible();
  });

  it('test_answer_option_given_arrow_key_expect_key_down_delegated_to_group', () => {
    const onKeyDown = vi.fn();
    render(
      <AnswerOption
        checked={false}
        label="godt"
        onKeyDown={onKeyDown}
        state="idle"
      />,
    );

    fireEvent.keyDown(screen.getByRole('radio'), { key: 'ArrowDown' });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });
});
