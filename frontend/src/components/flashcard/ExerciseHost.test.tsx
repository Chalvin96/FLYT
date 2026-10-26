import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildLessonExerciseAdapter } from '@/pages/LessonDetailPage/lessonExerciseAdapter';
import { buildReviewExerciseAdapter } from '@/pages/ReviewSessionPage/reviewExerciseAdapter';
import { server } from '@/test/msw/server';
import type { UserCard } from '@/types/api';
import {
  LESSON_PACKET_SCHEMA_VERSION,
  type ChooseExercise,
  type Exercise,
  type WriteExercise,
} from '@/types/lesson-contracts';

import type { ExerciseHostAdapter } from './exerciseAdapter';
import { ExerciseHost } from './ExerciseHost';

const chooseExercise: ChooseExercise = {
  kind: 'exercise',
  id: 'choose-1',
  operation: 'choose',
  objective_id: 'objective-1',
  prompt: [{ kind: 'text', value: 'Choose one.' }],
  explanation: null,
  payload: {
    options: [
      { option_id: 'one', text: 'One' },
      { option_id: 'two', text: 'Two' },
    ],
    answer_id: 'one',
  },
};

const writeExercise: WriteExercise = {
  kind: 'exercise',
  id: 'write-1',
  operation: 'write',
  objective_id: 'objective-1',
  prompt: [{ kind: 'text', value: 'Write one sentence.' }],
  explanation: null,
  payload: {
    response_language: 'no',
    criteria: [{ id: 'criterion-1', instruction: 'Write a sentence.' }],
  },
};

function buildReviewCard(
  exercise: Exercise,
  schemaVersion: string = LESSON_PACKET_SCHEMA_VERSION,
): UserCard {
  return {
    id: 7,
    user_id: 9,
    pool_id: 7,
    lesson_id: 43,
    due_at: '2026-01-01T00:00:00Z',
    fsrs_difficulty: null,
    fsrs_stability: null,
    fsrs_step: null,
    review_version: 0,
    last_review_at: null,
    state: 'review',
    card: {
      id: 11,
      deck_id: 1,
      type: exercise.operation,
      schema_version: schemaVersion,
      payload: exercise,
    },
  };
}

function buildLessonAdapter(exercise: Exercise, onUnsupported = vi.fn()) {
  return buildLessonExerciseAdapter({
    exercise,
    lessonId: 42,
    schemaVersion: LESSON_PACKET_SCHEMA_VERSION,
    userId: 9,
    onUnsupported,
  });
}

function buildReviewAdapter(
  exercise: Exercise,
  schemaVersion: string = LESSON_PACKET_SCHEMA_VERSION,
) {
  return buildReviewExerciseAdapter({
    card: buildReviewCard(exercise, schemaVersion),
    submitOutcome: vi.fn().mockResolvedValue(true),
  });
}

function installJudgeWriteHandler() {
  const requests: Array<{
    lessonId: string;
    exerciseId: string;
    body: unknown;
  }> = [];
  server.use(
    http.post(
      '*/lessons/:lessonId/exercises/:exerciseId/judge-write',
      async ({ params, request }) => {
        requests.push({
          lessonId: String(params.lessonId),
          exerciseId: String(params.exerciseId),
          body: await request.json(),
        });
        return HttpResponse.json({
          criteria: [
            { criterion_id: 'criterion-1', met: true, evidence: null },
          ],
        });
      },
    ),
  );
  return requests;
}

async function runExerciseScenario(
  chooseAdapter: ExerciseHostAdapter,
  writeAdapter: ExerciseHostAdapter,
  expectedLessonId: string,
  expectedDraftScope: string,
) {
  const user = userEvent.setup();
  const requests = installJudgeWriteHandler();
  const chooseFinished = vi.fn();
  const view = render(
    <ExerciseHost adapter={chooseAdapter} onFinished={chooseFinished} />,
  );

  await user.click(screen.getByRole('radio', { name: 'One' }));
  await user.click(screen.getByRole('button', { name: /^check$/i }));
  await user.click(screen.getByRole('button', { name: /^continue$/i }));
  expect(chooseFinished).toHaveBeenCalledOnce();
  expect(requests).toEqual([]);

  view.unmount();
  const writeFinished = vi.fn();
  render(<ExerciseHost adapter={writeAdapter} onFinished={writeFinished} />);

  await user.type(screen.getByRole('textbox'), 'Jeg lærer norsk.');
  expect(
    localStorage.getItem(`flyt.write.draft.${expectedDraftScope}.write-1`),
  ).toBe('Jeg lærer norsk.');
  await user.click(screen.getByRole('button', { name: /^check$/i }));
  await waitFor(() => {
    expect(requests).toEqual([
      {
        lessonId: expectedLessonId,
        exerciseId: 'write-1',
        body: { response: 'Jeg lærer norsk.' },
      },
    ]);
  });
  await user.click(await screen.findByRole('button', { name: /^continue$/i }));
  expect(writeFinished).toHaveBeenCalledWith({
    kind: 'graded',
    correct: true,
    rating: 4,
  });
}

describe('ExerciseHost', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('test_lesson_adapter_given_choose_and_write_expect_only_write_judged_by_lesson_endpoint', async () => {
    await runExerciseScenario(
      buildLessonAdapter(chooseExercise),
      buildLessonAdapter(writeExercise),
      '42',
      'user-9-lesson-42',
    );
  });

  it('test_review_adapter_given_choose_and_write_expect_only_write_judged_by_card_lesson_endpoint', async () => {
    await runExerciseScenario(
      buildReviewAdapter(chooseExercise),
      buildReviewAdapter(writeExercise),
      '43',
      'user-9-card-7',
    );
  });

  it('test_review_card_given_supported_schema_expect_rendered_exercise', () => {
    render(
      <ExerciseHost
        adapter={buildReviewAdapter(chooseExercise)}
        onFinished={vi.fn()}
      />,
    );

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(
      screen.queryByText('Unsupported lesson step'),
    ).not.toBeInTheDocument();
  });

  it('test_lesson_adapter_given_unknown_operation_expect_fallback_and_continue', async () => {
    const onUnsupported = vi.fn();
    const exercise = {
      ...chooseExercise,
      operation: 'unknown_operation',
    } as unknown as Exercise;
    render(
      <ExerciseHost adapter={buildLessonAdapter(exercise, onUnsupported)} />,
    );

    expect(screen.getByText('Unsupported lesson step')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onUnsupported).toHaveBeenCalledOnce();
  });

  it('test_review_write_given_empty_new_draft_expect_legacy_draft_migrated', () => {
    const newKey = 'flyt.write.draft.user-9-card-7.write-1';
    const legacyKey = 'flyt.write.draft.9-card-7.write-1';
    localStorage.setItem(newKey, '');
    localStorage.setItem(legacyKey, 'Jeg lærer norsk.');

    render(<ExerciseHost adapter={buildReviewAdapter(writeExercise)} />);

    expect(screen.getByRole('textbox')).toHaveValue('Jeg lærer norsk.');
    expect(localStorage.getItem(newKey)).toBe('Jeg lærer norsk.');
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it('test_review_write_given_card_without_user_id_expect_anonymous_legacy_draft_restored', () => {
    const card = buildReviewCard(writeExercise);
    Reflect.deleteProperty(card, 'user_id');
    const newKey = 'flyt.write.draft.user-anonymous-card-7.write-1';
    const legacyKey = 'flyt.write.draft.anonymous-card-7.write-1';
    localStorage.setItem(legacyKey, 'Jeg lærer norsk.');

    render(
      <ExerciseHost
        adapter={buildReviewExerciseAdapter({ card, submitOutcome: vi.fn() })}
      />,
    );

    expect(screen.getByRole('textbox')).toHaveValue('Jeg lærer norsk.');
    expect(localStorage.getItem(newKey)).toBe('Jeg lærer norsk.');
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });
});
