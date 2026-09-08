import type { DashboardStatsRead } from '@/types/api';

import { client } from './client';

export async function getDashboardStats(): Promise<DashboardStatsRead> {
  return (await client.get<DashboardStatsRead>('/me/dashboard/stats')).data;
}
