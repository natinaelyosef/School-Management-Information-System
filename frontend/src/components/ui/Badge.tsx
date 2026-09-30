const tones: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/50 dark:bg-blue-900/50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 dark:text-blue-200 dark:text-blue-200',
  green: 'bg-green-100 dark:bg-green-900/50 dark:bg-green-900/50 dark:bg-green-900/50 text-green-800 dark:text-green-200 dark:text-green-200 dark:text-green-200',
  red: 'bg-red-100 dark:bg-red-900/50 dark:bg-red-900/50 dark:bg-red-900/50 text-red-800 dark:text-red-200 dark:text-red-200 dark:text-red-200',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/50 dark:bg-yellow-900/50 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 dark:text-yellow-200 dark:text-yellow-200',
  slate: 'bg-slate-100 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:text-slate-300 dark:text-slate-300',
  purple: 'bg-purple-100 dark:bg-purple-900/50 dark:bg-purple-900/50 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 dark:text-purple-200 dark:text-purple-200',
};

export default function Badge({
  tone = 'slate',
  children,
}: {
  tone?: keyof typeof tones;
  children: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
