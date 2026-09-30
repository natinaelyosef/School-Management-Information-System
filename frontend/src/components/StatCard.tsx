import type { LucideIcon } from 'lucide-react';

export default function StatCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-50">{value}</p>
      {delta && <p className="mt-1 text-xs text-green-700 dark:text-green-300">{delta}</p>}
    </div>
  );
}
