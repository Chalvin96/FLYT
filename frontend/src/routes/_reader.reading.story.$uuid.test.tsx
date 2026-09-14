import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@tanstack/react-router';

const { capturedOptions } = vi.hoisted(() => ({
  capturedOptions: { current: null as Record<string, never> | null },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute:
    () =>
    (options: Record<string, never>): Record<string, never> => {
      capturedOptions.current = options;
      return options;
    },
}));

const { getReadingStory } = vi.hoisted(() => ({ getReadingStory: vi.fn() }));

vi.mock('@/api/reading', () => ({
  getReadingStory,
}));

await import('./_reader.reading.story.$uuid');

interface RouteOptions {
  validateSearch: (search: Record<string, unknown>) => { page?: number };
  loaderDeps: (input: { search: { page?: number } }) => { page?: number };
  loader: (input: {
    context: {
      queryClient: {
        cancelQueries: (filters: {
          queryKey: unknown[];
          exact: boolean;
        }) => unknown;
        ensureQueryData: (options: { queryKey: unknown[] }) => unknown;
        getQueryData: (queryKey: unknown[]) => unknown;
        prefetchQuery: (options: { queryKey: unknown[] }) => unknown;
        setQueryData: (queryKey: unknown[], data: unknown) => unknown;
      };
    };
    abortController: AbortController;
    deps: { page?: number };
    params: { uuid: string };
    cause?: 'preload' | 'enter' | 'stay';
  }) => Promise<void>;
}

function routeOptions(): RouteOptions {
  if (!capturedOptions.current) throw new Error('route options not captured');
  return capturedOptions.current as unknown as RouteOptions;
}

function storyPage(index: number, totalPages: number) {
  return {
    uuid: 'story-1',
    title: 'Morning Coffee',
    page: { index, content: '', tokens: [] },
    totalPages,
  };
}

async function runLoader({
  page,
  rejectWith,
  story,
}: {
  page?: number;
  rejectWith?: unknown;
  story?: unknown;
}) {
  const requestedPages: unknown[] = [];
  const ensureQueryData = vi.fn((options: { queryKey: unknown[] }) => {
    const [prefix, , pageKey] = options.queryKey;
    if (prefix !== 'reading-story') return Promise.resolve({ stories: [] });
    requestedPages.push(pageKey);
    return rejectWith === undefined
      ? Promise.resolve(story)
      : Promise.reject(rejectWith);
  });
  const prefetchQuery = vi.fn((options: { queryKey: unknown[] }) => {
    const [prefix, , pageKey] = options.queryKey;
    if (prefix === 'reading-story') requestedPages.push(pageKey);
    return Promise.resolve();
  });
  const setQueryData = vi.fn();
  const getQueryData = vi.fn();
  const cancelQueries = vi.fn();

  let thrown: unknown = null;
  try {
    await routeOptions().loader({
      abortController: new AbortController(),
      context: {
        queryClient: {
          cancelQueries,
          ensureQueryData,
          getQueryData,
          prefetchQuery,
          setQueryData,
        },
      },
      deps: { page },
      params: { uuid: 'story-1' },
    });
  } catch (error) {
    thrown = error;
  }

  return { requestedPages, setQueryData, thrown };
}

describe('reading story route', () => {
  it('test_story_route_given_valid_page_search_expect_that_page', () => {
    expect(routeOptions().validateSearch({ page: '3' })).toEqual({ page: 3 });
  });

  it('test_story_route_given_unusable_page_search_expect_no_page', () => {
    for (const page of ['abc', '0', '-1', '1.5', undefined]) {
      expect(routeOptions().validateSearch({ page })).toEqual({
        page: undefined,
      });
    }
  });

  it('test_story_route_given_page_search_expect_matching_page_key_loaded', async () => {
    const { requestedPages, thrown } = await runLoader({
      page: 3,
      story: storyPage(2, 12),
    });

    expect(requestedPages).toEqual([2]);
    expect(thrown).toBeNull();
  });

  it('test_story_route_given_aborted_initial_load_expect_no_canonical_side_effect', async () => {
    let releaseStory: (story: unknown) => void = () => undefined;
    const ensureQueryData = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseStory = resolve;
        }),
    );
    const setQueryData = vi.fn();
    const cancelQueries = vi.fn();
    const abortController = new AbortController();
    const loaderPromise = routeOptions().loader({
      abortController,
      context: {
        queryClient: {
          cancelQueries,
          ensureQueryData,
          getQueryData: vi.fn(),
          prefetchQuery: vi.fn(),
          setQueryData,
        },
      },
      deps: { page: 99 },
      params: { uuid: 'story-1' },
    });

    abortController.abort();
    expect(cancelQueries).toHaveBeenCalledWith({
      queryKey: ['reading-story', 'story-1', 98],
      exact: true,
    });
    releaseStory(storyPage(4, 5));

    await expect(loaderPromise).resolves.toBeUndefined();
    expect(setQueryData).not.toHaveBeenCalled();
  });

  it('test_story_route_given_no_page_search_expect_resume_key_loaded', async () => {
    const { requestedPages, thrown } = await runLoader({
      story: storyPage(4, 12),
    });

    expect(requestedPages).toEqual(['resume']);
    expect(thrown).toBeNull();
  });

  it('test_story_route_given_out_of_range_page_expect_replacing_redirect', async () => {
    const { setQueryData, thrown } = await runLoader({
      page: 99,
      story: storyPage(4, 5),
    });

    expect(isRedirect(thrown)).toBe(true);
    expect(setQueryData).toHaveBeenCalledTimes(1);
    expect(setQueryData.mock.calls[0]?.[0]).toEqual([
      'reading-story',
      'story-1',
      4,
    ]);
    expect(setQueryData.mock.calls[0]?.[1]).toMatchObject({
      page: { index: 4 },
    });
    expect((thrown as { options: unknown }).options).toMatchObject({
      to: '/reading/story/$uuid',
      params: { uuid: 'story-1' },
      search: { page: 5 },
      replace: true,
    });
  });

  it('test_story_route_given_not_ready_import_expect_no_throw', async () => {
    const notReady = {
      isAxiosError: true,
      response: {
        status: 409,
        data: { detail: { code: 'IMPORT_NOT_READY', message: 'processing' } },
      },
      config: {},
    };

    const { thrown } = await runLoader({ page: 2, rejectWith: notReady });

    expect(thrown).toBeNull();
  });

  it('test_story_route_given_failed_story_load_expect_error_rethrown', async () => {
    const failure = new Error('boom');

    const { thrown } = await runLoader({ rejectWith: failure });

    expect(thrown).toBe(failure);
  });
});
