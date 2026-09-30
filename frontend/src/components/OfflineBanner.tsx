import { CloudOff, Loader2, Wifi } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useServiceWorker';
import { useBackendStatus } from '../hooks/useBackendStatus';

/**
 * Persistent warning while the browser is offline OR the API itself is not
 * answering. Data is never served from a stale cache, so this is here to stop
 * staff from assuming a save went through.
 */
export default function OfflineBanner() {
  const browserOnline = useOnlineStatus();
  const backend = useBackendStatus();
  const backendOnline = backend.data?.online ?? true;

  if (browserOnline && backendOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white no-print"
    >
      <CloudOff size={16} />
      {!browserOnline
        ? 'You are offline. Changes will not be saved until the connection returns.'
        : 'Backend unreachable — live data is paused. Retrying automatically…'}
    </div>
  );
}

/** Small pill in the header showing live API connectivity at a glance. */
export function OnlineStatusPill() {
  const browserOnline = useOnlineStatus();
  const backend = useBackendStatus();
  const checking = backend.isFetching && !backend.data;
  const backendOnline = backend.data?.online ?? true;

  const state = !browserOnline
    ? 'offline'
    : backendOnline
      ? 'online'
      : 'down';

  const label = state === 'online' ? 'Live' : state === 'down' ? 'Backend down' : 'Offline';
  const title =
    state === 'online'
      ? `Connected to ${backend.data?.base ?? 'backend'}`
      : state === 'down'
        ? `Backend unreachable (${backend.data?.error ?? 'no response'}) — retrying every 15s`
        : 'No network connection';

  return (
    <span
      title={title}
      className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold sm:inline-flex ${
        state === 'online'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
          : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
      }`}
    >
      {checking ? (
        <Loader2 size={12} className="animate-spin" />
      ) : state === 'online' ? (
        <Wifi size={12} />
      ) : (
        <CloudOff size={12} />
      )}
      {checking ? 'Checking…' : label}
    </span>
  );
}
