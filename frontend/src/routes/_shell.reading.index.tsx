import { createFileRoute } from '@tanstack/react-router';

import { getReadingHome } from '@/api/reading';
import { readingKeys } from '@/hooks/reading/queries';
import { ReadingPage } from '@/pages/ReadingPage/ReadingPage';

export const Route = createFileRoute('/_shell/reading/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: readingKeys.home,
      queryFn: getReadingHome,
    });
  },
  component: ReadingPage,
});
