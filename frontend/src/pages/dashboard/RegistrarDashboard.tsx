import { ClipboardList, UserCheck, UserPlus, ArrowRightLeft } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { pickStat } from '../../utils/stats';
import { useTranslation } from 'react-i18next';

export default function RegistrarDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const s = stats.data;

  const pending = pickStat(s, ['pending_applications', 'applications_pending', 'applications'], '—');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.registrar')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Applications" value={pending} delta={pending === '0' ? 'Inbox clear' : 'Awaiting decision'} icon={ClipboardList} />
        <StatCard label="New Enrollments" value={pickStat(s, ['new_enrollments', 'enrollments'], '—')} delta="Last 30 days" icon={UserPlus} />
        <StatCard label="Active Students" value={pickStat(s, ['students', 'active_students', 'total_students'], '—')} delta={`${pickStat(s, ['classes', 'sections'], '0')} sections`} icon={UserCheck} />
        <StatCard label="Transfers" value={pickStat(s, ['transfers', 'certificates'], '—')} delta="Processed to date" icon={ArrowRightLeft} />
      </div>

      <Card title="Admissions Pipeline" subtitle="Submitted → Under Review → Accepted → Enrolled">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {pending === '0'
            ? 'No applications waiting. New submissions appear here the moment they are filed.'
            : `${pending} application${pending === '1' ? '' : 's'} waiting for a decision.`}{' '}
          Verify documents, accept or reject, then enroll accepted students into sections.
        </p>
      </Card>
    </div>
  );
}
