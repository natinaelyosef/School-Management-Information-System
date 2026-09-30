import { Baby, CalendarCheck, DollarSign, MessagesSquare } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { useChildren } from '../../stores/ChildContext';
import { pickPercent, pickStat } from '../../utils/stats';
import { useTranslation } from 'react-i18next';

export default function ParentDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const s = stats.data;

  const { children: kids, isLoading, selected, selectedId } = useChildren();

  const balance = pickStat(s, ['fee_balance', 'balance', 'outstanding', 'outstanding_fees'], '—');
  const unread = pickStat(s, ['unread_messages', 'messages_unread'], '—');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.parent')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Children" value={pickStat(s, ['children', 'my_children'], '—')} delta={`${kids.length} linked to this account`} icon={Baby} />
        <StatCard label="Attendance" value={pickPercent(s, ['attendance', 'attendance_rate', 'child_attendance'], '—')} delta="Last 60 days" icon={CalendarCheck} />
        <StatCard label="Fee Balance" value={balance === '—' ? '—' : `ETB ${balance}`} delta={number(s, 'outstanding_fees') > 0 ? 'Outstanding balance' : 'Nothing due'} icon={DollarSign} />
        <StatCard label="Unread Messages" value={unread} delta={unread === '0' ? 'All caught up' : 'Waiting for you'} icon={MessagesSquare} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Children Overview"
          subtitle={
            selected
              ? `Now viewing ${selected.full_name ?? `${selected.first_name} ${selected.last_name}`} — use the header switcher to change`
              : 'Grades and sections from the live roster'
          }
        >
          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading children…</p>
          ) : kids.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No children linked to this account yet.</p>
          ) : (
            <ul className="space-y-2">
              {kids.map((child) => (
                <li
                  key={child.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                    child.id === selectedId
                      ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                  }`}
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {child.full_name ?? `${child.first_name} ${child.last_name}`.trim()}
                    {child.id === selectedId && (
                      <span className="ml-2 rounded-full bg-blue-700 px-2 py-0.5 text-xs font-bold text-white">
                        viewing
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {[child.grade?.name, child.section?.name].filter(Boolean).join('-') || 'Unassigned'}
                    {child.admission_no ? ` · ${child.admission_no}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Outstanding Fees" subtitle="What needs settling">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {balance === '0'
              ? 'No outstanding balance — every invoice is settled.'
              : `Balance: ETB ${balance}. Open Finance → Invoices to pay online or upload a proof of payment.`}
          </p>
        </Card>
      </div>
    </div>
  );
}

function number(stats: Record<string, unknown> | undefined, key: string): number {
  const value = stats?.[key];
  return typeof value === 'number' ? value : 0;
}
