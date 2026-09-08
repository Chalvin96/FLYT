import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { type ExerciseOutcome } from '@/lib/operationResult';
import { type LessonDetailRead } from '@/types/api';
import {
  type Exercise,
  type LessonPacket,
  type SectionPacket,
} from '@/types/lesson-contracts';

import { LessonDetailPage } from './LessonDetailPage';

const { mockCompleteExercise, mockCompleteLesson, mockStartLesson } =
  vi.hoisted(() => ({
    mockCompleteExercise: vi.fn(),
    mockCompleteLesson: vi.fn(),
    mockStartLesson: vi.fn(),
  }));

vi.mock('@/hooks/ui/useIsDesktop', () => ({
  useIsDesktop: () => false,
}));

vi.mock('@/hooks/lessons/queries', () => ({
  useCompleteLesson: () => ({
    mutateAsync: mockCompleteLesson,
    isPending: false,
  }),
  useCompleteLessonExercise: () => ({
    mutateAsync: mockCompleteExercise,
    isPending: false,
  }),
  useStartLesson: () => ({
    mutateAsync: mockStartLesson,
    isPending: false,
  }),
}));

vi.mock('@/components/flashcard/ExerciseView', () => ({
  ExerciseView: ({
    exercise,
    onFinished,
  }: {
    exercise: Exercise;
    onFinished?: (outcome: ExerciseOutcome) => void;
  }) => (
    <div>
      <h2>{exercise.id}</h2>
      <button
        onClick={() =>
          onFinished?.({ kind: 'graded', correct: true, rating: 4 })
        }
      >
        Finish exercise
      </button>
    </div>
  ),
}));

vi.mock('@/components/flashcard/FlashCardLessonEnd/FlashCardLessonEnd', () => ({
  FlashCardLessonEnd: ({ onFinished }: { onFinished?: () => void }) => (
    <div>
      <h2>Lesson complete!</h2>
      <button onClick={onFinished}>Finish lesson</button>
    </div>
  ),
}));

vi.mock('@/components/flashcard/FlashCardInfo/FlashCardInfo', () => ({
  FlashCardInfo: ({
    section,
    onContinue,
  }: {
    section: SectionPacket;
    onContinue?: () => void;
  }) => (
    <div>
      <h2>{section.title}</h2>
      <button onClick={onContinue}>Continue section</button>
    </div>
  ),
}));

vi.mock('@/components/flashcard/ExerciseModeProvider', () => ({
  ExerciseModeProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

const packet: LessonPacket = {
  schema_version: '4.0',
  id: 'personal-pronouns',
  kind: 'grammar',
  language: 'nb-NO',
  title: 'Personal Pronouns',
  cefr_level: 'A1',
  goal: 'Learn the core Norwegian personal pronouns.',
  objectives: [{ id: 'objective-1', statement: 'Use personal pronouns.' }],
  content: [
    { kind: 'section', id: 'section-1' },
    { kind: 'exercise', id: 'exercise-1' },
    { kind: 'section', id: 'section-2' },
    { kind: 'exercise', id: 'exercise-2' },
  ],
  sections: [
    {
      kind: 'section',
      id: 'section-1',
      role: 'orient',
      title: 'Warm up',
      objective_ids: ['objective-1'],
      blocks: [
        {
          kind: 'paragraph',
          id: 'block-1',
          spans: [{ kind: 'text', value: 'Read the pattern first.' }],
        },
      ],
    },
    {
      kind: 'section',
      id: 'section-2',
      role: 'model',
      title: 'Pattern',
      objective_ids: ['objective-1'],
      blocks: [
        {
          kind: 'paragraph',
          id: 'block-2',
          spans: [{ kind: 'text', value: 'Apply the pattern.' }],
        },
      ],
    },
  ],
  exercises: [
    {
      kind: 'exercise',
      id: 'exercise-1',
      operation: 'choose',
      objective_id: 'objective-1',
      prompt: [{ kind: 'text', value: 'Choose the pronoun.' }],
      explanation: null,
      payload: {
        stem: [{ kind: 'text', value: '___ er her.' }],
        options: [
          { option_id: 'jeg', text: 'Jeg' },
          { option_id: 'du', text: 'Du' },
        ],
        answer_id: 'jeg',
      },
    },
    {
      kind: 'exercise',
      id: 'exercise-2',
      operation: 'choose',
      objective_id: 'objective-1',
      prompt: [{ kind: 'text', value: 'Choose the pronoun again.' }],
      explanation: null,
      payload: {
        stem: [{ kind: 'text', value: '___ kommer.' }],
        options: [
          { option_id: 'han', text: 'Han' },
          { option_id: 'hun', text: 'Hun' },
        ],
        answer_id: 'han',
      },
    },
  ],
  practice_groups: [
    {
      id: 'practice-1',
      objective_id: 'objective-1',
      exercise_ids: ['exercise-1', 'exercise-2'],
    },
  ],
  media: { audio: [] },
};

function makeLesson(
  overrides: Partial<LessonDetailRead> = {},
): LessonDetailRead {
  return {
    id: 42,
    source_id: 'personal-pronouns',
    kind: 'grammar',
    family_id: 'basics',
    title: 'Personal Pronouns',
    cefr_level: 'A1',
    goal: 'Learn the core Norwegian personal pronouns.',
    order: 1,
    estimated_minutes: 5,
    packet,
    media: { audio: [] },
    progress: null,
    ...overrides,
  };
}

function renderLesson(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('LessonDetailPage', () => {
  beforeEach(() => {
    mockStartLesson.mockReset();
    mockCompleteExercise.mockReset();
    mockCompleteLesson.mockReset();
  });

  it('test_lesson_start_given_not_started_expect_shows_start_screen', () => {
    renderLesson(<LessonDetailPage lesson={makeLesson()} />);

    expect(screen.getByText('Personal Pronouns')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start lesson/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Warm up')).not.toBeInTheDocument();
  });

  it('test_lesson_detail_given_loading_expect_busy_status_region', () => {
    render(<LessonDetailPage lesson={undefined} isLoading />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading lesson.')).toBeInTheDocument();
  });

  it('test_lesson_detail_given_missing_lesson_expect_not_found_without_alert', () => {
    render(<LessonDetailPage lesson={undefined} />);

    expect(screen.getByText('Lesson not found.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('test_lesson_detail_given_load_error_expect_alert_region', () => {
    render(<LessonDetailPage lesson={undefined} isError />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load lesson.',
    );
  });

  it('test_lesson_progress_given_authored_interleaving_expect_practice_between_parts', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    mockStartLesson.mockResolvedValue({
      completed_exercise_ids: [],
      completed_at: null,
    });
    mockCompleteExercise
      .mockResolvedValueOnce({
        completed_exercise_ids: ['exercise-1'],
        completed_at: null,
      })
      .mockResolvedValueOnce({
        completed_exercise_ids: ['exercise-1', 'exercise-2'],
        completed_at: null,
      });
    mockCompleteLesson.mockResolvedValue(undefined);

    renderLesson(<LessonDetailPage lesson={makeLesson()} onExit={onExit} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    expect(
      await screen.findByRole('heading', { name: 'Warm up' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Part 1 of 2')).toBeInTheDocument();
    expect(mockStartLesson).toHaveBeenCalledWith(42);

    await user.click(screen.getByRole('button', { name: /continue section/i }));
    expect(
      await screen.findByRole('heading', { name: 'exercise-1' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Practice 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finish exercise/i }));
    expect(
      await screen.findByRole('heading', { name: 'Pattern' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Part 2 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue section/i }));
    expect(
      await screen.findByRole('heading', { name: 'exercise-2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Practice 2 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finish exercise/i }));
    expect(screen.getByText('Lesson complete!')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /go to/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Complete',
    );
    await waitFor(() =>
      expect(mockCompleteExercise).toHaveBeenCalledWith('exercise-1'),
    );
    await waitFor(() =>
      expect(mockCompleteExercise).toHaveBeenCalledWith('exercise-2'),
    );
    await waitFor(() => expect(mockCompleteLesson).toHaveBeenCalledWith(42));

    await user.click(screen.getByRole('button', { name: /finish lesson/i }));

    expect(onExit).toHaveBeenCalledOnce();
    expect(mockCompleteLesson).toHaveBeenCalledOnce();
  });

  it('test_progress_navigation_given_in_flight_exercise_completion_expect_advances_from_submitted_page', async () => {
    const user = userEvent.setup();
    mockStartLesson.mockResolvedValue({
      completed_exercise_ids: [],
      completed_at: null,
    });
    let resolveCompletion:
      | ((progress: {
          completed_exercise_ids: string[];
          completed_at: string | null;
        }) => void)
      | undefined;
    mockCompleteExercise.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCompletion = resolve;
      }),
    );

    render(<LessonDetailPage lesson={makeLesson()} />);

    await user.click(screen.getByRole('button', { name: /start lesson/i }));
    await user.click(screen.getByRole('button', { name: /continue section/i }));
    expect(
      await screen.findByRole('heading', { name: 'exercise-1' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /finish exercise/i }));

    await user.click(screen.getByRole('button', { name: 'Go to part 1 of 2' }));
    expect(
      await screen.findByRole('heading', { name: 'Warm up' }),
    ).toBeInTheDocument();

    if (!resolveCompletion) {
      throw new Error('completion promise was not initialized');
    }
    const resolve = resolveCompletion;
    await act(async () => {
      resolve({
        completed_exercise_ids: ['exercise-1'],
        completed_at: null,
      });
    });

    expect(
      await screen.findByRole('heading', { name: 'Pattern' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Part 2 of 2')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'exercise-1' }),
    ).not.toBeInTheDocument();
  });

  it('test_zero_page_lesson_given_not_started_expect_no_completion_request', async () => {
    const user = userEvent.setup();
    mockStartLesson.mockResolvedValue({
      completed_exercise_ids: [],
      completed_at: null,
    });
    mockCompleteLesson.mockResolvedValue(undefined);
    const emptyPacket: LessonPacket = {
      ...packet,
      content: [],
      sections: [],
      exercises: [],
      practice_groups: [],
    };

    render(<LessonDetailPage lesson={makeLesson({ packet: emptyPacket })} />);

    expect(mockCompleteLesson).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /start lesson/i }));

    expect(await screen.findByText('Lesson complete!')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockCompleteLesson).toHaveBeenCalledWith(42);
    });
  });

  it('test_lesson_restart_given_completed_lesson_expect_starts_at_first_page', async () => {
    const user = userEvent.setup();
    mockStartLesson.mockResolvedValue({
      completed_exercise_ids: [],
      completed_at: null,
    });

    renderLesson(
      <LessonDetailPage
        lesson={makeLesson({
          progress: {
            completed_exercise_ids: ['exercise-1'],
            completed_at: '2026-08-01T00:00:00Z',
          },
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /start lesson/i }));

    expect(
      await screen.findByRole('heading', { name: 'Warm up' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Lesson complete!')).not.toBeInTheDocument();
  });

  it('test_lesson_resume_given_in_progress_lesson_expect_shows_current_page', () => {
    render(
      <LessonDetailPage
        lesson={makeLesson({
          progress: {
            completed_exercise_ids: [],
            completed_at: null,
          },
        })}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /start lesson/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Warm up' }),
    ).toBeInTheDocument();
    expect(mockStartLesson).not.toHaveBeenCalled();
  });

  it('test_lesson_resume_given_completed_exercise_expect_shows_next_page', () => {
    render(
      <LessonDetailPage
        lesson={makeLesson({
          progress: {
            completed_exercise_ids: ['exercise-1'],
            completed_at: null,
          },
        })}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /start lesson/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Pattern' }),
    ).toBeInTheDocument();
    expect(mockStartLesson).not.toHaveBeenCalled();
  });

  it('test_lesson_resume_given_later_exercise_completed_expect_first_incomplete_page', () => {
    render(
      <LessonDetailPage
        lesson={makeLesson({
          progress: {
            completed_exercise_ids: ['exercise-2'],
            completed_at: null,
          },
        })}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Warm up' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Lesson complete!')).not.toBeInTheDocument();
    expect(mockStartLesson).not.toHaveBeenCalled();
  });
});
