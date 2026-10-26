import { createFileRoute } from '@tanstack/react-router';

import { getReadingStories } from '@/api/reading';
import { READING_LEVELS } from '@/components/reading/readingLevels';
import {
  READING_STORIES_PAGE_SIZE,
  readingKeys,
} from '@/hooks/reading/queries';
import { ThemeDetailPage } from '@/pages/ReadingPage/ThemeDetailPage';
import { type ReadingStoryListResponse } from '@/types/api';

interface ReadingThemeSearch {
  levels?: string[];
}

function ReadingThemeRouteComponent() {
  const { key } = Route.useParams();
  const { levels } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ThemeDetailPage
      themeKey={key}
      selectedLevels={levels ?? []}
      onSelectedLevelsChange={(selected) =>
        void navigate({
          replace: true,
          search: (previous) => ({
            ...previous,
            levels: selected.length > 0 ? selected : undefined,
          }),
        })
      }
    />
  );
}

export const Route = createFileRoute('/_readingBack/reading/themes/$key')({
  validateSearch: (search: Record<string, unknown>): ReadingThemeSearch => {
    const levels = search.levels;
    return {
      levels: Array.isArray(levels)
        ? READING_LEVELS.filter((level) => levels.includes(level))
        : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ levels: search.levels ?? [] }),
  loader: async ({ context, params, deps }) => {
    await context.queryClient.prefetchInfiniteQuery({
      queryKey: readingKeys.storiesInfinite(params.key, {
        selectedLevels: deps.levels,
        showReadStories: true,
      }),
      queryFn: ({ pageParam }) =>
        getReadingStories(params.key, {
          cursor: pageParam,
          limit: READING_STORIES_PAGE_SIZE,
          levels: deps.levels,
          showReadStories: true,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: ReadingStoryListResponse) =>
        lastPage.nextCursor,
    });
  },
  component: ReadingThemeRouteComponent,
});
