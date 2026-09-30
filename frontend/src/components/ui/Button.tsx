import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants: Record<string, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800',
  secondary: 'bg-slate-100 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 text-slate-800 dark:text-slate-200 dark:text-slate-200 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:bg-slate-700 dark:hover:bg-slate-700 dark:dark:hover:bg-slate-600',
  outline: 'border border-slate-300 dark:border-slate-600 dark:border-slate-600 dark:border-slate-600 text-slate-700 dark:text-slate-300 dark:text-slate-300 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 dark:hover:bg-slate-900 dark:hover:bg-slate-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({ variant = 'primary', size = 'md', className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
}
