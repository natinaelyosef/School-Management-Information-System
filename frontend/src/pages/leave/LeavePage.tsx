import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import {
  cancelLeaveRequest,
  createLeaveRequest,
  decideLeaveRequest,
  deleteLeaveRequest,
  fetchLeaveRequests,
  fetchLeaveTypes,
  type LeaveRequest,
  type LeaveStatus,
} from '../../api/leave';
import { apiErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import { useAuth } from '../../stores/AuthContext';
import { useTranslation } from 'react-i18next';

const STATUS_TONE = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
} as const;

export default function LeavePage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canRequest = can('leave.request');
  const canApprove = can('leave.approve');
  const canManage = can('leave.manage');

  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'all' | 'mine'>(canApprove ? 'all' : 'mine');
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [deciding, setDeciding] = useState<LeaveRequest | null>(null);
  const [decision, setDecision] = useState('');
  const [decisionError, setDecisionError] = useState('');

  const [form, setForm] = useState(() => ({
    leave_type_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  }));

  const typesQuery = useQuery({ queryKey: ['leave-types'], queryFn: fetchLeaveTypes, retry: false });

  const requestsQuery = useQuery({
    queryKey: ['leave-requests', status, scope],
    queryFn: () =>
      fetchLeaveRequests({
        status: (status || undefined) as LeaveStatus | undefined,
        mine: scope === 'mine' ? true : undefined,
        per_page: 25,
      }),
    retry: false,
  });

  const types = typesQuery.data ?? [];
  const requests = requestsQuery.data?.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createLeaveRequest({
        leave_type_id: Number(form.leave_type_id),
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || undefined,
      }),
    onSuccess: (created) => {
      refresh();
      setCreateOpen(false);
      setNotice(
        `Leave requested for ${created.days} working day${created.days === 1 ? '' : 's'}.`,
      );
      setForm({ ...form, reason: '' });
    },
    onError: (err) => setFormError(apiErrorMessage(err, 'The request could not be sent.')),
  });

  const decideMutation = useMutation({
    mutationFn: (input: { id: number; status: 'approved' | 'rejected' }) =>
      decideLeaveRequest(input.id, { status: input.status, decision_note: decision || undefined }),
    onSuccess: (_data, input) => {
      refresh();
      setDeciding(null);
      setDecision('');
      setDecisionError('');
      setNotice(input.status === 'approved' ? 'Leave approved.' : 'Leave declined.');
    },
    onError: (err) => setDecisionError(apiErrorMessage(err, 'That decision could not be saved.')),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelLeaveRequest(id),
    onSuccess: () => {
      refresh();
      setNotice('Request withdrawn.');
    },
    onError: (err) => setNotice(apiErrorMessage(err, 'The request could not be withdrawn.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLeaveRequest(id),
    onSuccess: () => {
      refresh();
      setNotice('Request removed from the register.');
    },
  });

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_type_id) {
      setFormError('Choose a leave type.');
      return;
    }
    setFormError('');
    createMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('leave.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('leave.subtitle')}
          </p>
        </div>
        {canRequest && (
          <Button onClick={() => setCreateOpen(true)}>
            <CalendarPlus size={16} /> {t('leave.request')}
          </Button>
        )}
      </div>

      {notice && (
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">
          {notice}
        </p>
      )}
      {requestsQuery.isError && (
        <p className="rounded-lg bg-yellow-50 dark:text-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(requestsQuery.error, 'The leave register could not be loaded.')}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t('common.status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:w-44"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        {canApprove && (
          <Select
            label="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'all' | 'mine')}
            className="sm:w-48"
          >
            <option value="all">{t('leave.wholeStaff')}</option>
            <option value="mine">{t('leave.onlyMine')}</option>
          </Select>
        )}
      </div>

      <Table<LeaveRequest>
        columns={[
          {
            key: 'staff',
            header: t('leave.staffMember'),
            render: (r) => (
              <p className="font-medium text-slate-800 dark:text-slate-100">{r.user?.name ?? `#${r.user_id}`}</p>
            ),
          },
          {
            key: 'type',
            header: t('leave.type'),
            render: (r) => (
              <span className="text-slate-800 dark:text-slate-100">{r.leaveType?.label ?? '—'}</span>
            ),
          },
          {
            key: 'dates',
            header: t('leave.dates'),
            render: (r) => (
              <div>
                <p className="text-slate-800 dark:text-slate-100">
                  {formatDate(r.start_date)} → {formatDate(r.end_date)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('leave.workingDays', { days: r.days })}
                </p>
              </div>
            ),
          },
          {
            key: 'reason',
            header: t('common.reason'),
            render: (r) => (
              <span className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                {r.reason ?? '—'}
              </span>
            ),
          },
          { key: 'status', header: t('common.status'), render: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`leave.${r.status}`)}</Badge> },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <div className="flex flex-wrap items-center gap-1">
                {canApprove && r.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDeciding(r);
                        setDecision('');
                      }}
                    >
                      <CheckCircle2 size={14} /> {t('leave.decide')}
                    </Button>
                  </>
                )}
                {canRequest && r.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={cancelMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Withdraw this request?')) cancelMutation.mutate(r.id);
                    }}
                  >
                    <XCircle size={14} /> {t('leave.withdraw')}
                  </Button>
                )}
                {canManage && (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Remove this request from the register?')) {
                        deleteMutation.mutate(r.id);
                      }
                    }}
                  >
                    <Trash2 size={14} /> {t('common.remove')}
                  </Button>
                )}
                {!canApprove && !canManage && r.status !== 'pending' && (
                  <span className="text-slate-400 dark:text-slate-500">—</span>
                )}
              </div>
            ),
          },
        ]}
        rows={requests}
        emptyText={
          requestsQuery.isPending ? t('common.loading') : t('common.noResults')
        }
      />

      <Modal open={createOpen} title={t('leave.request')} onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={submitCreate}>
          <Select
            label={t('leave.type')}
            value={form.leave_type_id}
            onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
            required
          >
            <option value="">{t('leave.type')}…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.quota_days > 0 ? ` · ${t.quota_days} days/year` : ''}
                {t.requires_document ? ' · document needed' : ''}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('leave.firstDay')}
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
            <Input
              label={t('leave.lastDay')}
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              required
            />
          </div>
          <Textarea
            label={t('common.reason')}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={3}
          />
          {formError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Plus size={16} /> {t('leave.request')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deciding)} title={t('leave.decide')} onClose={() => setDeciding(null)}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (deciding) decideMutation.mutate({ id: deciding.id, status: 'approved' });
          }}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {deciding?.user?.name} · {deciding?.leaveType?.label} · {deciding?.days} day
            {deciding?.days === 1 ? '' : 's'}
          </p>
          <Textarea
            label={t('leave.note')}
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            rows={3}
            placeholder="Cover arranged by the department."
          />
          {decisionError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
              {decisionError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={decideMutation.isPending}
              onClick={() => {
                if (deciding) decideMutation.mutate({ id: deciding.id, status: 'rejected' });
              }}
            >
              <XCircle size={16} /> {t('leave.decline')}
            </Button>
            <Button type="submit" disabled={decideMutation.isPending}>
              <CheckCircle2 size={16} /> {t('leave.approve')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
