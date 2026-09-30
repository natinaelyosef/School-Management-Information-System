import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Table, { type Column } from '../../components/ui/Table';
import {
  completePaymentTask,
  fetchPaymentTasks,
  reopenPaymentTask,
  type PaymentTask,
} from '../../api/content';
import { apiErrorMessage } from '../../utils/errors';
import { useTranslation } from 'react-i18next';

const OUTCOMES: Array<{ value: string; label: string }> = [
  { value: 'reached', label: 'Reached the parent' },
  { value: 'will_pay', label: 'Parent will pay' },
  { value: 'arrangement', label: 'Payment arrangement agreed' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'other', label: 'Other' },
];

const studentName = (row: PaymentTask): string => {
  const s = row.invoice?.student ?? row.student;
  return s ? `${s.first_name} ${s.last_name}` : '—';
};

export default function PaymentTasksPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('open');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [completing, setCompleting] = useState<PaymentTask | null>(null);
  const [outcome, setOutcome] = useState('reached');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const query = useQuery({
    queryKey: ['payment-tasks', page, status, type],
    queryFn: () => fetchPaymentTasks({ page, status: status || undefined, type: type || undefined }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payment-tasks'] });

  const completeMutation = useMutation({
    mutationFn: (input: { id: number; outcome: string; notes: string }) =>
      completePaymentTask(input.id, { outcome: input.outcome, notes: input.notes || null }),
    onSuccess: async () => {
      setNotice('Follow-up task marked complete.');
      setError('');
      setCompleting(null);
      setNotes('');
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The task could not be completed.')),
  });

  const reopenMutation = useMutation({
    mutationFn: reopenPaymentTask,
    onSuccess: async () => {
      setNotice('Task reopened.');
      setError('');
      await invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The task could not be reopened.')),
  });

  const rows = query.data?.data ?? [];

  const columns: Column<PaymentTask>[] = [
    {
      key: 'title',
      header: 'Task',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-50">{r.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {studentName(r)}
            {r.invoice?.invoice_no ? ` · ${r.invoice.invoice_no}` : ''}
            {r.due_date ? ` · due ${new Date(r.due_date).toLocaleDateString()}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'type', header: t('common.type'), render: (r) => r.type.replace(/_/g, ' ') },
    { key: 'priority', header: 'Priority', render: (r) => <Badge tone={r.priority === 'high' ? 'red' : r.priority === 'low' ? 'slate' : 'yellow'}>{r.priority}</Badge> },
    {
      key: 'status',
      header: t('common.status'),
      render: (r) => <Badge tone={r.status === 'completed' ? 'green' : 'blue'}>{r.status}</Badge>,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (r) => r.assignee?.name ?? '—',
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (r) =>
        r.outcome ? (
          <div className="text-xs">
            <p className="font-semibold">{OUTCOMES.find((o) => o.value === r.outcome)?.label ?? r.outcome}</p>
            {r.outcome_notes && <p className="text-slate-500 dark:text-slate-400">{r.outcome_notes}</p>}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (r) =>
        r.status === 'open' ? (
          <Button size="sm" onClick={() => { setCompleting(r); setOutcome('reached'); setNotes(''); }}>
            <CheckCircle2 size={14} /> Complete
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={reopenMutation.isPending} onClick={() => reopenMutation.mutate(r.id)}>
            <RotateCcw size={14} /> Reopen
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.paymentTasks.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('pages.paymentTasks.subtitle')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-sm font-bold text-blue-800 dark:text-blue-200">
          {query.data?.total ?? rows.length} tasks
        </span>
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {query.isError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {apiErrorMessage(query.error, 'The follow-up queue could not be loaded. Check the tasks.view permission.')}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t('common.status')}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="sm:w-48"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="open">Open</option>
          <option value="completed">Completed</option>
        </Select>
        <Select
          label="Type"
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="sm:w-48"
        >
          <option value="">{t('common.allTypes')}</option>
          <option value="contact_parent">Contact parent</option>
          <option value="reminder">Reminder</option>
        </Select>
      </div>

      <Table<PaymentTask>
        columns={columns}
        rows={rows}
        emptyText={
          query.isPending
            ? 'Loading tasks…'
            : query.isError
              ? 'No tasks loaded.'
              : status === 'open'
                ? 'No open follow-ups — nothing is overdue.'
                : 'No tasks match the current filter.'
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

      <Modal open={completing !== null} title="Complete follow-up" onClose={() => setCompleting(null)}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {completing?.title} — {completing ? studentName(completing) : ''}
          </p>
          <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCompleting(null)}>{t('common.cancel')}</Button>
            <Button
              disabled={completeMutation.isPending}
              onClick={() => {
                if (!completing) return;
                completeMutation.mutate({ id: completing.id, outcome, notes });
              }}
            >
              {completeMutation.isPending ? 'Saving…' : 'Mark complete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
