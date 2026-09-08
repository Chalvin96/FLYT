import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { useLookupContext } from '@/components/lookup/useLookupContext';
import { useDashboardStats } from '@/hooks/dashboard/queries';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage';

type HomeSearch = {
  lookup?: string;
};

function HomeRouteComponent() {
  const { data: stats, isError, isPending: isLoading } = useDashboardStats();
  const navigate = useNavigate();
  const { openSearch } = useLookupContext();
  const search = Route.useSearch();

  // Auto-open search with lookup query param
  useEffect(() => {
    if (search.lookup) {
      openSearch(search.lookup);
      // Clear the search param from URL
      void navigate({ replace: true, search: {}, to: '/home' });
    }
  }, [search.lookup, openSearch, navigate]);

  return (
    <DashboardPage
      stats={stats ?? null}
      isError={isError}
      isLoading={isLoading}
    />
  );
}

export const Route = createFileRoute('/_shell/home')({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    lookup: typeof search.lookup === 'string' ? search.lookup : undefined,
  }),
  component: HomeRouteComponent,
});
