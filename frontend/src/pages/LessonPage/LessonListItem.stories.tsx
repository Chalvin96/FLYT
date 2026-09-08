import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import type { LessonSummaryRead } from '@/types/api';

import { LessonListItem } from './LessonListItem';

const baseLesson: LessonSummaryRead = {
  id: 12,
  source_id: 'lesson-subordinate-because',
  kind: 'grammar',
  family_id: 'subordinate-clauses',
  title: 'Because-clauses and verb position',
  cefr_level: 'A2',
  goal: 'Explain a reason with fordi and keep the verb in the right place.',
  order: 12,
  state: 'not_started',
  estimated_minutes: 8,
  last_activity_at: null,
};

function RouterDecorator({ children }: { children: React.ReactNode }) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({ component: () => <>{children}</> });
    const lessonRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'lesson/$lessonId',
      component: () => null,
    });

    return createRouter({
      history: createMemoryHistory({ initialEntries: ['/lesson/12'] }),
      routeTree: rootRoute.addChildren([lessonRoute]),
    });
  }, [children]);

  return <RouterProvider router={router} />;
}

const meta = {
  title: 'Lesson/LessonListItem',
  component: LessonListItem,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <RouterDecorator>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border bg-card">
          <Story />
        </div>
      </RouterDecorator>
    ),
  ],
} satisfies Meta<typeof LessonListItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotStarted: Story = {
  args: { lesson: baseLesson },
};

export const InProgress: Story = {
  args: {
    lesson: {
      ...baseLesson,
      state: 'in_progress',
      title: 'Talking about routines',
      order: 13,
      estimated_minutes: 10,
    },
  },
};

export const Completed: Story = {
  args: {
    lesson: {
      ...baseLesson,
      state: 'completed',
      title: 'Past tense: regular verbs',
      order: 11,
      estimated_minutes: 7,
    },
  },
};
