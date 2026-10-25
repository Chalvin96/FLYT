import type { Meta, StoryObj } from '@storybook/react';
import { useMemo, type ReactNode } from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import type { ReadingStorySummary } from '@/types/api';

import { StoryCard } from './StoryCard';

const unreadStory: ReadingStorySummary = {
  uuid: '918bf3f0-7e66-41c7-b67f-3bcf48370201',
  title: 'Nøkkelen til det gamle huset',
  cefrLevel: 'A1',
  createdAt: '2026-09-24T10:00:00Z',
  wordCount: 320,
  readingMinutes: 3,
  isRead: false,
  completed: false,
};

const inProgressStory: ReadingStorySummary = {
  uuid: '918bf3f0-7e66-41c7-b67f-3bcf48370202',
  title: 'Fyrvokteren og gjesten som kom ved midnatt',
  cefrLevel: 'A2',
  createdAt: '2026-09-18T10:00:00Z',
  wordCount: 740,
  readingMinutes: 5,
  isRead: true,
  completed: false,
};

const completedStory: ReadingStorySummary = {
  uuid: '918bf3f0-7e66-41c7-b67f-3bcf48370203',
  title: 'En tur gjennom Oslo',
  cefrLevel: 'B2',
  createdAt: '2026-09-12T10:00:00Z',
  wordCount: 510,
  readingMinutes: 4,
  isRead: true,
  completed: true,
};

const longTitleStory: ReadingStorySummary = {
  ...inProgressStory,
  uuid: '918bf3f0-7e66-41c7-b67f-3bcf48370204',
  title:
    'Hvorfor nordmenn elsker å gå på tur i all slags vær, selv når det regner sidelengs og vinden river i jakka hele veien opp',
  wordCount: 1_300_000,
  readingMinutes: 8667,
};

const stories = [unreadStory, inProgressStory, completedStory];

function RouterDecorator({ children }: { children: ReactNode }) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({ component: () => <>{children}</> });
    const storyRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/reading/story/$uuid',
      component: () => null,
    });

    return createRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
      routeTree: rootRoute.addChildren([storyRoute]),
    });
  }, [children]);

  return <RouterProvider router={router} />;
}

const meta = {
  title: 'Features/Reading/StoryCard',
  component: StoryCard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <RouterDecorator>
        <main className="min-h-screen bg-neutral p-4 sm:p-8">
          <Story />
        </main>
      </RouterDecorator>
    ),
  ],
  args: { story: unreadStory },
  render: (args) => (
    <div className="w-full max-w-xl">
      <StoryCard {...args} />
    </div>
  ),
} satisfies Meta<typeof StoryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CardUnread: Story = {};

export const CardInProgress: Story = {
  args: { story: inProgressStory },
};

export const CardCompleted: Story = {
  args: { story: completedStory },
};

export const LongTitle: Story = {
  args: { story: longTitleStory },
};

export const ShelfRow: Story = {
  render: () => (
    <div className="max-w-3xl space-y-3">
      {stories.map((story) => (
        <div key={story.uuid} className="w-full">
          <StoryCard story={story} />
        </div>
      ))}
    </div>
  ),
};

export const Grid: Story = {
  render: () => (
    <div className="grid max-w-5xl grid-cols-1 items-start gap-4 sm:grid-cols-2">
      {stories.map((story) => (
        <StoryCard key={story.uuid} story={story} />
      ))}
    </div>
  ),
};
