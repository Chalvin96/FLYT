import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExercisePrompt } from './ExercisePrompt';

describe('ExercisePrompt', () => {
  it('test_exercise_prompt_given_text_expect_h2_heading', () => {
    render(<ExercisePrompt>Hva betyr dette?</ExercisePrompt>);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Hva betyr dette?' }),
    ).toBeInTheDocument();
  });

  it('test_exercise_prompt_given_id_and_lang_expect_them_on_the_heading', () => {
    render(
      <ExercisePrompt id="prompt-1" lang="no">
        Kven skriv boka
      </ExercisePrompt>,
    );

    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Kven skriv boka',
    });
    expect(heading).toHaveAttribute('id', 'prompt-1');
    expect(heading).toHaveAttribute('lang', 'no');
  });
});
