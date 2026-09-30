import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, CalendarCheck, Wallet } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { fetchTimetable } from '../../api/academics';
import { me as fetchMe } from '../../api/auth';
import { pickPercent, pickStat } from '../../utils/stats';
import {
  DAY_NAMES,
  sortSlots,
  slotClass,
  slotSubject,
  slotTime,
  todayDayIndex,
  type SlotPayload,
} from '../../utils/timetable';
import { useTranslation } from 'react-i18next';

interface StudentProfile {
  student?: {
    id: number;
    grade_id?: number | null;
    section_id?: number | null;
    grade?: { id: number; name: string } | string | null;
    section?: { id: number; name: string } | string | null;
  } | null;
}

export default function StudentDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const s = stats.data;

  const profile = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: 1,
    staleTime: 300_000,
  });

  const student = (profile.data as unknown as StudentProfile | undefined)?.student;
  const today = todayDayIndex();

  const timetable = useQuery({
    queryKey: ['timetable', student?.grade_id, student?.section_id],
    queryFn: () =>
      fetchTimetable(
        student?.grade_id ? { grade_id: student.grade_id, section_id: student.section_id ?? undefined } : {},
      ),
    enabled: Boolean(student?.grade_id),
    retry: 1,
    staleTime: 60_000,
  });

  const todaySlots = sortSlots(((timetable.data ?? []) as SlotPayload[])).filter(
    (slot) => Number(slot.day) === today,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.student')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Average" value={pickPercent(s, ['my_average', 'average', 'avg_score'], '—')} delta="Across entered results" icon={Award} />
        <StatCard label="Attendance" value={pickPercent(s, ['attendance', 'attendance_rate', 'my_attendance'], '—')} delta="Last 60 days" icon={CalendarCheck} />
        <StatCard label="Assignments" value={pickStat(s, ['assignments', 'assignments_due', 'pending_assignments'], '—')} delta={pickStat(s, ['unread_messages'], '0') === '0' ? 'No new messages' : `${pickStat(s, ['unread_messages'], '0')} unread messages`} icon={BookOpen} />
        <StatCard label="Fee Status" value={pickStat(s, ['fee_status', 'invoice_status'], '—')} delta={pickStat(s, ['outstanding_fees'], '—')} icon={Wallet} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Today's Classes"
          subtitle={`${DAY_NAMES[today] ?? ''}${student?.grade ? ` · ${typeof student.grade === 'string' ? student.grade : student.grade.name}` : ''}`}
        >
          {!student?.grade_id ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No class assigned yet — talk to the registrar.</p>
          ) : timetable.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading timetable…</p>
          ) : timetable.isError ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">Timetable unavailable — check the backend connection.</p>
          ) : todaySlots.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No classes scheduled for {DAY_NAMES[today]}.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {todaySlots.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{slotSubject(slot)}</span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {slotTime(slot) ?? `Period ${slot.period}`}
                    {slotClass(slot) ? ` · ${slotClass(slot)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Fee Account" subtitle="Invoices and receipts">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Status: <span className="font-semibold text-slate-800 dark:text-slate-200">{pickStat(s, ['fee_status'], '—')}</span>
            {' · Balance: ETB '}
            {pickStat(s, ['outstanding_fees'], '0')}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Open Finance → Invoices to pay online, upload a proof of payment, or download a receipt.
          </p>
        </Card>
      </div>
    </div>
  );
}
