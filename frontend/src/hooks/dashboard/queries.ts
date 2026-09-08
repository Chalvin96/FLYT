import { useQuery } from '@tanstack/react-query';

import { getDashboardStats } from '@/api/dashboard';

export const dashboardKeys = {
  stats: ['dashboard-stats'] as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: getDashboardStats,
  });
}
