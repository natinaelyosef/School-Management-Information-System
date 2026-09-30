import { Baby } from 'lucide-react';
import { useChildren } from '../stores/ChildContext';

/** Parent-only picker: every child page reads the choice through useChildren(). */
export default function ChildSwitcher() {
  const { children, isLoading, selectedId, select } = useChildren();

  if (isLoading || children.length === 0) return null;

  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-sm">
      <Baby size={16} className="shrink-0 text-blue-700 dark:text-blue-300" />
      <span className="sr-only">Viewing child</span>
      <select
        value={selectedId ?? ''}
        onChange={(e) => select(e.target.value ? Number(e.target.value) : null)}
        className="max-w-[12rem] bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none"
      >
        {children.map((child) => (
          <option key={child.id} value={child.id}>
            {child.full_name ?? `${child.first_name} ${child.last_name}`}
            {child.grade?.name ? ` · ${child.grade.name}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
