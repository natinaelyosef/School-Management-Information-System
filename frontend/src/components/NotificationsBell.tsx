import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Settings2 } from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadCount,
  fetchNotificationChannels,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../api/notifications';
import { formatDate } from '../utils/format';
import type { NotificationChannels, NotificationItem } from '../api/notifications';

const TYPE_TONE: Record<string, string> = {
  payment: 'bg-yellow-100 dark:bg-yellow-900/50 dark:bg-yellow-900/50 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 dark:text-yellow-200 dark:text-yellow-200',
  absent: 'bg-red-100 dark:bg-red-900/50 dark:bg-red-900/50 dark:bg-red-900/50 text-red-800 dark:text-red-200 dark:text-red-200 dark:text-red-200',
  assignment: 'bg-blue-100 dark:bg-blue-900/50 dark:bg-blue-900/50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 dark:text-blue-200 dark:text-blue-200',
  exam: 'bg-purple-100 dark:bg-purple-900/50 dark:bg-purple-900/50 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 dark:text-purple-200 dark:text-purple-200',
  application: 'bg-green-100 dark:bg-green-900/50 dark:bg-green-900/50 dark:bg-green-900/50 text-green-800 dark:text-green-200 dark:text-green-200 dark:text-green-200',
  message: 'bg-slate-100 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:text-slate-300 dark:text-slate-300',
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchUnreadCount,
    // Light polling stands in for a websocket broker: cheap (one COUNT query)
    // and enough for an in-app badge.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: fetchNotifications,
    enabled: open,
    retry: false,
  });

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const channelsQuery = useQuery({
    queryKey: ['notifications', 'channels'],
    queryFn: fetchNotificationChannels,
    enabled: showPrefs,
    retry: false,
  });

  const savePrefs = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = countQuery.data ?? 0;
  const items: NotificationItem[] = listQuery.data ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={`Notifications (${unread} unread)`}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed sm:absolute inset-x-2.5 sm:inset-x-auto sm:right-0 top-14 sm:top-auto z-50 mt-2 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 shrink-0">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50">Notifications</h4>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPrefs((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  title="Notification settings"
                >
                  <Settings2 size={14} /> Settings
                </button>
                <button
                  onClick={() => readAll.mutate()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              </div>
            </div>

            {showPrefs && (
              <NotificationPrefs
                channels={channelsQuery.data}
                loading={channelsQuery.isLoading || savePrefs.isPending}
                onToggle={(key, on) => savePrefs.mutate({ [key]: on })}
              />
            )}

            <div className="max-h-96 overflow-y-auto">
              {listQuery.isLoading && (
                <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
              )}
              {!listQuery.isLoading && items.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">You're all caught up.</p>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read_at) readOne.mutate(n.id);
                  }}
                  className={`block w-full border-b border-slate-50 dark:border-slate-800 dark:border-slate-800 dark:border-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900 dark:hover:bg-slate-900 dark:hover:bg-slate-900 ${
                    n.read_at ? 'opacity-70' : 'bg-blue-50 dark:bg-blue-950/40 dark:bg-blue-950/40 dark:bg-blue-950/40/40 dark:bg-blue-950/40'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{n.body}</p>}
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            TYPE_TONE[n.type] ?? TYPE_TONE.message
                          }`}
                        >
                          {n.type}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  sms: 'SMS',
  telegram: 'Telegram',
};

const CHANNEL_PREF_KEYS: Record<string, 'notify_sms' | 'notify_telegram'> = {
  sms: 'notify_sms',
  telegram: 'notify_telegram',
};

type ChannelPrefKey = 'notify_sms' | 'notify_telegram';

function NotificationPrefs({
  channels,
  loading,
  onToggle,
}: {
  channels: NotificationChannels | undefined;
  loading: boolean;
  onToggle: (key: ChannelPrefKey, on: boolean) => void;
}) {
  if (loading && !channels) {
    return <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Loading settings…</p>;
  }

  const entries = Object.entries(channels?.channels ?? {}).filter(
    ([name]) => name in CHANNEL_PREF_KEYS,
  );

  return (
    <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery channels</p>

      {entries.length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">No external channels are available on this server.</p>
      )}

      {entries.map(([name, state]) => (
        <label key={name} className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={state.opted_in}
            disabled={!state.enabled || loading}
            onChange={(e) => onToggle(CHANNEL_PREF_KEYS[name], e.target.checked)}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
              {CHANNEL_LABELS[name] ?? name}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {!state.enabled
                ? 'Not configured by the administrator.'
                : name === 'sms'
                  ? channels?.has_phone
                    ? 'Send to your saved phone number.'
                    : 'Add a phone number in your profile to enable this.'
                  : channels?.has_telegram_chat_id
                    ? 'Send to your saved Telegram chat.'
                    : 'Add your Telegram chat ID to enable this.'}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
