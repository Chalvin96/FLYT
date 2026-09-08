import { createFileRoute } from '@tanstack/react-router';
import { isAxiosError } from 'axios';

import { getReadingStory, getReadingStoryRecommendations } from '@/api/reading';
import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { readingKeys } from '@/hooks/reading/queries';
import { getApiErrorCode } from '@/lib/apiError';
import { StoryReaderPage } from '@/pages/ReadingPage/StoryReaderPage';
import { IMPORT_ERROR_CODES } from '@/types/api';

function ReadingStoryRouteComponent() {
  const { uuid } = Route.useParams();
  // key forces a fresh instance per story so page/resume state never leaks
  // across navigations between stories.
  return <StoryReaderPage key={uuid} storyUuid={uuid} />;
}

export const Route = createFileRoute('/_reader/reading/story/$uuid')({
  loader: async ({ context, params }) => {
    const [storyResult] = await Promise.allSettled([
      // Order matters: story must be first — only story rejection throws.
      context.queryClient.ensureQueryData({
        // Must match useReadingStory's initial (resume) key, or the first
        // render misses the prefetch and refetches.
        queryKey: readingKeys.storyPage(params.uuid),
        queryFn: () => getReadingStory(params.uuid),
      }),
      context.queryClient.ensureQueryData({
        queryKey: readingKeys.storyRecommendations(params.uuid),
        queryFn: () => getReadingStoryRecommendations(params.uuid),
      }),
    ]);

    if (storyResult.status === 'rejected') {
      const error = storyResult.reason;
      // 409 IMPORT_NOT_READY is a known state, not a route-level failure.
      const isNotReady =
        isAxiosError(error) &&
        error.response?.status === 409 &&
        getApiErrorCode(error) === IMPORT_ERROR_CODES.NOT_READY;
      if (!isNotReady) {
        throw error;
      }
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
