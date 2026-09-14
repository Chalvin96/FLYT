import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import { ChatbotProvider } from '@/components/chatbot/ChatbotProvider';
import { LookupProvider } from '@/components/lookup/LookupProvider';

import { Route as storyRoute } from './_reader.reading.story.$uuid';

const { getReadingStory, getReadingStoryRecommendations, saveReadingProgress } =
  vi.hoisted(() => ({
    getReadingStory: vi.fn(),
    getReadingStoryRecommendations: vi.fn(),
    saveReadingProgress: vi.fn(),
  }));

vi.mock('@/api/reading', () => ({
  getReadingStory,
  getReadingStoryRecommendations,
  saveReadingProgress,
}));

function storyResponse(pageIndex: number, totalPages = 2) {
  return {
    uuid: 'story-1',
    title: 'Morning Coffee',
    cefrLevel: 'A1',
    groupKey: 'daily_life',
    groupTitle: 'Daily Life',
    page: {
      index: pageIndex,
      content: 'Page ' + (pageIndex + 1),
      tokens: [],
    },
    totalPages,
    lastPageIndex: 1,
    completed: false,
    userStates: {},
  };
}

function createTestRouter(beforeLoad?: () => Promise<void>) {
  const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => (
      <ChatbotProvider>
        <LookupProvider>
          <Outlet />
        </LookupProvider>
      </ChatbotProvider>
    ),
  });
  const readerRoute = createRoute({
    id: '_reader',
    getParentRoute: () => rootRoute,
    beforeLoad: ({ location }) =>
      Number((location.search as { page?: unknown }).page) === 2
        ? beforeLoad?.()
        : undefined,
  });
  const route = createRoute({
    path: '/reading/story/$uuid',
    getParentRoute: () => readerRoute,
    validateSearch: storyRoute.options.validateSearch as never,
    loaderDeps: storyRoute.options.loaderDeps as never,
    loader: storyRoute.options.loader as never,
    component: storyRoute.options.component as never,
  });

  return createRouter({
    context: {
      queryClient: new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false },
        },
      }),
    },
    history: createMemoryHistory({
      initialEntries: ['/reading/story/story-1?page=1'],
    }),
    routeTree: rootRoute.addChildren([
      readerRoute.addChildren([route as never]) as never,
    ]),
  });
}

describe('reader route navigation boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) =>
      storyResponse(page ?? 0),
    );
    getReadingStoryRecommendations.mockResolvedValue({ stories: [] });
    saveReadingProgress.mockResolvedValue(undefined);
  });

  it('test_reader_navigation_given_delayed_page_request_expect_url_and_placeholder_commit_before_response', async () => {
    let releasePageTwo = () => {};
    const pageTwoPending = new Promise<void>((resolve) => {
      releasePageTwo = resolve;
    });
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) => {
      if (page === 1) await pageTwoPending;
      return storyResponse(page ?? 0);
    });

    const router = createTestRouter();
    const queryClient = router.options.context.queryClient;
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Page 1')).toBeInTheDocument();

    await act(async () => {
      await router.navigate({
        to: '/reading/story/$uuid',
        params: { uuid: 'story-1' },
        search: { page: 2 },
      });
    });

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ page: 2 });
      expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'true');
    });
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.queryByText('Page 2')).not.toBeInTheDocument();
    await act(async () => {
      releasePageTwo();
      await Promise.resolve();
    });
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'false'),
    );
  });

  it('test_reader_canonicalization_given_newer_request_expect_stale_result_ignored', async () => {
    let releasePageNinetyNine: () => void = () => undefined;
    const pageNinetyNinePending = new Promise<void>((resolve) => {
      releasePageNinetyNine = resolve;
    });
    let releasePageTwoNavigation: () => void = () => undefined;
    const pageTwoNavigationPending = new Promise<void>((resolve) => {
      releasePageTwoNavigation = resolve;
    });
    getReadingStory.mockImplementation(async (_uuid: string, page?: number) => {
      if (page === 98) {
        await pageNinetyNinePending;
        return storyResponse(4, 5);
      }
      return storyResponse(page ?? 0, 5);
    });

    const router = createTestRouter(() => pageTwoNavigationPending);
    const queryClient = router.options.context.queryClient;
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Page 1')).toBeInTheDocument();

    await act(async () => {
      await router.navigate({
        to: '/reading/story/$uuid',
        params: { uuid: 'story-1' },
        search: { page: 99 },
      });
    });
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ page: 99 }),
    );

    let newerNavigation = Promise.resolve();
    act(() => {
      newerNavigation = router.navigate({
        to: '/reading/story/$uuid',
        params: { uuid: 'story-1' },
        search: { page: 2 },
      });
    });
    await waitFor(() =>
      expect(router.latestLocation.search).toEqual({ page: 2 }),
    );

    await act(async () => {
      releasePageNinetyNine();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('article')).toHaveTextContent('Page 5');
    });
    expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'false');
    expect(router.latestLocation.search).toEqual({ page: 2 });

    await act(async () => {
      releasePageTwoNavigation();
      await newerNavigation;
    });
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
  });
});
