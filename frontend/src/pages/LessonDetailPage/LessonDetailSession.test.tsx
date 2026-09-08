import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { LessonDetailRead } from '@/types/api';
import type {
  Exercise,
  LessonPacket,
  WriteJudgement,
} from '@/types/lesson-contracts';

import { LessonDetailSession } from './LessonDetailSession';
import type { LessonDetailActions } from './useLessonDetailState';

const response = 'Jeg vil gjerne ha en kaffe.';

const writeExercise: Exercise = {
  kind: 'exercise',
  id: 'exercise-1',
  operation: 'write',
  objective_id: 'objective-1',
  prompt: [{ kind: 'text', value: 'Order a coffee.' }],
  explanation: null,
  payload: {
    response_language: 'no',
    criteria: [{ id: 'criterion-1', instruction: 'Order politely.' }],
  },
};

const packet: LessonPacket = {
  schema_version: '4.0',
  id: 'cafe-order',
  kind: 'communicative',
  language: 'nb-NO',
  title: 'At the café',
  cefr_level: 'A1',
  goal: 'Order at a café.',
  objectives: [{ id: 'objective-1', statement: 'Order politely.' }],
  content: [{ kind: 'exercise', id: 'exercise-1' }],
  sections: [],
  exercises: [writeExercise],
  practice_groups: [],
  media: { audio: [] },
};

const lesson: LessonDetailRead = {
  id: 42,
  source_id: 'cafe-order',
  kind: 'communicative',
  family_id: 'basics',
  title: 'At the café',
  cefr_level: 'A1',
  goal: 'Order at a café.',
  order: 1,
  estimated_minutes: 5,
  packet,
  media: { audio: [] },
  progress: null,
};

const draftKey = 'flyt.write.draft.user-7-lesson-42.exercise-1';

const judgement: WriteJudgement = {
  criteria: [{ criterion_id: 'criterion-1', met: true, evidence: null }],
};

function makeActions() {
  return {
    startLesson: vi.fn().mockResolvedValue({
      completed_exercise_ids: [],
      completed_at: null,
    }),
    completeLesson: vi.fn().mockResolvedValue(undefined),
    completeLessonExercise: vi.fn(),
  };
}

function renderSession(actions: LessonDetailActions) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LessonDetailSession
        lesson={lesson}
        userId={7}
        actions={actions}
        judgeWrite={vi.fn().mockResolvedValue(judgement)}
      />
    </QueryClientProvider>,
  );
}

async function submitWriteResponse(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /start lesson/i }));
  await user.type(screen.getByRole('textbox'), response);
  await user.click(screen.getByRole('button', { name: /^check$/i }));
  await user.click(await screen.findByRole('button', { name: /^continue$/i }));
}

describe('LessonDetailSession', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('test_write_draft_given_rejected_exercise_completion_expect_draft_preserved_and_page_kept', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    actions.completeLessonExercise.mockRejectedValue(new Error('offline'));

    renderSession(actions);

    await submitWriteResponse(user);

    await vi.waitFor(() => {
      expect(actions.completeLessonExercise).toHaveBeenCalledWith('exercise-1');
    });
    expect(globalThis.localStorage.getItem(draftKey)).toBe(response);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByText('Lesson complete!')).not.toBeInTheDocument();
  });

  it('test_write_draft_given_accepted_exercise_completion_expect_draft_removed_and_lesson_finished', async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    actions.completeLessonExercise.mockResolvedValue({
      completed_exercise_ids: ['exercise-1'],
      completed_at: null,
    });

    renderSession(actions);

    await submitWriteResponse(user);

    expect(await screen.findByText('Lesson complete!')).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(globalThis.localStorage.getItem(draftKey)).toBeNull();
    });
  });
});
