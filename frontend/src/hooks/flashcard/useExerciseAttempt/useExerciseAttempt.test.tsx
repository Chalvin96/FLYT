import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ratingFromResult,
  type OperationResult,
  type Rating,
} from '@/lib/operationResult';

import { useExerciseAttempt } from './useExerciseAttempt';

type Action =
  | { kind: 'right' }
  | { kind: 'wrong' }
  | { kind: 'reveal'; fraction: number }
  | { kind: 'rate'; rating: Rating };

type Scenario = {
  name: string;
  allowRetry: boolean;
  commitGradesAtCompletion?: boolean;
  actions: Action[];
  expectedResult: OperationResult;
  expectedRating: number;
};

const scenarios: Scenario[] = [
  {
    name: 'test_exercise_attempt_given_retry_first_right_expect_easy',
    allowRetry: true,
    actions: [{ kind: 'right' }],
    expectedResult: { correct: true, rating: 4 },
    expectedRating: 4,
  },
  {
    name: 'test_exercise_attempt_given_retry_one_wrong_then_right_expect_hard',
    allowRetry: true,
    actions: [{ kind: 'wrong' }, { kind: 'right' }],
    expectedResult: { correct: true, rating: 2 },
    expectedRating: 2,
  },
  {
    name: 'test_exercise_attempt_given_retry_three_wrong_then_right_expect_hard',
    allowRetry: true,
    actions: [
      { kind: 'wrong' },
      { kind: 'wrong' },
      { kind: 'wrong' },
      { kind: 'right' },
    ],
    expectedResult: { correct: true, rating: 2 },
    expectedRating: 2,
  },
  {
    name: 'test_exercise_attempt_given_retry_reveal_below_half_expect_incorrect_again',
    allowRetry: true,
    actions: [{ kind: 'wrong' }, { kind: 'reveal', fraction: 0.49 }],
    expectedResult: { correct: false, rating: 1 },
    expectedRating: 1,
  },
  {
    name: 'test_exercise_attempt_given_retry_reveal_half_expect_incorrect_hard',
    allowRetry: true,
    actions: [{ kind: 'wrong' }, { kind: 'reveal', fraction: 0.5 }],
    expectedResult: { correct: false, rating: 2 },
    expectedRating: 2,
  },
  {
    name: 'test_exercise_attempt_given_commit_first_right_expect_easy',
    allowRetry: false,
    actions: [{ kind: 'right' }],
    expectedResult: { correct: true, rating: 4 },
    expectedRating: 4,
  },
  {
    name: 'test_exercise_attempt_given_commit_first_wrong_expect_incorrect_again',
    allowRetry: false,
    actions: [{ kind: 'wrong' }],
    expectedResult: { correct: false, rating: 1 },
    expectedRating: 1,
  },
  {
    name: 'test_exercise_attempt_given_commit_match_first_right_expect_easy',
    allowRetry: false,
    commitGradesAtCompletion: true,
    actions: [{ kind: 'right' }],
    expectedResult: { correct: true, rating: 4 },
    expectedRating: 4,
  },
  {
    name: 'test_exercise_attempt_given_commit_match_wrong_then_right_expect_incorrect_again',
    allowRetry: false,
    commitGradesAtCompletion: true,
    actions: [{ kind: 'wrong' }, { kind: 'right' }],
    expectedResult: { correct: false, rating: 1 },
    expectedRating: 1,
  },
  {
    name: 'test_exercise_attempt_given_commit_match_three_wrong_then_right_expect_incorrect_again',
    allowRetry: false,
    commitGradesAtCompletion: true,
    actions: [
      { kind: 'wrong' },
      { kind: 'wrong' },
      { kind: 'wrong' },
      { kind: 'right' },
    ],
    expectedResult: { correct: false, rating: 1 },
    expectedRating: 1,
  },
  ...([1, 2, 3, 4] as const).map((rating) => ({
    name: `test_exercise_attempt_given_self_rating_${rating}_expect_selected_rating`,
    allowRetry: false,
    actions: [{ kind: 'rate' as const, rating }],
    expectedResult: { correct: rating >= 3, rating },
    expectedRating: rating,
  })),
];

describe('useExerciseAttempt', () => {
  describe.each(scenarios)(
    '$name',
    ({
      allowRetry,
      commitGradesAtCompletion,
      actions,
      expectedResult,
      expectedRating,
    }) => {
      it('test_exercise_attempt_given_scenario_actions_expect_expected_result', () => {
        const { result } = renderHook(() =>
          useExerciseAttempt({ allowRetry, commitGradesAtCompletion }),
        );

        for (const action of actions) {
          act(() => {
            switch (action.kind) {
              case 'right':
                result.current.reportRight();
                break;
              case 'wrong':
                result.current.reportWrong();
                break;
              case 'reveal':
                result.current.reveal(action.fraction);
                break;
              case 'rate':
                result.current.reportRating(action.rating);
                break;
            }
          });
        }

        expect(result.current.result).toEqual(expectedResult);
        const attemptResult = result.current.result;
        if (!attemptResult) throw new Error('Expected a completed attempt');
        expect(ratingFromResult(attemptResult)).toBe(expectedRating);
      });
    },
  );

  it('test_exercise_attempt_given_retry_prop_expect_retry_available', () => {
    const { result } = renderHook(() =>
      useExerciseAttempt({ allowRetry: true }),
    );

    act(() => result.current.reportWrong());
    expect(result.current.phase).toBe('wrong');
    expect(result.current.result).toBeNull();
    expect(result.current.canReveal).toBe(true);
  });

  it('test_exercise_attempt_given_second_rating_after_terminal_expect_outcome_for_new_rating', () => {
    const { result } = renderHook(() =>
      useExerciseAttempt({ allowRetry: false }),
    );

    act(() => result.current.reportRating(2));
    let secondResult: OperationResult | null = null;
    act(() => {
      secondResult = result.current.reportRating(4);
    });

    expect(result.current.phase).toBe('solved');
    expect(result.current.result).toEqual({ correct: true, rating: 4 });
    expect(secondResult).toEqual({ correct: true, rating: 4 });
  });

  it('test_exercise_attempt_given_initial_correct_result_without_rating_expect_solved_easy_graded_completion', () => {
    const onFinished = vi.fn();
    const { result } = renderHook(() =>
      useExerciseAttempt({
        allowRetry: false,
        initialResult: { correct: true },
        onFinished,
      }),
    );

    expect(result.current.phase).toBe('solved');
    expect(result.current.isRevealedOrSolved).toBe(true);
    expect(result.current.result).toEqual({ correct: true });

    act(() => result.current.finish());
    expect(onFinished).toHaveBeenCalledOnce();
    expect(onFinished).toHaveBeenCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('test_exercise_attempt_given_checked_verdict_expect_graded_completion_from_attempt', () => {
    const onFinished = vi.fn();
    const { result } = renderHook(() =>
      useExerciseAttempt({ allowRetry: true, onFinished }),
    );

    expect(result.current.finish()).toBe(false);
    act(() => result.current.reportVerdict(false));
    expect(result.current.result).toEqual({ correct: false });
    expect(result.current.phase).toBe('revealed');
    act(() => result.current.finish());
    expect(onFinished).toHaveBeenLastCalledWith({
      kind: 'graded',
      correct: false,
      rating: 1,
    });

    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
    expect(result.current.finish()).toBe(false);

    act(() => result.current.reportVerdict(true));
    act(() => result.current.finish());
    expect(onFinished).toHaveBeenLastCalledWith({
      kind: 'graded',
      correct: true,
      rating: 4,
    });
  });

  it('test_exercise_attempt_given_skipped_or_unavailable_expect_ungraded_completion_and_host_result', async () => {
    const onFinished = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useExerciseAttempt({ allowRetry: true, onFinished }),
    );

    expect(await result.current.finishUngraded('skipped')).toBe(false);
    expect(await result.current.finishUngraded('service_unavailable')).toBe(
      false,
    );
    expect(onFinished.mock.calls).toEqual([
      [{ kind: 'ungraded', outcome: 'skipped' }],
      [{ kind: 'ungraded', outcome: 'service_unavailable' }],
    ]);
    expect(result.current.result).toBeNull();
  });

  it('test_exercise_attempt_given_wrong_action_expect_dirty_reset_and_retry_available', () => {
    const { result } = renderHook(() =>
      useExerciseAttempt({ allowRetry: true }),
    );

    act(() => result.current.markDirty());
    act(() => result.current.reportWrong());
    expect(result.current.phase).toBe('wrong');
    expect(result.current.wrongCount).toBe(1);
    expect(result.current.shakeKey).toBe(1);
    expect(result.current.dirty).toBe(false);
    expect(result.current.canReveal).toBe(true);

    act(() => result.current.markDirty());
    expect(result.current.dirty).toBe(true);
  });

  it('test_exercise_attempt_given_committed_wrong_expect_terminal_result', () => {
    const { result } = renderHook(() =>
      useExerciseAttempt({ allowRetry: false }),
    );

    act(() => result.current.reportWrong());
    const committedResult = result.current.result;
    act(() => result.current.reportRight());
    act(() => result.current.reveal(1));

    expect(result.current.phase).toBe('revealed');
    expect(result.current.canReveal).toBe(false);
    expect(result.current.result).toBe(committedResult);
  });

  it('test_exercise_attempt_given_committed_match_completion_expect_terminal_result', () => {
    const { result } = renderHook(() =>
      useExerciseAttempt({
        allowRetry: false,
        commitGradesAtCompletion: true,
      }),
    );

    act(() => result.current.reportWrong());
    expect(result.current.phase).toBe('wrong');
    expect(result.current.canReveal).toBe(false);

    act(() => result.current.reportRight());
    const committedResult = result.current.result;
    act(() => result.current.reportWrong());
    act(() => result.current.reportRight());
    act(() => result.current.reveal(1));

    expect(result.current.phase).toBe('solved');
    expect(result.current.result).toBe(committedResult);
    expect(result.current.result).toEqual({ correct: false, rating: 1 });
  });
});
