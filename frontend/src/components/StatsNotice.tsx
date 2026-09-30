import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Shown above a dashboard when /stats could not be reached, so stale demo values
 * are never mistaken for live numbers.
 */
export default function StatsNotice({
  error,
  onRetry,
  isFetching,
}: {
  error: unknown;
  onRetry: () => void;
  isFetching?: boolean;
}) {
  if (!error) return null;

  const message =
    (error as { response?: { status?: number } })?.response?.status === 403
      ? 'You do not have permission to load these statistics.'
      : 'Live stats unavailable — the backend did not respond. Values below may be stale.';

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-100"
    >
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
      >
        <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Retry
      </button>
    </div>
  );
}
