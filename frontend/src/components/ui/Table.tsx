import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

export default function Table<T extends { id: number | string }>({
  columns,
  rows,
  emptyText = 'No records found.',
}: {
  columns: Array<Column<T>>;
  rows: T[];
  emptyText?: string;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 [-webkit-overflow-scrolling:touch]">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs sm:text-sm">
        <thead className="bg-slate-50/80 dark:bg-slate-950/60 font-semibold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-3 sm:px-4 py-3 font-bold"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400"
              >
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="px-3 sm:px-4 py-3 text-slate-700 dark:text-slate-300 align-middle"
                >
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
