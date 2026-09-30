import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, ClipboardList, Download, FileSpreadsheet, GraduationCap, TrendingUp, FileDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  downloadReportCsv,
  downloadReportPdf,
  downloadReportXlsx,
  fetchReportSummary,
  type ReportType,
} from '../../api/reports';
import { apiErrorMessage } from '../../utils/errors';
import type { ReportSummary, SummaryCardData } from '../../types';
import { useTranslation } from 'react-i18next';

const TABS: Array<{ id: ReportType; label: string }> = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'finance', label: 'Finance' },
  { id: 'enrollment', label: 'Enrollment' },
  { id: 'academics', label: 'Academics' },
];

const CARD_ICONS: LucideIcon[] = [GraduationCap, TrendingUp, ClipboardList, Award];

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const num = (s: ReportSummary | undefined, key: string): number | null => {
  const v = s?.[key];
  return typeof v === 'number' ? v : null;
};

const fmt = (n: number | null): string => (n === null ? '—' : n.toLocaleString('en-US'));

const money = (s: ReportSummary | undefined, key: string): string => {
  const n = num(s, key);
  return n === null ? '—' : `ETB ${n.toLocaleString('en-US')}`;
};

const rows = (s: ReportSummary | undefined, key: string): Array<Record<string, unknown>> => {
  const v = s?.[key];
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
};

/** Turns the raw /reports/summary payload for a report type into stat cards. */
function buildCards(report: ReportType, s: ReportSummary | undefined): SummaryCardData[] {
  if (!s) return [];

  if (report === 'attendance') {
    const totals = (s.totals ?? {}) as Record<string, number>;
    return [
      { label: 'Present', value: fmt(totals.present ?? 0) },
      { label: 'Absent', value: fmt(totals.absent ?? 0) },
      { label: 'Late', value: fmt(totals.late ?? 0) },
      { label: 'Attendance rate', value: `${num(s, 'overall_percentage') ?? 0}%` },
    ];
  }

  if (report === 'finance') {
    return [
      { label: 'Total invoiced', value: money(s, 'total_invoiced') },
      { label: 'Total paid', value: money(s, 'total_paid') },
      { label: 'Outstanding', value: money(s, 'outstanding') },
      { label: 'Discounts', value: money(s, 'total_discount') },
    ];
  }

  if (report === 'enrollment') {
    const levels = rows(s, 'by_level');
    const grades = rows(s, 'by_grade');
    const top = levels.slice().sort((a, b) => Number(b.count ?? 0) - Number(a.count ?? 0))[0];
    return [
      { label: 'Students', value: fmt(num(s, 'total')) },
      { label: 'Levels', value: fmt(levels.length) },
      { label: 'Grades tracked', value: fmt(grades.length) },
      { label: 'Largest level', value: String(top?.name ?? '—') },
    ];
  }

  const subjects = rows(s, 'subjects');
  const scored = subjects.filter(
    (row) => typeof row.average_percent === 'number' && row.average_percent !== null,
  );
  const avg =
    scored.length > 0
      ? scored.reduce((sum, row) => sum + Number(row.average_percent ?? 0), 0) / scored.length
      : null;
  const top = scored.slice().sort((a, b) => Number(b.average_percent) - Number(a.average_percent))[0];

  return [
    { label: 'Subjects', value: fmt(subjects.length) },
    { label: 'With results', value: fmt(scored.length) },
    { label: 'Average score', value: avg === null ? '—' : `${avg.toFixed(1)}%` },
    { label: 'Top subject', value: String(top?.subject ?? top?.name ?? '—') },
  ];
}

/** The nested breakdown array for a report (by_status, by_grade, subjects, monthly…). */
const DETAIL_KEYS = ['by_status', 'by_grade', 'by_level', 'subjects', 'monthly'];

function detailTable(s: ReportSummary | undefined): { key: string; columns: string[]; data: Array<Record<string, unknown>> } | null {
  if (!s) return null;
  for (const key of DETAIL_KEYS) {
    const data = rows(s, key);
    if (data.length === 0) continue;
    const columns = Object.keys(data[0]);
    return { key, columns, data };
  }
  return null;
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState<ReportType>('attendance');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['reports', 'summary', active],
    queryFn: () => fetchReportSummary(active),
    retry: 1,
  });

  const summary = summaryQuery.data;
  const cards: SummaryCardData[] = buildCards(active, summary);
  const detail = detailTable(summary);

  const download = async (format: ExportFormat) => {
    setNotice('');
    setBusy(format);
    try {
      if (format === 'xlsx') {
        await downloadReportXlsx(active);
      } else if (format === 'pdf') {
        await downloadReportPdf(active);
      } else {
        await downloadReportCsv(active);
      }
      setNotice(`${active} report downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      setNotice(apiErrorMessage(err, `The ${format.toUpperCase()} export could not be generated.`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.reports.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pages.reports.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download('csv')} disabled={busy !== null}>
            <Download size={16} /> {busy === 'csv' ? 'Preparing…' : 'CSV'}
          </Button>
          <Button variant="outline" onClick={() => download('xlsx')} disabled={busy !== null}>
            <FileSpreadsheet size={16} /> {busy === 'xlsx' ? 'Preparing…' : 'Excel'}
          </Button>
          <Button onClick={() => download('pdf')} disabled={busy !== null}>
            <FileDown size={16} /> {busy === 'pdf' ? 'Preparing…' : 'PDF'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active === tab.id
                ? 'bg-blue-700 text-white'
                : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {summaryQuery.isError && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
          The summary could not be loaded — check the backend connection, then refresh.
        </p>
      )}
      {notice && (
        <p
          className={`rounded-lg p-3 text-sm ${
            notice.toLowerCase().includes('could not')
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
              : 'bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200'
          }`}
        >
          {notice}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.length > 0 ? (
          cards.map((card, i) => (
            <StatCard
              key={`${card.label}-${i}`}
              label={card.label}
              value={String(card.value)}
              delta={card.delta ?? undefined}
              icon={CARD_ICONS[i % CARD_ICONS.length]}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-4">
            {summaryQuery.isLoading
              ? 'Loading summary…'
              : 'No summary rows are available for this report yet. Export the raw data with CSV, Excel or PDF.'}
          </p>
        )}
      </div>

      <Card
        title={`${TABS.find((t) => t.id === active)?.label ?? 'Report'} breakdown`}
        subtitle="Live figures from /reports/summary — export the raw rows as CSV, Excel or PDF"
      >
        {detail ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              <thead>
                <tr>
                  {detail.columns.map((column) => (
                    <th
                      key={column}
                      className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                    >
                      {column.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {detail.data.map((row, index) => (
                  <tr key={index}>
                    {detail.columns.map((column) => (
                      <td key={column} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {formatCell(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {summaryQuery.isLoading
              ? 'Loading breakdown…'
              : 'No breakdown rows for this report yet — use CSV, Excel or PDF to export the underlying data.'}
          </p>
        )}
      </Card>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
