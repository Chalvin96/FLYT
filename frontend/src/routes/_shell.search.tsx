import { createFileRoute, redirect } from '@tanstack/react-router';

type SearchRouteSearch = {
  q?: string;
};

export const Route = createFileRoute('/_shell/search')({
  validateSearch: (search: Record<string, unknown>): SearchRouteSearch => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  beforeLoad: ({ search }) => {
    const q = search.q;
    throw redirect({
      to: '/home',
      search: q ? { lookup: q } : {},
    });
  },
});
