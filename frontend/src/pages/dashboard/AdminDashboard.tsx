import { Users, GraduationCap, DollarSign, ClipboardList } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { pickStat } from '../../utils/stats';
import { useTranslation } from 'react-i18next';

function number(stats: Record<string, unknown> | undefined, key: string): number {
  const value = stats?.[key];
  return typeof value === 'number' ? value : 0;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const backend = useBackendStatus();
  const s = stats.data;

  const collected = number(s, 'fee_collected');
  const expected = number(s, 'fee_expected');
  const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.admin')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={pickStat(s, ['students', 'total_students', 'student_count', 'active_students'], '—')} delta={`${pickStat(s, ['parents'], '0')} parent accounts`} icon={GraduationCap} />
        <StatCard label="Staff" value={pickStat(s, ['staff', 'total_staff', 'teachers', 'total_teachers'], '—')} delta={`${pickStat(s, ['classes', 'sections'], '0')} sections`} icon={Users} />
        <StatCard label="Fee Collection" value={collected > 0 ? `ETB ${collected.toLocaleString('en-US')}` : '—'} delta={collectionRate !== null ? `${collectionRate}% of ETB ${expected.toLocaleString('en-US')} expected` : 'No invoices raised'} icon={DollarSign} />
        <StatCard label="Applications" value={pickStat(s, ['applications', 'pending_applications', 'applications_pending'], '—')} delta={number(s, 'applications_pending') > 0 ? 'Awaiting decision' : 'Queue clear'} icon={ClipboardList} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="User Management" subtitle="Roles, staff accounts, permissions">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pickStat(s, ['teachers'], '0')} staff accounts across {pickStat(s, ['parents'], '0')} parent accounts.
            Manage roles, reset passwords and review the audit log from the sidebar.
          </p>
        </Card>
        <Card title="System Health" subtitle="API connectivity, academic year, terms">
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              API:{' '}
              {backend.data?.online ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
              ) : (
                <span className="font-semibold text-amber-600 dark:text-amber-400">Unreachable</span>
              )}{' '}
              <span className="text-xs text-slate-400 dark:text-slate-500">{backend.data?.base || 'probing…'}</span>
            </li>
            <li>Students: {pickStat(s, ['students'], '0')} · Attendance today: {pickStat(s, ['attendance_today'], '0')} records</li>
            <li>Outstanding fees: ETB {pickStat(s, ['outstanding_fees'], '0')}</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
