import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import type { LessonSummaryRead } from '@/types/api';

import { LESSON_LEVEL_PREFERENCE_KEY } from './lessonLevel';
import { LessonPage } from './LessonPage';

const lessons: LessonSummaryRead[] = [
  {
    id: 1,
    source_id: 'answering-ja-nei-jo',
    kind: 'grammar',
    family_id: 'basics',
    title: 'Answering ja, nei, and jo',
    cefr_level: 'A1',
    goal: 'Answer simple questions and add natural affirmations or corrections.',
    order: 1,
    state: 'completed',
    estimated_minutes: 6,
    last_activity_at: null,
  },
  {
    id: 2,
    source_id: 'word-order-main-clauses',
    kind: 'grammar',
    family_id: 'word-order',
    title: 'Word order in main clauses',
    cefr_level: 'A1',
    goal: 'Keep the finite verb in the right place in simple sentences.',
    order: 2,
    state: 'in_progress',
    estimated_minutes: 8,
    last_activity_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 3,
    source_id: 'past-tense',
    kind: 'grammar',
    family_id: 'past-tense',
    title: 'The past tense',
    cefr_level: 'A2',
    goal: 'Talk about finished actions and events in the past.',
    order: 3,
    state: 'not_started',
    estimated_minutes: 7,
    last_activity_at: null,
  },
  {
    id: 4,
    source_id: 'present-perfect',
    kind: 'grammar',
    family_id: 'perfect',
    title: 'Present perfect with har',
    cefr_level: 'A2',
    goal: 'Connect past actions to the present.',
    order: 4,
    state: 'completed',
    estimated_minutes: 7,
    last_activity_at: '2026-08-19T10:00:00Z',
  },
  {
    id: 5,
    source_id: 'relative-clauses',
    kind: 'grammar',
    family_id: 'relative-clauses',
    title: 'Building sentences with som',
    cefr_level: 'B1',
    goal: 'Add clear relative clauses about people and things.',
    order: 5,
    state: 'not_started',
    estimated_minutes: 9,
    last_activity_at: null,
  },
];

const resumePriorityLessons: LessonSummaryRead[] = [
  {
    id: 10,
    source_id: 'first-conversations',
    kind: 'grammar',
    family_id: 'basics',
    title: 'First conversations',
    cefr_level: 'A1',
    goal: 'Build a foundation for short everyday conversations.',
    order: 1,
    state: 'not_started',
    estimated_minutes: 6,
    last_activity_at: null,
  },
  {
    id: 11,
    source_id: 'asking-questions',
    kind: 'grammar',
    family_id: 'questions',
    title: 'Asking questions',
    cefr_level: 'A1',
    goal: 'Ask simple questions about people, places, and routines.',
    order: 2,
    state: 'in_progress',
    estimated_minutes: 8,
    last_activity_at: '2026-08-19T10:00:00Z',
  },
  {
    id: 12,
    source_id: 'talking-about-routines',
    kind: 'grammar',
    family_id: 'routines',
    title: 'Talking about routines',
    cefr_level: 'A1',
    goal: 'Describe your day with common Norwegian verbs.',
    order: 3,
    state: 'in_progress',
    estimated_minutes: 7,
    last_activity_at: '2026-08-20T10:00:00Z',
  },
  {
    id: 13,
    source_id: 'introducing-yourself',
    kind: 'grammar',
    family_id: 'basics',
    title: 'Introducing yourself',
    cefr_level: 'A1',
    goal: 'Introduce yourself and share basic personal information.',
    order: 4,
    state: 'completed',
    estimated_minutes: 5,
    last_activity_at: '2026-08-18T10:00:00Z',
  },
];

function RouterDecorator({ children }: { children: ReactNode }) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => (
        <div className="min-h-dvh bg-background px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      ),
    });
    const lessonIndexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'lesson/',
      component: () => <>{children}</>,
    });
    const lessonDetailRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'lesson/$lessonId',
      component: () => (
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6">
          <p className="type-body font-semibold text-foreground">
            Lesson detail preview
          </p>
          <p className="mt-2 type-caption text-muted-foreground">
            The lesson index link is wired to the detail route.
          </p>
        </div>
      ),
    });

    return createRouter({
      history: createMemoryHistory({ initialEntries: ['/lesson/'] }),
      routeTree: rootRoute.addChildren([lessonIndexRoute, lessonDetailRoute]),
    });
  }, [children]);

  return <RouterProvider router={router} />;
}

const meta = {
  title: 'Lesson/LessonPage',
  component: LessonPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <RouterDecorator>
        <Story />
      </RouterDecorator>
    ),
  ],
  args: { lessons },
} satisfies Meta<typeof LessonPage>;

export default meta;

type Story = StoryObj<typeof meta>;

function setSavedLevelForStory(level: string | null) {
  return () => {
    seedSavedLevel(level);
    return () => seedSavedLevel(null);
  };
}

function seedSavedLevel(level: string | null) {
  if (level === null) {
    window.localStorage.removeItem(LESSON_LEVEL_PREFERENCE_KEY);
  } else {
    window.localStorage.setItem(LESSON_LEVEL_PREFERENCE_KEY, level);
  }
}

export const ActiveCourse: Story = {
  beforeEach: setSavedLevelForStory(null),
};

export const ResumePriority: Story = {
  args: { lessons: resumePriorityLessons },
  beforeEach: setSavedLevelForStory(null),
};

export const RememberedCourse: Story = {
  beforeEach: setSavedLevelForStory('B1'),
};

export const AllLessonsCompleted: Story = {
  args: {
    lessons: lessons.map((lesson) => ({ ...lesson, state: 'completed' })),
  },
  beforeEach: setSavedLevelForStory(null),
};

export const Loading: Story = {
  args: { lessons: [], isLoading: true },
  beforeEach: setSavedLevelForStory(null),
};

export const ErrorState: Story = {
  args: { lessons: [], isError: true, onRetry: fn() },
  beforeEach: setSavedLevelForStory(null),
};

export const EmptyState: Story = {
  args: { lessons: [] },
  beforeEach: setSavedLevelForStory(null),
};
