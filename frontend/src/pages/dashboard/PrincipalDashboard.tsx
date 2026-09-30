import { CalendarCheck, Megaphone, TrendingUp, Users } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { pickPercent, pickStat } from '../../utils/stats';
import { useTranslation } from 'react-i18next';

interface CalendarItem {
  id: number;
  title: string;
  when?: string | null;
  location?: string | null;
  audience?: string | null;
}

interface NewsItem {
  id: number;
  title: string;
  when?: string | null;
  audience?: string | null;
  pinned?: boolean;
}

export default function PrincipalDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const s = stats.data;

  const upcoming = Array.isArray(s?.upcoming) ? (s.upcoming as CalendarItem[]) : [];
  const news = Array.isArray(s?.news) ? (s.news as NewsItem[]) : [];

  const approvals = [
    { label: 'Applications awaiting decision', value: pickStat(s, ['applications_pending', 'pending_applications'], '') },
    { label: 'Payments awaiting verification', value: taskCount(s, 'Payments awaiting verification') },
    { label: 'Unpaid invoices', value: taskCount(s, 'Unpaid invoices') },
    { label: 'Classes without attendance today', value: taskCount(s, 'Classes without attendance today') },
  ].filter((row) => row.value !== '');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.principal')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance Today"
          value={pickPercent(s, ['attendance_rate', 'attendance_today', 'attendance'], '—')}
          delta={`${pickStat(s, ['attendance_today'], '0')} records marked`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Enrollment"
          value={pickStat(s, ['enrollment', 'students', 'total_students'], '—')}
          delta={`Across ${pickStat(s, ['sections', 'classes'], '0')} sections`}
          icon={Users}
        />
        <StatCard
          label="Avg. Score"
          value={pickPercent(s, ['avg_score', 'average_score', 'academics_average'], '—')}
          delta={pickPercent(s, ['pass_rate'], 'No results yet')}
          icon={TrendingUp}
        />
        <StatCard
          label="Announcements"
          value={pickStat(s, ['announcements', 'active_announcements'], '—')}
          delta={`${pickStat(s, ['upcoming_events'], '0')} upcoming events`}
          icon={Megaphone}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Approvals" subtitle="Needs a decision from the principal's office">
          {approvals.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Nothing pending — every queue is clear.</p>
          ) : (
            <ul className="space-y-2">
              {approvals.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <span>{row.label}</span>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-bold text-blue-800 dark:text-blue-200">
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="School Calendar" subtitle="Next published events">
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No upcoming events published yet.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{event.title}</span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {event.when}
                    {event.location ? ` · ${event.location}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Announcements" subtitle="Published to the school community">
        {news.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">No published announcements.</p>
        ) : (
          <ul className="space-y-2">
            {news.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.pinned ? '[pinned] ' : ''}
                  {item.title}
                </span>
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                  {item.audience && item.audience !== 'all' ? `${item.audience} · ` : ''}
                  {item.when ?? ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function taskCount(stats: Record<string, unknown> | undefined, label: string): string {
  const tasks = stats?.my_tasks;
  if (!Array.isArray(tasks)) return '';
  const match = (tasks as { label?: string; count?: number }[]).find((task) => task.label === label);
  if (!match || typeof match.count !== 'number') return '';
  return match.count.toLocaleString('en-US');
}
