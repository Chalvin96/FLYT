import { describe, expect, it, vi } from 'vitest';

import type { Spans } from '@/types/lesson-contracts';

import {
  buildFooterView,
  buildOperationShellView,
  type ExerciseAttemptView,
} from './operationShellView';

const explanation = [{ kind: 'text', value: 'Why it works.' }] satisfies Spans;
const onCheck = vi.fn();
const onContinue = vi.fn();
const onReveal = vi.fn();

function renderView(attempt: ExerciseAttemptView, canCheck = false) {
  return buildOperationShellView({
    attempt,
    canCheck,
    explanation,
    ownsResultFeedback: false,
    pending: false,
    pendingLabel: 'Checking…',
    statusHint: undefined,
    wrongHint: 'Try another answer.',
  });
}

function renderFooter(attempt: ExerciseAttemptView, canCheck = false) {
  return buildFooterView({
    attempt,
    canCheck,
    onCheck,
    onContinue,
    pending: false,
    pendingLabel: 'Checking…',
  });
}

describe('operation shell attempt view', () => {
  it('test_operation_view_given_single_check_and_result_expect_check_then_continue_with_verdict', () => {
    const working: ExerciseAttemptView = { kind: 'single', result: null };
    const answered: ExerciseAttemptView = {
      kind: 'single',
      result: { correct: false },
    };

    expect(renderFooter(working, true).kind).toBe('check');
    expect(renderView(working, true).bannerVerdict).toBeNull();
    expect(renderFooter(answered).kind).toBe('continue');
    expect(renderView(answered)).toMatchObject({
      bannerVerdict: 'incorrect',
      resultHint: 'Try another answer.',
      showContinue: true,
      showExplanation: true,
      status: 'Review the answer',
    });
  });

  it('test_operation_view_given_retry_wrong_expect_retry_feedback_without_terminal_result', () => {
    const attempt: ExerciseAttemptView = {
      kind: 'retry',
      phase: 'wrong',
      result: { correct: true },
      shakeKey: 1,
      canReveal: true,
      onReveal,
    };

    expect(renderView(attempt)).toMatchObject({
      ariaLive: undefined,
      bannerVerdict: 'wrong-flash',
      showContinue: false,
      showExplanation: false,
      status: 'Adjust your answer to try again.',
      statusVerdict: 'incorrect',
    });
    expect(renderFooter(attempt)).toMatchObject({
      kind: 'retryCheck',
      canReveal: true,
      onReveal,
    });
  });

  it('test_operation_view_given_retry_terminal_expect_continue_and_answer_feedback', () => {
    const solved: ExerciseAttemptView = {
      kind: 'retry',
      phase: 'solved',
      result: { correct: true },
      shakeKey: 0,
      canReveal: false,
      onReveal,
    };
    const revealed: ExerciseAttemptView = {
      ...solved,
      phase: 'revealed',
      result: { correct: false },
    };

    expect(renderView(solved)).toMatchObject({
      bannerVerdict: 'correct',
      showContinue: true,
      showExplanation: true,
    });
    expect(renderView(revealed)).toMatchObject({
      bannerVerdict: 'revealed',
      showContinue: true,
      showExplanation: true,
    });
    expect(renderFooter(solved).kind).toBe('continue');
    expect(renderFooter(revealed).kind).toBe('continue');
  });

  it('test_operation_view_given_write_owned_verdict_expect_context_status_without_banner', () => {
    const attempt: ExerciseAttemptView = {
      kind: 'single',
      result: { correct: true },
    };
    const view = buildOperationShellView({
      attempt,
      canCheck: false,
      explanation,
      ownsResultFeedback: true,
      pending: false,
      pendingLabel: 'Checking…',
      statusHint: 'Continue when you are ready',
      wrongHint: null,
    });

    expect(view).toMatchObject({
      bannerVerdict: null,
      showContinue: true,
      showExplanation: true,
      status: 'Continue when you are ready',
    });
  });
});
