import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import {
  DISCIPLINE_CATEGORIES,
  createDisciplineRecord,
  deleteDisciplineRecord,
  fetchDisciplineRecords,
  fetchDisciplineSummary,
  resolveDisciplineRecord,
  type DisciplineRecord,
  type DisciplineStatus,
  type DisciplineType,
} from '../../api/discipline';
import { fetchStudents } from '../../api/students';
import { apiErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import { useAuth } from '../../stores/AuthContext';
import { useTranslation } from 'react-i18next';

const TYPE_TONE = {
  merit: 'green',
  demerit: 'red',
  incident: 'yellow',
  note: 'slate',
} as const;

const TYPE_LABEL = {
  merit: 'Merit',
  demerit: 'Demerit',
  incident: 'Incident',
  note: 'Note',
} as const;

export default function DisciplinePage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canRecord = can('discipline.record');
  const canManage = can('discipline.manage');

  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [resolving, setResolving] = useState<DisciplineRecord | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolutionError, setResolutionError] = useState('');

  const [form, setForm] = useState(() => ({
    student_id: '',
    type: 'merit' as DisciplineType,
    category: 'conduct',
    severity: '',
    title: '',
    description: '',
    occurred_on: new Date().toISOString().slice(0, 10),
  }));

  const recordsQuery = useQuery({
    queryKey: ['discipline', type, status, page],
    queryFn: () =>
      fetchDisciplineRecords({
        type: (type || undefined) as DisciplineType | undefined,
        status: (status || undefined) as DisciplineStatus | undefined,
        page,
        per_page: 20,
      }),
    retry: false,
  });

  const summaryQuery = useQuery({
    queryKey: ['discipline-summary'],
    queryFn: () => fetchDisciplineSummary({}),
    retry: false,
  });

  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => fetchStudents(1),
    enabled: canRecord,
    retry: false,
  });

  const students = studentsQuery.data?.data ?? [];
  const records = recordsQuery.data?.data ?? [];
  const summary = (summaryQuery.data ?? []).slice(0, 10);
  const isParent = !canRecord;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['discipline'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createDisciplineRecord({
        student_id: Number(form.student_id),
        type: form.type,
        title: form.title,
        category: form.category as (typeof DISCIPLINE_CATEGORIES)[number],
        severity: form.severity ? Number(form.severity) : undefined,
        description: form.description || undefined,
        occurred_on: form.occurred_on,
      }),
    onSuccess: (record) => {
      refresh();
      setCreateOpen(false);
      setNotice(
        record.type === 'merit'
          ? `Merit recorded for ${record.student?.first_name ?? 'the student'}.`
          : 'Entry recorded and the family has been notified.',
      );
      setForm({ ...form, title: '', description: '', severity: '' });
    },
    onError: (err) => setFormError(apiErrorMessage(err, 'The entry could not be saved.')),
  });

  const resolveMutation = useMutation({
    mutationFn: (input: { id: number; status: 'resolved' | 'appealed' }) =>
      resolveDisciplineRecord(input.id, { status: input.status, resolution: resolution || undefined }),
    onSuccess: () => {
      refresh();
      setResolving(null);
      setResolution('');
      setResolutionError('');
      setNotice('Entry closed off.');
    },
    onError: (err) => setResolutionError(apiErrorMessage(err, 'That could not be saved.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDisciplineRecord(id),
    onSuccess: () => {
      refresh();
      setNotice('Entry removed.');
    },
  });

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id) {
      setFormError('Choose the student this entry is about.');
      return;
    }
    if (!form.title.trim()) {
      setFormError('Give the entry a short title.');
      return;
    }
    setFormError('');
    createMutation.mutate();
  };

  const studentName = (record: DisciplineRecord) =>
    record.student
      ? `${record.student.first_name} ${record.student.last_name}`
      : `Student #${record.student_id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('discipline.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('discipline.subtitle')}
          </p>
        </div>
        {canRecord && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> {t('discipline.record')}
          </Button>
        )}
      </div>

      {notice && (
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">
          {notice}
        </p>
      )}
      {recordsQuery.isError && (
        <p className="rounded-lg bg-yellow-50 dark:text-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(recordsQuery.error, 'The behaviour log could not be loaded.')}
        </p>
      )}

      {summary.length > 0 && (
        <Card
          title={isParent ? t('discipline.childBalance') : t('discipline.standing')}
          subtitle={
            isParent ? t('discipline.childBalanceSubtitle') : t('discipline.standingSubtitle')
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.map((row) => (
              <div
                key={row.student_id}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
              >
                <p className="font-semibold text-slate-800 dark:text-slate-100">{row.student_name}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-green-600 dark:text-green-400">+{row.merit_points}</span>
                  {' / '}
                  <span className="font-bold text-red-600 dark:text-red-400">-{row.demerit_points}</span>
                  {' · '}
                  {row.incidents} incident{row.incidents === 1 ? '' : 's'}
                  {row.open > 0 && ` · ${row.open} open`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t('common.type')}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="sm:w-44"
        >
          <option value="">{t('common.allTypes')}</option>
          {Object.keys(TYPE_LABEL).map((value) => (
            <option key={value} value={value}>
              {t(`discipline.${value}`)}
            </option>
          ))}
        </Select>
        <Select
          label={t('common.status')}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="sm:w-40"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="appealed">Appealed</option>
        </Select>
      </div>

      <Table<DisciplineRecord>
        columns={[
          {
            key: 'student',
            header: t('discipline.student'),
            render: (r) => (
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{studentName(r)}</p>
                {r.student?.admission_no && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.student.admission_no}</p>
                )}
              </div>
            ),
          },
          {
            key: 'type',
            header: t('common.type'),
            render: (r) => (
              <Badge tone={TYPE_TONE[r.type]}>{`${t(`discipline.${r.type}`)}${r.severity ? ` · ${r.severity}` : ''}`}</Badge>
            ),
          },
          { key: 'title', header: t('discipline.entry'), render: (r) => (
            <div>
              <p className="text-slate-800 dark:text-slate-100">{r.title}</p>
              <p className="text-xs capitalize text-slate-500 dark:text-slate-400">{r.category}</p>
            </div>
          ) },
          {
            key: 'points',
            header: t('discipline.points'),
            render: (r) => (
              <span
                className={
                  r.points > 0
                    ? 'font-bold text-green-600 dark:text-green-400'
                    : r.points < 0
                      ? 'font-bold text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400'
                }
              >
                {r.points > 0 ? `+${r.points}` : r.points}
              </span>
            ),
          },
          { key: 'occurred_on', header: t('common.date'), render: (r) => formatDate(r.occurred_on) },
          {
            key: 'status',
            header: t('common.status'),
            render: (r) => (
              <Badge tone={r.status === 'open' ? 'yellow' : r.status === 'appealed' ? 'blue' : 'green'}>
                {t(`discipline.${r.status}`)}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (r) =>
              canManage ? (
                <div className="flex flex-wrap items-center gap-1">
                  {r.status === 'open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResolving(r);
                        setResolution('');
                      }}
                    >
                      <CheckCircle2 size={14} /> {t('discipline.closeOff')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove "${r.title}"?`)) deleteMutation.mutate(r.id);
                    }}
                  >
                    <Trash2 size={14} /> {t('common.remove')}
                  </Button>
                </div>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">—</span>
              ),
          },
        ]}
        rows={records}
        emptyText={
          recordsQuery.isPending ? t('common.loading') : t('common.noResults')
        }
      />

      {recordsQuery.data && recordsQuery.data.last_page > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page {recordsQuery.data.current_page} of {recordsQuery.data.last_page}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= recordsQuery.data.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Modal open={createOpen} title={t('discipline.record')} onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={submitCreate}>
          <Select
            label={t('discipline.student')}
            value={form.student_id}
            onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            required
          >
            <option value="">{t('discipline.student')}…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
                {s.admission_no ? ` · ${s.admission_no}` : ''}
              </option>
            ))}
          </Select>
          <Select
            label={t('common.type')}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as DisciplineType })}
          >
            {Object.keys(TYPE_LABEL).map((value) => (
              <option key={value} value={value}>
                {t(`discipline.${value}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t('common.category')}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {DISCIPLINE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {form.type !== 'note' && (
            <Input
              label={t('discipline.severity')}
              type="number"
              min={1}
              max={5}
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              error={form.severity ? undefined : 'Sets the demerit points automatically'}
            />
          )}
          <Input
            label={t('common.title')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Helped a classmate in assembly"
            required
          />
          <Textarea
            label={t('discipline.whatHappened')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
          <Input
            label={t('common.date')}
            type="date"
            value={form.occurred_on}
            onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
            required
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
              <Award size={16} /> {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(resolving)}
        title={t('discipline.closeOff')}
        onClose={() => setResolving(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (resolving) resolveMutation.mutate({ id: resolving.id, status: 'resolved' });
          }}
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {resolving?.title} — record what was agreed.
          </p>
          <Textarea
            label={t('discipline.resolution')}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
            placeholder="Apology accepted, family informed."
          />
          {resolutionError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
              {resolutionError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={resolveMutation.isPending}
              onClick={() => {
                if (resolving) resolveMutation.mutate({ id: resolving.id, status: 'appealed' });
              }}
            >
              {t('discipline.markAppealed')}
            </Button>
            <Button type="submit" disabled={resolveMutation.isPending}>
              <CheckCircle2 size={16} /> {t('discipline.markResolved')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
