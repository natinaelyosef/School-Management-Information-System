import apiClient from './client';
import type { ReportSummary } from '../types';

export type ReportType = 'attendance' | 'finance' | 'enrollment' | 'academics';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function fetchReportSummary(report: ReportType): Promise<ReportSummary> {
  const { data } = await apiClient.get<ReportSummary>('/reports/summary', { params: { report } });
  return data;
}

/** Streams a binary endpoint to a file download, honouring Content-Disposition. */
async function downloadBinary(
  url: string,
  params: Record<string, string>,
  fallbackName: string,
  fallbackType: string,
): Promise<void> {
  const { data, headers } = await apiClient.get<Blob>(url, { params, responseType: 'blob' });

  const disposition = String(headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ?? fallbackName;

  const url2 = URL.createObjectURL(new Blob([data], { type: fallbackType }));
  const anchor = document.createElement('a');
  anchor.href = url2;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url2);
}

export function downloadReportCsv(report: ReportType): Promise<void> {
  return downloadBinary(
    '/reports/export.csv',
    { report },
    `${report}-report.csv`,
    'text/csv;charset=utf-8',
  );
}

export function downloadReportXlsx(report: ReportType): Promise<void> {
  return downloadBinary(
    '/reports/export.xlsx',
    { report },
    `${report}-report.xlsx`,
    XLSX_MIME,
  );
}

export function downloadReportPdf(report: ReportType): Promise<void> {
  return downloadBinary(
    '/reports/export.pdf',
    { report },
    `${report}-report.pdf`,
    'application/pdf',
  );
}
