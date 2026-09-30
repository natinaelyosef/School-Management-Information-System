import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../stores/ThemeContext';
import type { ThemePreference } from '../stores/ThemeContext';

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Compact icon button that cycles light -> dark -> system. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, preference, toggle } = useTheme();

  const Icon = theme === 'dark' ? Moon : Sun;
  const next = theme === 'dark' ? 'light' : 'dark';
  const isSystem = preference === 'system';

  return (
    <button
      onClick={toggle}
      title={isSystem ? `Following system (${theme}) — click for ${next}` : `Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`relative rounded-lg p-2 text-slate-600 dark:text-slate-300 dark:text-slate-300 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 dark:hover:bg-slate-800 ${className}`}
    >
      <Icon size={18} />
      {isSystem && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
      )}
    </button>
  );
}

/** Segmented control for the settings page. */
export function ThemeSegmented() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setPreference(option.value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-blue-700 text-white'
                : 'text-slate-600 dark:text-slate-300 dark:text-slate-300 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 dark:hover:bg-slate-800'
            }`}
          >
            <Icon size={14} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
