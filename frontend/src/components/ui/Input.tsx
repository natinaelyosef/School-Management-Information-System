import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', ...rest }: Props) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <input
        className={`w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:border-slate-600 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 dark:text-slate-50 dark:text-slate-50 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/60 dark:focus:ring-blue-900/60 focus:ring-blue-900/60 ${className}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}
