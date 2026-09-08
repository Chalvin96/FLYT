import { createFileRoute } from '@tanstack/react-router';

import { getReadingStories } from '@/api/reading';
import { readingKeys } from '@/hooks/reading/queries';
import { ThemeDetailPage } from '@/pages/ReadingPage/ThemeDetailPage';
import { type ReadingStoryListResponse } from '@/types/api';

const DEFAULT_STORY_FILTERS = {
  selectedLevels: [] as readonly string[],
  showReadStories: true,
} as const;

function ReadingThemeRouteComponent() {
  const { key } = Route.useParams();
  return <ThemeDetailPage themeKey={key} />;
}

export const Route = createFileRoute('/_readingTheme/reading/themes/$key')({
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchInfiniteQuery({
      queryKey: readingKeys.storiesInfinite(params.key, DEFAULT_STORY_FILTERS),
      queryFn: ({ pageParam }) =>
        getReadingStories(params.key, {
          cursor: pageParam,
          limit: 20,
          levels: [...DEFAULT_STORY_FILTERS.selectedLevels],
          showReadStories: DEFAULT_STORY_FILTERS.showReadStories,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: ReadingStoryListResponse) =>
        lastPage.nextCursor,
    });
  },
  component: ReadingThemeRouteComponent,
});
