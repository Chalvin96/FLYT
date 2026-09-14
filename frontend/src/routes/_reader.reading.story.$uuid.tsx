import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { isAxiosError } from 'axios';

import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { parseReaderPage } from '@/components/reading/utils';
import {
  readingKeys,
  readingStoryPageQueryOptions,
} from '@/hooks/reading/queries';
import { getApiErrorCode } from '@/lib/apiError';
import { StoryReaderPage } from '@/pages/ReadingPage/StoryReaderPage';
import { IMPORT_ERROR_CODES, type ReadingStoryPageResponse } from '@/types/api';

interface ReadingStorySearch {
  page?: number;
}

function isImportNotReady(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 409 &&
    getApiErrorCode(error) === IMPORT_ERROR_CODES.NOT_READY
  );
}

function cacheResolvedStoryPage(
  queryClient: QueryClient,
  uuid: string,
  story: ReadingStoryPageResponse,
): void {
  const key = readingKeys.storyPage(uuid, story.page.index);
  if (queryClient.getQueryData(key) === undefined) {
    queryClient.setQueryData(key, story);
  }
}

function isLatestRequestedPage(
  router: ReturnType<typeof useRouter>,
  uuid: string,
  page: number,
): boolean {
  const requestedLocation = router.buildLocation({
    to: '/reading/story/$uuid',
    params: { uuid },
    search: { page },
  });
  const latestLocation = router.latestLocation;
  return (
    latestLocation.pathname === requestedLocation.pathname &&
    parseReaderPage(latestLocation.search.page) === page
  );
}

function ReadingStoryRouteComponent() {
  const { uuid } = Route.useParams();
  const { page } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const router = useRouter();

  const onPageChange = useCallback(
    (next: number) => {
      void navigate({
        to: '/reading/story/$uuid',
        params: { uuid },
        search: { page: next },
      });
    },
    [navigate, uuid],
  );

  const onResolvedPage = useCallback(
    (resolvedPage: number, story: ReadingStoryPageResponse) => {
      if (page === undefined || page === resolvedPage) return;

      if (!isLatestRequestedPage(router, uuid, page)) return;

      cacheResolvedStoryPage(queryClient, uuid, story);
      void navigate({
        to: '/reading/story/$uuid',
        params: { uuid },
        search: { page: resolvedPage },
        replace: true,
      });
    },
    [navigate, page, queryClient, router, uuid],
  );

  // Remount when the story changes so resume state cannot leak across stories.
  return (
    <StoryReaderPage
      key={uuid}
      page={page}
      onPageChange={onPageChange}
      onResolvedPage={onResolvedPage}
      storyUuid={uuid}
    />
  );
}

export const Route = createFileRoute('/_reader/reading/story/$uuid')({
  validateSearch: (search: Record<string, unknown>): ReadingStorySearch => ({
    page: parseReaderPage(search.page),
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ abortController, cause, context, deps, params }) => {
    const pageIndex = deps.page === undefined ? undefined : deps.page - 1;
    const storyQuery = readingStoryPageQueryOptions(params.uuid, pageIndex);
    if (cause === 'stay') {
      void context.queryClient.prefetchQuery(storyQuery);
      return;
    }

    const cancelAbandonedLoad = () => {
      void context.queryClient.cancelQueries({
        queryKey: storyQuery.queryKey,
        exact: true,
      });
    };
    abortController.signal.addEventListener('abort', cancelAbandonedLoad, {
      once: true,
    });

    let story: ReadingStoryPageResponse;
    try {
      story = await context.queryClient.ensureQueryData(storyQuery);
    } catch (error) {
      if (abortController.signal.aborted) return;
      if (isImportNotReady(error)) return;
      throw error;
    } finally {
      abortController.signal.removeEventListener('abort', cancelAbandonedLoad);
    }

    if (abortController.signal.aborted) return;

    const resolvedPage = story.page.index + 1;
    if (deps.page !== undefined && deps.page !== resolvedPage) {
      cacheResolvedStoryPage(context.queryClient, params.uuid, story);
      throw redirect({
        to: '/reading/story/$uuid',
        params: { uuid: params.uuid },
        search: { page: resolvedPage },
        replace: true,
      });
    }
  },
  component: ReadingStoryRouteComponent,
  errorComponent: ({ error, reset }) => (
    <ErrorBoundary
      error={error}
      reset={reset}
      homeTo="/home"
      title="Story failed"
    />
  ),
});
