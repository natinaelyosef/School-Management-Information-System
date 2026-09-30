import { useQuery } from '@tanstack/react-query';
import { probeBackend } from '../api/client';

/**
 * Polls the backend health endpoint so the UI knows whether the API itself is
 * reachable (navigator.onLine only reports the network, not the server).
 */
export function useBackendStatus(intervalMs = 15_000) {
  return useQuery({
    queryKey: ['backend-status'],
    queryFn: () => probeBackend(),
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 5_000,
  });
}

export default useBackendStatus;
