import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, BookOpen, PenSquare, Users } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { fetchTimetable } from '../../api/academics';
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

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const s = stats.data;

  const timetable = useQuery({
    queryKey: ['timetable'],
    queryFn: () => fetchTimetable(),
    retry: 1,
    staleTime: 60_000,
  });

  const today = todayDayIndex();
  const todaySlots = sortSlots((timetable.data ?? []) as SlotPayload[]).filter(
    (slot) => Number(slot.day) === today,
  );

  const toGrade = Number(pickStat(s, ['assignments_to_grade'], '0').replace(/,/g, ''));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.teacher')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Classes" value={pickStat(s, ['my_classes', 'classes', 'sections'], '—')} delta={`${pickStat(s, ['my_students'], '0')} students`} icon={Users} />
        <StatCard label="Attendance Today" value={pickPercent(s, ['attendance_rate', 'attendance_marked', 'attendance'], '—')} delta={pickStat(s, ['attendance_pending'], '0') === '0' ? 'All classes marked' : `${pickStat(s, ['attendance_pending'], '0')} classes still unmarked`} icon={CalendarCheck} />
        <StatCard label="Assignments" value={pickStat(s, ['assignments', 'my_assignments'], '—')} delta={toGrade > 0 ? `${toGrade} submissions to grade` : 'Nothing to grade'} icon={PenSquare} />
        <StatCard label="Lessons Today" value={String(todaySlots.length)} delta={DAY_NAMES[today] ?? ''} icon={BookOpen} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Today's Schedule" subtitle={`${DAY_NAMES[today] ?? ''} · periods from the live timetable`}>
          {timetable.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading timetable…</p>
          ) : timetable.isError ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">Timetable unavailable — check the backend connection.</p>
          ) : todaySlots.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No periods scheduled for {DAY_NAMES[today]}.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {todaySlots.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 dark:bg-slate-900 p-2">
                  <span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{slotSubject(slot)}</span>
                    {slotClass(slot) && <span className="ml-2 text-xs">Grade {slotClass(slot)}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {slotTime(slot) ?? `Period ${slot.period}`}
                    {slot.room ? ` · ${slot.room}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Grading Queue" subtitle="Enter marks & publish">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {toGrade > 0
              ? `${toGrade} submission${toGrade === 1 ? '' : 's'} waiting to be graded.`
              : 'No submissions waiting — you are up to date.'}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {pickStat(s, ['assignments'], '0')} assignments published across {pickStat(s, ['my_classes'], '0')} classes.
          </p>
        </Card>
      </div>
    </div>
  );
}
