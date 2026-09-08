import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { useMemo } from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

import { ErrorBoundary } from './ErrorBoundary';

function withRouter(children: React.ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'home',
    component: () => null,
  });
  return createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([homeRoute]),
  });
}

function RouterDecorator({ children }: { children: React.ReactNode }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const router = useMemo(() => withRouter(children), []);
  return <RouterProvider router={router} />;
}

const meta = {
  title: 'Common/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <RouterDecorator>
        <Story />
      </RouterDecorator>
    ),
  ],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    error: new Error('Failed to load this screen.'),
    reset: fn(),
    showHomeLink: false,
    onLogError: fn(),
  },
};

export const WithHomeLink: Story = {
  args: {
    error: new Error('Network failure.'),
    reset: fn(),
    homeTo: '/home',
    showHomeLink: true,
    onLogError: fn(),
  },
};

export const WithCustomContent: Story = {
  args: {
    error: 'Reading request timed out.',
    badgeText: 'Reading error',
    title: 'Could not load reading',
    description: 'Please retry to reload this reading.',
    resetLabel: 'Retry loading',
    reset: fn(),
    showHomeLink: false,
    onLogError: fn(),
  },
};

export const UnknownError: Story = {
  args: {
    error: { code: 42 },
    reset: fn(),
    showHomeLink: false,
    onLogError: fn(),
  },
};
