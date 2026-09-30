import { CheckCircle2, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from './ui/Card';
import { useStats } from '../hooks/useStats';
import type { Role, StatsTask } from '../types';

const TONES: Record<StatsTask['tone'], string> = {
  red: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  orange: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  green: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
};

export default function MyTasksWidget({ role }: { role: Role | null }) {
  const { t } = useTranslation();
  const stats = useStats();
  const tasks: StatsTask[] = stats.data?.my_tasks ?? [];
  const subtitle = role
    ? t('tasks.subtitle', { role: t(`roles.${role}`).toLowerCase() })
    : t('tasks.title');

  if (stats.isError) {
    return (
      <Card title={t('tasks.title')} subtitle={subtitle}>
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Tasks unavailable — the backend did not respond. Retrying automatically.
        </p>
      </Card>
    );
  }

  if (stats.isLoading) {
    return (
      <Card title={t('tasks.title')} subtitle={subtitle}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading tasks…</p>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card title={t('tasks.title')} subtitle={subtitle}>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('tasks.empty')}</p>
      </Card>
    );
  }

  return (
    <Card title={t('tasks.title')} subtitle={subtitle}>
      <ul className="space-y-2">
        {tasks.map((task, i) => (
          <li
            key={`${task.label}-${i}`}
            className="flex items-start gap-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
          >
            {i === 0 ? (
              <CheckCircle2 size={16} className="mt-0.5 text-green-600 dark:text-green-400" />
            ) : (
              <Circle size={16} className="mt-0.5 text-slate-400 dark:text-slate-500" />
            )}
            <span className="flex-1">{task.label}</span>
            {task.count > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONES[task.tone] || TONES.blue}`}
              >
                {task.count}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
