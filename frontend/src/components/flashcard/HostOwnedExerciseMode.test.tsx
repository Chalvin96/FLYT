import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { K_RATING_HARD } from '@/lib/fsrsRatings';
import { buildLessonExerciseAdapter } from '@/pages/LessonDetailPage/lessonExerciseAdapter';
import { buildReviewExerciseAdapter } from '@/pages/ReviewSessionPage/reviewExerciseAdapter';
import type { UserCard } from '@/types/api';
import {
  LESSON_PACKET_SCHEMA_VERSION,
  type Exercise,
} from '@/types/lesson-contracts';

import { ExerciseHost } from './ExerciseHost';

function buildReviewCard(exercise: Exercise): UserCard {
  return {
    id: 1,
    user_id: 1,
    pool_id: 1,
    due_at: '2026-01-01T00:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    review_version: 0,
    last_review_at: null,
    state: 'review',
    card: {
      id: 1,
      deck_id: 1,
      schema_version: LESSON_PACKET_SCHEMA_VERSION,
      type: exercise.operation,
      payload: exercise,
    },
  };
}

function buildLessonAdapter(exercise: Exercise) {
  return buildLessonExerciseAdapter({
    exercise,
    lessonId: 1,
    schemaVersion: LESSON_PACKET_SCHEMA_VERSION,
    onUnsupported: vi.fn(),
  });
}

function buildReviewAdapter(exercise: Exercise) {
  return buildReviewExerciseAdapter({
    card: buildReviewCard(exercise),
    submitOutcome: vi.fn().mockResolvedValue(true),
  });
}

const cases: {
  name: string;
  exercise: Exercise;
  role: 'button' | 'radio';
  right: string;
  wrong: string;
}[] = [
  {
    name: 'Choose',
    exercise: {
      kind: 'exercise',
      objective_id: 'choice-mode',
      id: 'choose-mode',
      operation: 'choose',
      prompt: [{ kind: 'text', value: 'Choose the word.' }],
      explanation: [{ kind: 'text', value: 'Use the present tense.' }],
      payload: {
        answer_id: 'right',
        options: [
          { option_id: 'right', text: 'snakker' },
          { option_id: 'wrong', text: 'snakke' },
        ],
      },
    },
    role: 'radio',
    right: 'snakker',
    wrong: 'snakke',
  },
  {
    name: 'Judge',
    exercise: {
      kind: 'exercise',
      objective_id: 'choice-mode',
      id: 'judge-mode',
      operation: 'judge',
      prompt: [{ kind: 'text', value: 'Judge the sentence.' }],
      explanation: [{ kind: 'text', value: 'The sentence has an error.' }],
      payload: {
        sentence: [{ kind: 'text', value: 'Jeg går bil.' }],
        is_correct: false,
        feedback: 'Jeg kjører bil.',
      },
    },
    role: 'radio',
    right: 'It has an error',
    wrong: 'The sentence is correct',
  },
  {
    name: 'RecallFill',
    exercise: {
      kind: 'exercise',
      objective_id: 'choice-mode',
      id: 'recall-mode',
      operation: 'recall_fill',
      prompt: [{ kind: 'text', value: 'Choose the form.' }],
      explanation: [{ kind: 'text', value: 'Use the present tense.' }],
      payload: {
        segments: [
          { kind: 'span', spans: [{ kind: 'text', value: 'Jeg ' }] },
          {
            kind: 'blank',
            blank_id: 'verb',
            options: ['leser', 'lese'],
            answer_index: 0,
          },
        ],
      },
    },
    role: 'radio',
    right: 'leser',
    wrong: 'lese',
  },
  {
    name: 'FindFix',
    exercise: {
      kind: 'exercise',
      objective_id: 'choice-mode',
      id: 'find-mode',
      operation: 'find_fix',
      prompt: [{ kind: 'text', value: 'Find the error.' }],
      explanation: [{ kind: 'text', value: 'The verb is wrong.' }],
      payload: {
        tokens: [
          { token_id: 'right', text: 'bil' },
          { token_id: 'wrong', text: 'går' },
        ],
        error_token_id: 'right',
        feedback: 'Jeg kjører bil.',
      },
    },
    role: 'button',
    right: 'bil',
    wrong: 'går',
  },
];

describe.each(cases)('$name host mode', ({ exercise, role, right, wrong }) => {
  it('test_choice_exercise_given_lesson_wrong_then_right_expect_retry_completion', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <ExerciseHost
        adapter={buildLessonAdapter(exercise)}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole(role, { name: wrong }));
    await user.click(screen.getByRole('button', { name: /check/i }));

    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
    expect(screen.queryByTestId('exercise-explanation')).toBeNull();

    await user.click(screen.getByRole(role, { name: right }));
    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: true }),
    );
  });

  it('test_choice_exercise_given_review_wrong_expect_committed_completion', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <ExerciseHost
        adapter={buildReviewAdapter(exercise)}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole(role, { name: wrong }));
    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });

  it('test_choice_exercise_given_lesson_reveal_before_any_check_expect_incorrect_outcome', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <ExerciseHost
        adapter={buildLessonAdapter(exercise)}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });

  it('test_choice_exercise_given_lesson_wrong_then_reveal_expect_incorrect_outcome', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(
      <ExerciseHost
        adapter={buildLessonAdapter(exercise)}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole(role, { name: wrong }));
    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'graded', correct: false }),
    );
  });
});

describe('RecallFill lesson reveal', () => {
  it('test_recall_fill_exercise_given_lesson_half_filled_reveal_expect_incorrect_hard_outcome', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn();
    const exercise = {
      kind: 'exercise',
      objective_id: 'choice-mode',
      id: 'recall-two-blanks',
      operation: 'recall_fill',
      prompt: [{ kind: 'text', value: 'Choose the forms.' }],
      explanation: [{ kind: 'text', value: 'Use the present tense.' }],
      payload: {
        segments: [
          { kind: 'span', spans: [{ kind: 'text', value: 'Jeg ' }] },
          {
            kind: 'blank',
            blank_id: 'verb',
            options: ['leser', 'lese'],
            answer_index: 0,
          },
          { kind: 'span', spans: [{ kind: 'text', value: ' ' }] },
          {
            kind: 'blank',
            blank_id: 'article',
            options: ['boka', 'boken'],
            answer_index: 1,
          },
        ],
      },
    } satisfies Extract<Exercise, { operation: 'recall_fill' }>;

    render(
      <ExerciseHost
        adapter={buildLessonAdapter(exercise)}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'leser' }));
    await user.click(screen.getByRole('radio', { name: 'boka' }));
    await user.click(screen.getByRole('button', { name: /check/i }));
    await user.click(screen.getByRole('button', { name: /reveal answer/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: false,
      rating: K_RATING_HARD,
    });
  });
});
