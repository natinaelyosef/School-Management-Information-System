import { DollarSign, Receipt, AlertTriangle, CheckCircle2 } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import StatsNotice from '../../components/StatsNotice';
import { useStats } from '../../hooks/useStats';
import { pickStat } from '../../utils/stats';
import { useTranslation } from 'react-i18next';

function number(stats: Record<string, unknown> | undefined, key: string): number {
  const value = stats?.[key];
  return typeof value === 'number' ? value : 0;
}

export default function AccountantDashboard() {
  const { t } = useTranslation();
  const stats = useStats();
  const s = stats.data;

  const collected = number(s, 'fee_collected');
  const expected = number(s, 'fee_expected');
  const outstanding = number(s, 'outstanding_fees');
  const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.dashboard.accountant')}</h1>

      <StatsNotice error={stats.error} onRetry={() => stats.refetch()} isFetching={stats.isFetching} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected"
          value={collected > 0 ? `ETB ${collected.toLocaleString('en-US')}` : '—'}
          delta={collectionRate !== null ? `${collectionRate}% of expected` : 'No invoices raised'}
          icon={DollarSign}
        />
        <StatCard
          label="Pending Invoices"
          value={pickStat(s, ['unpaid_invoices', 'pending_invoices', 'invoices'], '—')}
          delta={`ETB ${outstanding.toLocaleString('en-US')} outstanding`}
          icon={Receipt}
        />
        <StatCard
          label="Overdue"
          value={pickStat(s, ['overdue', 'overdue_invoices'], '—')}
          delta={number(s, 'overdue_invoices') > 0 ? 'Send reminders' : 'Nothing overdue'}
          icon={AlertTriangle}
        />
        <StatCard
          label="Proofs to Verify"
          value={pickStat(s, ['pending_proofs', 'proofs_pending', 'payment_proofs'], '—')}
          delta={number(s, 'pending_proofs') > 0 ? 'Waiting on your review' : 'Queue clear'}
          icon={CheckCircle2}
        />
      </div>

      <Card title="Verification Queue" subtitle="Payment proofs from parents">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {number(s, 'pending_proofs') > 0
            ? `${number(s, 'pending_proofs')} proof${number(s, 'pending_proofs') === 1 ? '' : 's'} uploaded and awaiting verification.`
            : 'No proofs waiting. New uploads appear here immediately.'}{' '}
          Review receipts in Finance → Verification Queue, then issue official receipts.
        </p>
      </Card>
    </div>
  );
}
