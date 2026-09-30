import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Search } from 'lucide-react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Table, { type Column } from '../../components/ui/Table';
import {
  fetchAudit,
  fetchAuditActions,
  fetchAuditUsers,
  type AuditEntry,
} from '../../api/content';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';

const shortType = (value?: string | null): string => {
  if (!value) return '—';
  const parts = value.split('\\');
  return parts[parts.length - 1];
};

const summarise = (row: AuditEntry): string => {
  const source = row.new_values ?? row.old_values;
  if (!source) return '—';
  const keys = Object.keys(source).slice(0, 3);
  if (keys.length === 0) return '—';
  return keys.map((k) => `${k}=${String(source[k])}`).join(', ');
};

export default function AuditPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = useQuery({
    queryKey: ['audit', page, search, action, userId, from, to],
    queryFn: () =>
      fetchAudit({
        page,
        q: search.trim() || undefined,
        action: action || undefined,
        user_id: userId ? Number(userId) : undefined,
        from: from || undefined,
        to: to || undefined,
        per_page: 30,
      }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const actionsQuery = useQuery({ queryKey: ['audit', 'actions'], queryFn: fetchAuditActions, staleTime: 5 * 60_000, retry: 1 });
  const usersQuery = useQuery({ queryKey: ['audit', 'users'], queryFn: fetchAuditUsers, staleTime: 5 * 60_000, retry: 1 });

  const rows = query.data?.data ?? [];

  const columns: Column<AuditEntry>[] = [
    {
      key: 'created_at',
      header: 'When',
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: 'user',
      header: 'User',
      render: (r) => r.user?.name ?? (r.user_id ? `User #${r.user_id}` : 'System'),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => <span className="font-semibold text-slate-900 dark:text-slate-50">{r.action}</span>,
    },
    {
      key: 'auditable',
      header: 'Record',
      render: (r) =>
        r.auditable_id ? `${shortType(r.auditable_type)} #${r.auditable_id}` : '—',
    },
    { key: 'changes', header: 'Changed fields', render: (r) => <span className="text-xs">{summarise(r)}</span> },
    { key: 'ip', header: 'IP', render: (r) => <span className="text-xs text-slate-500 dark:text-slate-400">{r.ip_address ?? '—'}</span> },
  ];

  const reset = () => {
    setPage(1);
    setSearch('');
    setAction('');
    setUserId('');
    setFrom('');
    setTo('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.audit.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Who changed what, when — straight from the <code>audit.log</code> middleware
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-sm font-bold text-blue-800 dark:text-blue-200">
          <History size={16} /> {query.data?.total ?? rows.length} entries
        </span>
      </div>

      {query.isError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {apiErrorMessage(query.error, 'The audit trail could not be loaded. Check that your account has the audit.view permission.')}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
          <Search size={16} className="text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search action or record type…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <Select label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">All actions</option>
          {(actionsQuery.data ?? []).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
        <Select label="User" value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">All users</option>
          {(usersQuery.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">From</span>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">To</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
        </label>
        <Button variant="outline" onClick={reset}>Reset</Button>
      </div>

      <Table<AuditEntry>
        columns={columns}
        rows={rows}
        emptyText={
          query.isPending
            ? 'Loading audit trail…'
            : query.isError
              ? 'No entries loaded.'
              : 'No audit entries match the current filters.'
        }
      />

      {query.data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rows.length} of {query.data.total} entries
            {query.data.last_page > 1 && ` — page ${query.data.current_page} of ${query.data.last_page}`}.
          </p>
          {query.data.last_page > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= query.data.last_page || query.isFetching} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
