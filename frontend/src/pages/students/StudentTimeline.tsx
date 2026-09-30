import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft, BadgeCheck, Trash2, UserCog } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { fetchStudentTimeline } from '../../api/academics';
import {
  changeStudentStatus,
  deleteStudent,
  promoteStudent,
  transferStudent,
} from '../../api/students';
import { fetchCurrentYear, fetchGrades, fetchSections } from '../../api/structure';
import { useAuth } from '../../stores/AuthContext';
import { apiErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import type { StudentTimeline, TimelineEvent } from '../../types';
import { useTranslation } from 'react-i18next';

type Action = 'promote' | 'transfer' | 'status' | 'delete';

const TYPE_TONES: Record<string, 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'slate'> = {
  attendance: 'green',
  exam: 'blue',
  finance: 'yellow',
  enrollment: 'purple',
  promotion: 'purple',
  internal: 'blue',
  transfer_in: 'blue',
  transfer_out: 'slate',
  health: 'red',
  discipline: 'red',
  active: 'green',
  suspended: 'red',
  withdrawn: 'slate',
  graduated: 'green',
  inactive: 'slate',
  application_submitted: 'blue',
  application_approved: 'green',
  general: 'slate',
};

const TYPE_COLORS: Record<string, string> = {
  attendance: 'bg-green-500',
  exam: 'bg-blue-500',
  finance: 'bg-yellow-500',
  enrollment: 'bg-purple-500',
  promotion: 'bg-purple-500',
  internal: 'bg-blue-500',
  transfer_in: 'bg-blue-500',
  transfer_out: 'bg-slate-500',
  health: 'bg-red-500',
  discipline: 'bg-red-600',
  active: 'bg-green-500',
  suspended: 'bg-red-500',
  withdrawn: 'bg-slate-400',
  graduated: 'bg-green-600',
  inactive: 'bg-slate-400',
  application_submitted: 'bg-blue-500',
  application_approved: 'bg-green-500',
  general: 'bg-slate-400 dark:bg-slate-600',
};

const STATUS_OPTIONS = ['active', 'suspended', 'withdrawn', 'graduated', 'inactive'] as const;
const TRANSFER_TYPES = [
  { value: 'internal', label: 'Move to another class' },
  { value: 'transfer_in', label: 'Transferred in from another school' },
  { value: 'transfer_out', label: 'Transferred out of this school' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function StudentTimeline() {
  const { t } = useTranslation();
  const { id } = useParams();
  const studentId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const [action, setAction] = useState<Action | null>(null);
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [type, setType] = useState<string>('internal');
  const [status, setStatus] = useState<string>('suspended');
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [reason, setReason] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const query = useQuery({
    queryKey: ['student-timeline', studentId],
    queryFn: () => fetchStudentTimeline(studentId),
    enabled: Number.isFinite(studentId) && studentId > 0,
    retry: false,
  });

  const yearsQuery = useQuery({ queryKey: ['years'], queryFn: fetchCurrentYear, retry: 1 });
  const gradesQuery = useQuery({ queryKey: ['grades'], queryFn: fetchGrades, retry: 1 });
  const sectionsQuery = useQuery({
    queryKey: ['sections', gradeId],
    queryFn: () => fetchSections({ grade_id: gradeId }),
    enabled: action !== null && action !== 'delete' && gradeId !== '',
    retry: 1,
  });

  const run = async () => {
    if (!action) return;
    const year = yearsQuery.data ?? null;
    setError('');
    try {
      if (action === 'promote') {
        if (!year) {
          setError('No academic year is set up yet, so a promotion cannot be recorded.');
          return;
        }
        await promoteStudent(studentId, {
          academic_year_id: year.id,
          grade_id: gradeId ? Number(gradeId) : null,
          section_id: sectionId ? Number(sectionId) : null,
        });
        setNotice('Promotion recorded on the student timeline.');
      } else if (action === 'transfer') {
        await transferStudent(studentId, {
          type: type as 'internal' | 'transfer_in' | 'transfer_out',
          effective_date: effectiveDate,
          to_grade_id: gradeId ? Number(gradeId) : null,
          to_section_id: sectionId ? Number(sectionId) : null,
          destination_school: destination.trim() || undefined,
          reason: reason.trim() || undefined,
        });
        setNotice('Transfer recorded on the student timeline.');
      } else if (action === 'status') {
        await changeStudentStatus(studentId, {
          status: status as 'active' | 'suspended' | 'withdrawn' | 'graduated' | 'inactive',
          effective_date: effectiveDate,
          reason: reason.trim() || undefined,
        });
        setNotice('Status updated.');
      } else if (action === 'delete') {
        await deleteStudent(studentId);
        await queryClient.invalidateQueries({ queryKey: ['students'] });
        navigate('/dashboard/students');
        return;
      }
      setAction(null);
      setGradeId('');
      setSectionId('');
      setReason('');
      setDestination('');
      await queryClient.invalidateQueries({ queryKey: ['student-timeline', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err) {
      setError(apiErrorMessage(err, 'The action could not be recorded.'));
    }
  };

  const mutate = useMutation({ mutationFn: run });
  const busy = mutate.isPending;

  const data: StudentTimeline | undefined = query.data;
  const events: TimelineEvent[] = [...(data?.events ?? [])].sort((a, b) =>
    (b.date ?? '').localeCompare(a.date ?? ''),
  );

  const openAction = (next: Action) => {
    setError('');
    setGradeId('');
    setSectionId('');
    setReason('');
    setDestination('');
    setType('internal');
    setEffectiveDate(today());
    setAction(next);
  };

  const canPromote = can('students.promote');
  const canEdit = can('students.edit');
  const canDelete = can('students.delete');

  const titles: Record<Action, string> = {
    promote: 'Promote student',
    transfer: 'Transfer student',
    status: 'Change status',
    delete: 'Delete student',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/students"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
            aria-label="Back to students"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
              {data ? `${data.student.first_name} ${data.student.last_name}` : 'Student timeline'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data
                ? `${data.student.admission_no} • ${data.student.grade_level ?? '—'} • Student timeline`
                : 'Enrollment, attendance, exams, fees and health events'}
            </p>
          </div>
        </div>
        {data && <Badge tone="blue">{data.student.status}</Badge>}
      </div>

      {notice && (
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>
      )}

      {query.isPending && (
        <p className="rounded-xl bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading timeline…
        </p>
      )}
      {query.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(query.error, 'This timeline could not be loaded. Check the students.view permission.')}
        </p>
      )}
      {!query.isPending && !query.isError && !data && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          No timeline data was returned for this student.
        </p>
      )}

      {(canPromote || canEdit || canDelete) && data && (
        <Card title="Lifecycle actions" subtitle="Promotions, transfers and status changes are recorded on the timeline">
          <div className="flex flex-wrap gap-2">
            {canPromote && (
              <Button variant="outline" onClick={() => openAction('promote')}>
                <BadgeCheck size={16} /> Promote
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => openAction('transfer')}>
                <ArrowRightLeft size={16} /> Transfer
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => openAction('status')}>
                <UserCog size={16} /> Change status
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" onClick={() => openAction('delete')}>
                <Trash2 size={16} /> {t('common.delete')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {data && (
        <Card title="Timeline" subtitle="Enrollment, attendance, exams, fees and health events">
          <ol className="relative ml-3 border-l-2 border-slate-200 dark:border-slate-700">
            {events.map((event, i) => {
              const color = TYPE_COLORS[event.type] || TYPE_COLORS.general;
              return (
                <li key={`${event.date}-${event.title}-${i}`} className="relative mb-6 pl-6 last:mb-0">
                  <span
                    className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full border-4 border-white ${color}`}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {event.date ? formatDate(event.date) : '—'}
                    </span>
                    <Badge tone={TYPE_TONES[event.type] || 'slate'}>{event.type || 'general'}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-50">{event.title}</p>
                  {event.detail && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{event.detail}</p>}
                </li>
              );
            })}
            {events.length === 0 && (
              <li className="pl-6 text-sm text-slate-500 dark:text-slate-400">No timeline events yet.</li>
            )}
          </ol>
        </Card>
      )}

      <Modal
        open={action !== null}
        title={action ? titles[action] : ''}
        onClose={() => {
          setAction(null);
          setError('');
        }}
      >
        <div className="space-y-3">
          {action === 'promote' && (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Academic year:{' '}
                <span className="font-semibold">
                  {yearsQuery.isPending
                    ? 'Loading…'
                    : yearsQuery.data?.name ?? 'none set up yet'}
                </span>
              </p>
              <Select label="Move to grade (blank keeps the current grade)" value={gradeId} onChange={(e) => { setGradeId(e.target.value); setSectionId(''); }}>
                <option value="">Current grade</option>
                {(gradesQuery.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
              <Select label="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={gradeId === ''}>
                <option value="">Current section</option>
                {(sectionsQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </>
          )}

          {action === 'transfer' && (
            <>
              <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
                {TRANSFER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
              <Input
                label="Effective date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
              {type === 'internal' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select label="New grade" value={gradeId} onChange={(e) => { setGradeId(e.target.value); setSectionId(''); }}>
                    <option value="">Keep grade</option>
                    {(gradesQuery.data ?? []).map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                  <Select label="New section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={gradeId === ''}>
                    <option value="">Keep section</option>
                    {(sectionsQuery.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              {type === 'transfer_out' && (
                <Input
                  label="Destination school"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Nearby Academy"
                />
              )}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Reason</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Optional note for the record"
                />
              </label>
            </>
          )}

          {action === 'status' && (
            <>
              <Select label="New status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Input
                label="Effective date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                required
              />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Reason</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Optional — shown on the timeline"
                />
              </label>
            </>
          )}

          {action === 'delete' && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
              {data
                ? `${data.student.first_name} ${data.student.last_name} (${data.student.admission_no}) will be removed from the student list.`
                : 'This student will be removed from the student list.'}{' '}
              Their history is kept in the archive.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAction(null);
                setError('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => mutate.mutate()}
              disabled={busy || (action === 'promote' && yearsQuery.data === null)}
            >
              {busy ? 'Saving…' : action === 'delete' ? 'Delete student' : 'Record'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
