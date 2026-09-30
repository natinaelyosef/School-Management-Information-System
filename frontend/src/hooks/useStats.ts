import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../api/academics';

/**
 * Dashboard stats, polled so every card stays in step with the backend instead
 * of freezing on the first payload of the session.
 */
export function useStats(intervalMs = 30_000) {
  return useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 10_000,
  });
}

export default useStats;
