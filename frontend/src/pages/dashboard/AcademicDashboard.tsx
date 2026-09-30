import { BookOpen, ClipboardList, Users, Award, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { pickPercent, pickStat } from '../../utils/stats';
import { useTranslation } from 'react-i18next';

export default function AcademicDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const s = stats.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.academic')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Classes" value={pickStat(s, ['classes', 'sections', 'total_sections'], '—')} delta={`${pickStat(s, ['teachers'], '0')} teachers assigned`} icon={BookOpen} />
        <StatCard label="Teachers" value={pickStat(s, ['teachers', 'total_teachers', 'staff'], '—')} delta={`${pickStat(s, ['students'], '0')} students enrolled`} icon={Users} />
        <StatCard label="Exams Scheduled" value={pickStat(s, ['exams', 'exams_scheduled', 'upcoming_exams'], '—')} delta={`${pickStat(s, ['announcements'], '0')} announcements live`} icon={ClipboardList} />
        <StatCard label="Pass Rate" value={pickPercent(s, ['pass_rate', 'exam_pass_rate'], '—')} delta={pickPercent(s, ['avg_score'], 'No results entered')} icon={Award} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Curriculum & Timetable" subtitle="Sections, subjects, exam publishing"
          action={
            <Link to="/dashboard/preschool-assessments" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
              <CalendarDays size={14} /> Preschool assessments
            </Link>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">Assign teachers to sections, build timetables, schedule exams and publish results to parents/students.</p>
        </Card>
        <Card title="Quick Links" subtitle="Academic tools">
          <div className="flex flex-wrap gap-2">
            {[
              { to: '/dashboard/subjects', label: 'Subjects' },
              { to: '/dashboard/assignments', label: 'Assignments' },
              { to: '/dashboard/exams', label: 'Exams' },
              { to: '/dashboard/report-cards', label: 'Report Cards' },
              { to: '/dashboard/timetable', label: 'Timetable' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
