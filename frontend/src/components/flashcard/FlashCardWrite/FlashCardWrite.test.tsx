import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

import type { WriteExercise, WriteJudgement } from '@/types/lesson-contracts';

import { K_OPERATION_REQUEST_TIMEOUT_MS } from '../operationRequest';
import { FlashCardWrite } from './FlashCardWrite';

const exercise: WriteExercise = {
  kind: 'exercise',
  objective_id: 'obj-write',
  id: 'write-test-1',
  operation: 'write',
  prompt: [{ kind: 'text', value: 'Describe your morning.' }],
  explanation: [
    {
      kind: 'text',
      value: 'Use present-tense verbs for routines.',
    },
  ],
  payload: {
    response_language: 'no',
    min_words: 3,
    max_words: 8,
    judge_prompt: 'PRIVATE MODEL INSTRUCTION — never show this to learners.',
    criteria: [
      { id: 'routine', instruction: 'Describes a routine.' },
      { id: 'present', instruction: 'Uses present-tense verbs.' },
    ],
  },
};

const response = 'Jeg står opp tidlig.';

const judgement: WriteJudgement = {
  criteria: [
    { criterion_id: 'routine', met: true, evidence: 'står opp' },
    { criterion_id: 'present', met: true, evidence: 'står' },
  ],
};

describe('FlashCardWrite', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('test_explanation_given_write_before_check_expect_hidden_and_prompt_private', () => {
    render(<FlashCardWrite exercise={exercise} initialResponse={response} />);

    expect(screen.getByTestId('exercise-prompt')).toHaveTextContent(
      'Describe your morning.',
    );
    expect(screen.getByTestId('exercise-prompt').tagName).toBe('P');
    expect(
      screen.queryByRole('heading', { name: /describe your morning/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('exercise-explanation'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('write-criteria-summary')).toHaveTextContent(
      /what gets checked/i,
    );
    expect(screen.queryByText(/of 2 met/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/private model instruction/i),
    ).not.toBeInTheDocument();
  });

  it('test_write_given_judge_pending_expect_response_disabled_until_result', async () => {
    let resolveJudge: (value: WriteJudgement) => void = () => undefined;
    const judgeWrite = vi.fn(
      () =>
        new Promise<WriteJudgement>((resolve) => {
          resolveJudge = resolve;
        }),
    );
    const user = userEvent.setup();
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        judgeWrite={judgeWrite}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(screen.getByRole('button', { name: /checking/i })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();

    resolveJudge(judgement);

    expect(await screen.findByTestId('exercise-explanation')).toHaveTextContent(
      /present-tense verbs/i,
    );
    expect(screen.getAllByText(/all criteria met/i)).toHaveLength(1);
    expect(screen.getByTestId('write-criteria')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /what (gets|was) checked/i }),
    ).not.toBeInTheDocument();
  });

  it('test_write_given_no_authored_word_budget_expect_no_fake_counter', () => {
    const unboundedExercise: WriteExercise = {
      ...exercise,
      id: 'write-unbounded-1',
      payload: {
        ...exercise.payload,
        min_words: null,
        max_words: null,
      },
    };

    render(<FlashCardWrite exercise={unboundedExercise} />);

    expect(screen.queryByText(/0 \/ 1\+/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/more word/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/answer in norwegian/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
      /write a response/i,
    );
    expect(screen.getByRole('button', { name: /^check$/i })).toBeDisabled();
  });

  it('test_write_given_judge_failure_expect_saved_response_and_unavailable_state', async () => {
    const user = userEvent.setup();
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        judgeWrite={() => Promise.reject(new Error('offline'))}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(
      await screen.findByText(/couldn.t check this right now/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(response);
    expect(
      screen.queryByTestId('exercise-explanation'),
    ).not.toBeInTheDocument();
  });

  it('test_write_request_given_pending_judge_expect_recoverable_error', async () => {
    vi.useFakeTimers();
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        judgeWrite={() => new Promise<WriteJudgement>(() => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));
    await act(async () => {
      vi.advanceTimersByTime(K_OPERATION_REQUEST_TIMEOUT_MS);
      await Promise.resolve();
    });

    expect(
      screen.getByText(/couldn.t check this right now/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(response);
  });

  it('test_write_given_unavailable_judge_expect_ungraded_continuation', async () => {
    const onFinished = vi.fn();
    const user = userEvent.setup();
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        judgeWrite={() => Promise.reject(new Error('offline'))}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(await screen.findByRole('button', { name: /continue/i }));

    expect(onFinished).toHaveBeenCalledWith({
      kind: 'ungraded',
      outcome: 'service_unavailable',
    });
  });

  it('test_write_draft_given_response_expect_saved_until_exercise_exit', async () => {
    const user = userEvent.setup();
    const draftExercise = { ...exercise, id: 'write-draft-lifecycle-1' };
    const draftKey = 'flyt.write.draft.anonymous.write-draft-lifecycle-1';
    render(<FlashCardWrite exercise={draftExercise} initialResponse="" />);

    await user.type(screen.getByRole('textbox'), response);

    expect(globalThis.localStorage.getItem(draftKey)).toBe(response);

    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(globalThis.localStorage.getItem(draftKey)).toBeNull();
  });

  it('test_write_draft_given_active_response_expect_restored_when_card_remounts', async () => {
    const user = userEvent.setup();
    const draftExercise = { ...exercise, id: 'write-unmount-draft-1' };
    const draftKey = 'flyt.write.draft.anonymous.write-unmount-draft-1';
    const { rerender } = render(
      <FlashCardWrite exercise={draftExercise} initialResponse="" />,
    );

    await user.type(screen.getByRole('textbox'), response);
    expect(globalThis.localStorage.getItem(draftKey)).toBe(response);

    rerender(<div />);

    rerender(<FlashCardWrite exercise={draftExercise} />);

    expect(screen.getByRole('textbox')).toHaveValue(response);
  });

  it('test_write_draft_given_storage_failure_expect_unsaved_status', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<FlashCardWrite exercise={exercise} initialResponse="" />);
    await user.type(screen.getByRole('textbox'), response);

    expect(screen.getByText('Draft saved on this device')).toBeInTheDocument();
    expect(setItem).toHaveBeenCalled();

    setItem.mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    await user.type(screen.getByRole('textbox'), ' ekstra');

    expect(screen.getByText('Draft not saved')).toBeInTheDocument();
    setItem.mockRestore();
  });

  it('test_write_completion_given_parent_rejects_expect_draft_preserved', async () => {
    const user = userEvent.setup();
    const draftExercise = { ...exercise, id: 'write-parent-rejects-1' };
    const draftKey = 'flyt.write.draft.anonymous.write-parent-rejects-1';
    const onFinished = vi.fn().mockResolvedValue(false);
    render(
      <FlashCardWrite
        exercise={draftExercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={judgement}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => expect(onFinished).toHaveBeenCalledOnce());
    expect(globalThis.localStorage.getItem(draftKey)).toBe(response);
  });

  it('test_write_completion_given_storage_removal_failure_expect_unsaved_status', async () => {
    const removeItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('storage unavailable');
      });
    const onFinished = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={judgement}
        onFinished={onFinished}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => expect(onFinished).toHaveBeenCalledOnce());
    expect(screen.getByText('Draft not saved')).toBeInTheDocument();
    removeItem.mockRestore();
  });

  it('test_write_draft_given_empty_response_expect_no_storage_entry', () => {
    const draftExercise = { ...exercise, id: 'write-empty-draft-1' };
    const draftKey = 'flyt.write.draft.anonymous.write-empty-draft-1';
    globalThis.localStorage.setItem(draftKey, response);

    render(<FlashCardWrite exercise={draftExercise} initialResponse="" />);

    expect(globalThis.localStorage.getItem(draftKey)).toBeNull();
  });

  it('test_write_draft_given_restored_response_cleared_expect_storage_entry_removed', async () => {
    const user = userEvent.setup();
    const draftExercise = { ...exercise, id: 'write-clear-draft-1' };
    const draftKey = 'flyt.write.draft.anonymous.write-clear-draft-1';
    globalThis.localStorage.setItem(draftKey, response);

    render(<FlashCardWrite exercise={draftExercise} />);

    await user.clear(screen.getByRole('textbox'));

    expect(globalThis.localStorage.getItem(draftKey)).toBeNull();
  });

  it('test_write_draft_given_unavailable_judge_expect_removed_on_ungraded_continuation', async () => {
    const user = userEvent.setup();
    const draftExercise = { ...exercise, id: 'write-ungraded-draft-1' };
    const draftKey = 'flyt.write.draft.anonymous.write-ungraded-draft-1';
    render(
      <FlashCardWrite exercise={draftExercise} initialResponse={response} />,
    );

    await user.click(screen.getByRole('button', { name: /^check$/i }));
    await user.click(
      await screen.findByRole('button', { name: /continue ungraded/i }),
    );

    expect(globalThis.localStorage.getItem(draftKey)).toBeNull();
  });

  it('test_write_draft_given_judged_response_expect_removed_on_continue', async () => {
    const user = userEvent.setup();
    const draftExercise = { ...exercise, id: 'write-graded-draft-1' };
    const draftKey = 'flyt.write.draft.anonymous.write-graded-draft-1';
    render(
      <FlashCardWrite
        exercise={draftExercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={judgement}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(globalThis.localStorage.getItem(draftKey)).toBeNull();
  });

  it('test_write_given_response_changed_after_judgement_expect_feedback_cleared', async () => {
    const user = userEvent.setup();
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        judgeWrite={() => Promise.resolve(judgement)}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(await screen.findByText(/all criteria met/i)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), ' ekstra');

    expect(screen.queryByText(/all criteria met/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^check$/i }),
    ).toBeInTheDocument();
  });

  it('test_write_given_oversized_response_expect_local_length_gate', () => {
    const longExercise = {
      ...exercise,
      payload: { ...exercise.payload, min_words: 1, max_words: undefined },
    };
    render(
      <FlashCardWrite
        exercise={longExercise}
        initialResponse={'a '.repeat(251)}
        judgeWrite={vi.fn()}
      />,
    );

    expect(screen.getByText(/500 characters or fewer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^check$/i })).toBeDisabled();
  });

  it('test_write_given_500_unicode_code_points_expect_submission_allowed', async () => {
    const judgeWrite = vi.fn(() => Promise.resolve(judgement));
    const longExercise = {
      ...exercise,
      payload: { ...exercise.payload, min_words: 1, max_words: undefined },
    };
    const user = userEvent.setup();
    render(
      <FlashCardWrite
        exercise={longExercise}
        initialResponse={`${'a'.repeat(499)}😀`}
        judgeWrite={judgeWrite}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(judgeWrite).toHaveBeenCalledTimes(1);
  });

  it('test_write_given_api_validation_failure_expect_editable_feedback', async () => {
    const user = userEvent.setup();
    const error = new AxiosError(
      'invalid',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 422,
        data: {
          detail: {
            code: 'WRITE_RESPONSE_INVALID',
            message: 'Write at least 3 words before checking.',
          },
        },
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as never,
      },
    );
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        judgeWrite={() => Promise.reject(error)}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(
      await screen.findByText(/write at least 3 words/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(response);
  });

  it('test_write_prompt_given_long_task_expect_short_heading_and_task_surface', async () => {
    const longTaskExercise: WriteExercise = {
      ...exercise,
      id: 'write-long-task-1',
      prompt: [
        {
          kind: 'text',
          value:
            'Write two Norwegian ordering sentences. Replace the coffee and cinnamon bun with two different café items taught in this lesson. Choose from et rundstykke med ost, en kopp te, and en flaske vann.',
        },
      ],
    };
    const user = userEvent.setup();
    render(
      <FlashCardWrite exercise={longTaskExercise} initialResponse={response} />,
    );

    const heading = screen.getByRole('heading', { level: 2, name: /write/i });
    const task = screen.getByTestId('write-task');
    const prompt = screen.getByTestId('exercise-prompt');

    expect(heading).toBeInTheDocument();
    expect(task).toContainElement(prompt);
    expect(task).toHaveTextContent('Write two Norwegian ordering sentences.');
    const disclosure = within(task).getByRole('button', {
      name: /show full task/i,
    });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user.click(disclosure);
    expect(
      within(task).getByRole('button', { name: /show less/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      prompt.id,
    );
    expect(prompt.id).toBeTruthy();
  });

  it('test_write_criteria_given_composing_expect_static_guidance_without_verdicts', () => {
    render(<FlashCardWrite exercise={exercise} initialResponse={response} />);

    const criteria = screen.getByTestId('write-criteria');

    expect(criteria).toHaveTextContent(/describes a routine/i);
    expect(criteria).toHaveTextContent(/uses present-tense verbs/i);
    expect(screen.queryByText(/— met/)).not.toBeInTheDocument();
    expect(within(criteria).queryByText(/står opp/)).not.toBeInTheDocument();
  });

  it('test_write_criteria_given_partial_judgement_expect_single_summary_and_unmet_marks', () => {
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={{
          criteria: [
            { criterion_id: 'routine', met: true, evidence: 'står opp' },
            { criterion_id: 'present', met: false, evidence: null },
          ],
        }}
      />,
    );

    expect(screen.getAllByText(/1 of 2 criteria met/i)).toHaveLength(1);
    expect(screen.getByText(/— not met/)).toBeInTheDocument();
    expect(screen.getByText(/— met/)).toBeInTheDocument();
  });

  it('test_write_evidence_given_met_criterion_quoting_the_response_expect_no_duplicate_answer', () => {
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={{
          criteria: [
            { criterion_id: 'routine', met: true, evidence: response },
            { criterion_id: 'present', met: true, evidence: 'St\u00E5r OPP' },
          ],
        }}
      />,
    );

    expect(screen.getByRole('textbox')).toHaveValue(response);
    expect(
      screen.queryByText(`\u201C${response}\u201D`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/\u201CSt\u00E5r OPP\u201D/),
    ).not.toBeInTheDocument();
  });

  it('test_write_evidence_given_unmet_criterion_expect_gap_quote_retained', () => {
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={{
          criteria: [
            { criterion_id: 'routine', met: true, evidence: 'st\u00E5r opp' },
            { criterion_id: 'present', met: false, evidence: 'stod opp' },
          ],
        }}
      />,
    );

    expect(screen.getByText(/\u201Cstod opp\u201D/)).toBeInTheDocument();
    expect(
      screen.queryByText(/\u201Cst\u00E5r opp\u201D/),
    ).not.toBeInTheDocument();
  });

  it('test_write_editor_given_short_response_expect_no_character_counter', () => {
    render(<FlashCardWrite exercise={exercise} initialResponse={response} />);

    expect(screen.queryByText(/\/ 500/)).not.toBeInTheDocument();
    expect(screen.getByText('4 / 3–8')).toBeInTheDocument();
  });

  it('test_write_editor_given_response_near_character_limit_expect_character_counter', () => {
    render(
      <FlashCardWrite exercise={exercise} initialResponse={'a'.repeat(450)} />,
    );

    expect(screen.getByText('450 / 500')).toBeInTheDocument();
  });

  it('test_write_surface_given_composing_expect_shared_criteria_and_editor_surface', () => {
    render(<FlashCardWrite exercise={exercise} initialResponse={response} />);

    const surface = screen.getByTestId('write-surface');
    const criteria = screen.getByTestId('write-criteria');
    const editor = screen.getByTestId('write-editor');

    expect(surface).toContainElement(criteria);
    expect(surface).toContainElement(editor);
    expect(editor).toHaveClass('flex-1');
    expect(within(surface).getByText('Your response')).toBeInTheDocument();
    expect(within(surface).getByText('Write in Norwegian')).toBeInTheDocument();
    expect(screen.getByTestId('write-criteria-summary')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('test_write_result_given_all_criteria_met_expect_one_verdict_without_shell_banner', () => {
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={judgement}
      />,
    );

    expect(screen.getAllByText(/all criteria met/i)).toHaveLength(1);
    expect(screen.queryByTestId('operation-banner')).not.toBeInTheDocument();
    expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
      /continue when you are ready/i,
    );
    expect(screen.queryByText(/nice work/i)).not.toBeInTheDocument();
  });

  it('test_write_result_given_unmet_criteria_expect_revise_cue_instead_of_generic_verdict', () => {
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={{
          criteria: [
            { criterion_id: 'routine', met: true, evidence: null },
            { criterion_id: 'present', met: false, evidence: null },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
      /revise your response or continue/i,
    );
    expect(screen.queryByText(/not quite/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/review the answer/i)).not.toBeInTheDocument();
  });

  it('test_write_given_terminal_judgement_expect_verdicts_and_explanation', () => {
    render(
      <FlashCardWrite
        exercise={exercise}
        initialResponse={response}
        initialPhase="result"
        initialJudgement={judgement}
      />,
    );

    expect(screen.getByTestId('exercise-explanation')).toHaveTextContent(
      /present-tense verbs/i,
    );
    expect(screen.getByText(/all criteria met/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/private model instruction/i),
    ).not.toBeInTheDocument();
  });
});
