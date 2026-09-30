import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import {
  fetchInquiries,
  updateInquiry,
  type Inquiry,
} from '../../api/content';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';

const STATUSES: Array<Inquiry['status']> = ['new', 'contacted', 'follow_up', 'resolved', 'closed'];

const TONES: Record<Inquiry['status'], 'blue' | 'yellow' | 'purple' | 'green' | 'slate'> = {
  new: 'blue',
  contacted: 'yellow',
  follow_up: 'purple',
  resolved: 'green',
  closed: 'slate',
};

export default function InquiriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState<Record<number, { status: Inquiry['status']; staff_notes: string }>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const query = useQuery({
    queryKey: ['inquiries', status],
    queryFn: () => fetchInquiries({ status: status || undefined, per_page: 50 }),
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: (input: { id: number; status: Inquiry['status']; staff_notes: string }) =>
      updateInquiry(input.id, { status: input.status, staff_notes: input.staff_notes || null }),
    onSuccess: async (saved) => {
      setNotice(`${saved.reference} updated.`);
      setError('');
      setDrafts((d) => {
        const next = { ...d };
        delete next[saved.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['inquiries'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'The inquiry could not be updated.')),
  });

  const rows = query.data?.data ?? [];

  const draftFor = (row: Inquiry) =>
    drafts[row.id] ?? { status: row.status, staff_notes: row.staff_notes ?? '' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.inquiries.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('pages.inquiries.subtitle')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-sm font-bold text-blue-800 dark:text-blue-200">
          <Mail size={16} /> {query.data?.total ?? rows.length} inquiries
        </span>
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {query.isError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {apiErrorMessage(query.error, 'The inquiries inbox could not be loaded. Check the inquiries.view permission.')}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Select label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-52">
          <option value="">{t('common.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </Select>
      </div>

      {query.isPending && <p className="text-sm text-slate-500 dark:text-slate-400">Loading inquiries…</p>}

      {!query.isPending && rows.length === 0 && !query.isError && (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400">
          No inquiries match the current filter.
        </p>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const draft = draftFor(row);
          const dirty = draft.status !== row.status || draft.staff_notes !== (row.staff_notes ?? '');
          return (
            <article
              key={row.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900 dark:text-slate-50">{row.name}</h2>
                    <Badge tone={TONES[row.status]}>{row.status.replace(/_/g, ' ')}</Badge>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{row.reference}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {row.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {row.email}</span>}
                    {row.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {row.phone}</span>}
                    <span>{row.type}</span>
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {row.handler && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">Handled by {row.handler.name}</span>
                )}
              </div>

              {row.subject && <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{row.subject}</p>}
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{row.message}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <Select
                  label={t('common.status')}
                  value={draft.status}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.id]: { ...draft, status: e.target.value as Inquiry['status'] } }))
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </Select>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Staff notes</span>
                  <input
                    value={draft.staff_notes}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [row.id]: { ...draft, staff_notes: e.target.value } }))
                    }
                    placeholder="What happened on the call?"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </label>
                <Button
                  size="sm"
                  disabled={!dirty || saveMutation.isPending}
                  onClick={() => saveMutation.mutate({ id: row.id, status: draft.status, staff_notes: draft.staff_notes })}
                >
                  <Save size={14} /> Save
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
