import type { TextareaHTMLAttributes } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export default function Textarea({ label, className = '', ...rest }: Props) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <textarea
        className={`w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:border-slate-600 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 dark:text-slate-50 dark:text-slate-50 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/60 dark:focus:ring-blue-900/60 focus:ring-blue-900/60 ${className}`}
        {...rest}
      />
    </label>
  );
}
