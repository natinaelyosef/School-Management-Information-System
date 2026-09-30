import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Table, { type Column } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import {
  createEvent,
  deleteEvent,
  fetchAdminEvents,
  updateEvent,
  type EventPayload,
  type SchoolEvent,
} from '../../api/content';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';

const toLocalInput = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY: EventPayload = {
  title: '',
  description: '',
  location: '',
  audience: 'all',
  starts_at: '',
  ends_at: '',
  status: 'draft',
};

export default function EventsAdminPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  const [form, setForm] = useState<EventPayload>(EMPTY);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useQuery({
    queryKey: ['events', 'admin', page, status, search],
    queryFn: () => fetchAdminEvents({ page, status: status || undefined, q: search.trim() || undefined }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['events'] });

  const saveMutation = useMutation({
    mutationFn: async (payload: EventPayload) =>
      editing ? updateEvent(editing.id, payload) : createEvent(payload),
    onSuccess: async (saved) => {
      setNotice(editing ? 'Event updated.' : `Event "${saved.title}" created.`);
      setError('');
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The event could not be saved.')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => {
      setNotice('Event deleted.');
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The event could not be deleted.')),
  });

  const toggleMutation = useMutation({
    mutationFn: (event: SchoolEvent) =>
      updateEvent(event.id, { status: event.status === 'published' ? 'draft' : 'published' }),
    onSuccess: async (saved) => {
      setNotice(saved.status === 'published' ? 'Event published to the public site.' : 'Event unpublished.');
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The event could not be updated.')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setOpen(true);
  };

  const openEdit = (event: SchoolEvent) => {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      audience: event.audience ?? 'all',
      starts_at: toLocalInput(event.starts_at),
      ends_at: toLocalInput(event.ends_at),
      status: event.status,
    });
    setError('');
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.starts_at) return;
    saveMutation.mutate({
      ...form,
      title: form.title.trim(),
      description: form.description?.trim() || null,
      location: form.location?.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    });
  };

  const rows = query.data?.data ?? [];

  const columns: Column<SchoolEvent>[] = [
    {
      key: 'title',
      header: 'Event',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">{r.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{r.description ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'starts_at',
      header: 'When',
      render: (r) => new Date(r.starts_at).toLocaleString(),
    },
    { key: 'location', header: 'Location', render: (r) => r.location ?? '—' },
    { key: 'audience', header: 'Audience', render: (r) => r.audience ?? 'all' },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => <Badge tone={r.status === 'published' ? 'green' : 'yellow'}>{r.status}</Badge>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => toggleMutation.mutate(r)} disabled={toggleMutation.isPending}>
            {r.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
            <Pencil size={14} /> {t('common.edit')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(`Delete "${r.title}"?`)) deleteMutation.mutate(r.id);
            }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.events.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('pages.events.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <CalendarPlus size={16} /> New event
        </Button>
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {query.isError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {apiErrorMessage(query.error, 'The events service could not be reached. Check the events.manage permission.')}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[16rem] flex-1 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search title or location…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <Select label={t('common.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-44">
          <option value="">{t('common.allStatuses')}</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </Select>
      </div>

      <Table<SchoolEvent>
        columns={columns}
        rows={rows}
        emptyText={
          query.isPending
            ? 'Loading events…'
            : query.isError
              ? 'No events loaded.'
              : 'No events match the current filters.'
        }
      />

      {query.data && query.data.last_page > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {query.data.current_page} / {query.data.last_page}
          </span>
          <Button variant="outline" size="sm" disabled={page >= query.data.last_page || query.isFetching} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal open={open} title={editing ? 'Edit event' : 'New event'} onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
          <Input label={t('common.title')} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Description</span>
            <textarea
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Location" value={form.location ?? ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            <Select label="Audience" value={form.audience ?? 'all'} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}>
              <option value="all">Everyone</option>
              <option value="student">Students</option>
              <option value="parent">Parents</option>
              <option value="teacher">Teachers</option>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Starts</span>
              <input
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Ends</span>
              <input
                type="datetime-local"
                value={form.ends_at ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <Select label={t('common.status')} value={form.status ?? 'draft'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'draft' | 'published' }))}>
            <option value="draft">Draft (hidden)</option>
            <option value="published">Published (public)</option>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
