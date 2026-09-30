import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import { fetchStudents } from '../../api/students';
import { downloadReportCardPdf, fetchReportCards, generateReportCard } from '../../api/academics';
import { apiErrorMessage } from '../../utils/errors';
import { letterGrade } from '../../utils/format';
import type { ReportCard, ReportCardLine, Student } from '../../types';
import { useTranslation } from 'react-i18next';

const TERMS = [
  { id: 1, name: 'Term 1' },
  { id: 2, name: 'Term 2' },
  { id: 3, name: 'Term 3' },
];

function gradeTone(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-700 dark:text-green-300 dark:text-green-300 dark:text-green-300';
  if (grade === 'B') return 'text-blue-700 dark:text-blue-300 dark:text-blue-300 dark:text-blue-300';
  if (grade === 'C') return 'text-yellow-700 dark:text-yellow-300 dark:text-yellow-300 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300 dark:text-red-300 dark:text-red-300';
}

export default function ReportCardsPage() {
  const { t } = useTranslation();
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => fetchStudents(1),
    retry: false,
  });
  const students: Student[] = studentsQuery.data?.data ?? [];

  const [studentId, setStudentId] = useState('');
  const [termId, setTermId] = useState('1');
  const [card, setCard] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [today] = useState(() => new Date().toLocaleDateString('en-GB'));

  const downloadPdf = async () => {
    if (!card || !card.id) return;
    setDownloading(true);
    setBanner('');
    try {
      await downloadReportCardPdf(card.id);
    } catch (err) {
      setBanner(apiErrorMessage(err, 'Could not generate the PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  const generate = async () => {
    const activeStudentId = studentId || String(students[0]?.id ?? '');
    const student = students.find((s) => String(s.id) === activeStudentId);
    if (!student) return;
    setLoading(true);
    setBanner('');
    try {
      const existing = await fetchReportCards({ student_id: student.id, term_id: Number(termId) });
      const result =
        existing.length > 0 ? existing[0] : await generateReportCard({ student_id: student.id, term_id: Number(termId) });
      setCard({
        ...result,
        student_name: result.student_name ?? `${student.first_name} ${student.last_name}`,
        admission_no: result.admission_no ?? student.admission_no,
        grade_level: result.grade_level ?? student.grade_level,
        term_name: result.term_name ?? TERMS.find((t) => t.id === Number(termId))?.name,
      });
    } catch (err) {
      setBanner(apiErrorMessage(err, 'The report card could not be generated.'));
    } finally {
      setLoading(false);
    }
  };

  const lines = (card?.subjects ?? card?.lines ?? []) as ReportCardLine[];
  const average =
    card?.average ??
    (lines.length
      ? Math.round(lines.reduce((sum, l) => sum + l.score, 0) / lines.length)
      : null);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.reportCards.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pages.reportCards.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Student"
            value={studentId || String(students[0]?.id ?? '')}
            onChange={(e) => setStudentId(e.target.value)}
          >
            {studentsQuery.isPending && <option value="">Loading…</option>}
            {!studentsQuery.isPending && students.length === 0 && <option value="">None available</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} — {s.grade_level}
              </option>
            ))}
          </Select>
          <Select label="Term" value={termId} onChange={(e) => setTermId(e.target.value)}>
            {TERMS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button onClick={generate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>

      {banner && (
        <p className="no-print rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">{banner}</p>
      )}

      {!card ? (
        <Card
          title="No report card yet"
          subtitle={
            studentsQuery.isPending
              ? 'Loading…'
              : studentsQuery.isError
                ? 'No students loaded.'
                : 'Pick a student and term, then press Generate'
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The report card shows subject marks, letter grades, attendance and teacher comments —
            ready for printing.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 print:border-slate-400 dark:print:border-slate-500">
            <div className="border-b-2 border-slate-800 dark:border-slate-600 pb-4 text-center">
              <h2 className="text-xl font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-50">
                Bright Future Academy
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Student Report Card — {card.term_name ?? TERMS.find((t) => t.id === card.term_id)?.name ?? 'Term 1'}</p>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
              <p>
                <span className="font-semibold">Student:</span>{' '}
                {card.student_name ??
                  `${students.find((s) => String(s.id) === studentId)?.first_name ?? ''} ${
                    students.find((s) => String(s.id) === studentId)?.last_name ?? ''
                  }`.trim()}
              </p>
              <p>
                <span className="font-semibold">Admission No:</span>{' '}
                {card.admission_no ??
                  students.find((s) => String(s.id) === studentId)?.admission_no ??
                  '—'}
              </p>
              <p>
                <span className="font-semibold">Class:</span>{' '}
                {card.grade_level ??
                  students.find((s) => String(s.id) === studentId)?.grade_level ??
                  '—'}
              </p>
              <p>
                <span className="font-semibold">Attendance:</span>{' '}
                {card.attendance_percent != null ? `${card.attendance_percent}%` : '—'}
              </p>
            </div>

            <table className="mt-5 w-full divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Subject
                  </th>
                  <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Mark
                  </th>
                  <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((line) => {
                  const grade = line.grade ?? letterGrade(line.score);
                  return (
                    <tr key={line.subject}>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{line.subject}</td>
                      <td className="px-4 py-2 text-right text-slate-800 dark:text-slate-200">{line.score}</td>
                      <td className={`px-4 py-2 text-right font-bold ${gradeTone(grade)}`}>{grade}</td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-slate-500 dark:text-slate-400">
                      No subject marks on this report card.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-900 font-semibold">
                  <td className="px-4 py-2 text-slate-800 dark:text-slate-200">Average</td>
                  <td className="px-4 py-2 text-right text-slate-900 dark:text-slate-50">{average ?? '—'}</td>
                  <td className={`px-4 py-2 text-right ${average != null ? gradeTone(letterGrade(average)) : ''}`}>
                    {average != null ? letterGrade(average) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Teacher / Principal comments</p>
              <p className="mt-1">{card.comments ?? '—'}</p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Generated {today} • Bright Future Academy
              </p>
              <div className="no-print flex gap-2">
                <Button variant="outline" onClick={generate} disabled={loading}>
                  Regenerate
                </Button>
                {card.id > 0 && (
                  <Button variant="outline" onClick={downloadPdf} disabled={downloading}>
                    <Download size={16} />
                    {downloading ? 'Preparing…' : 'Download PDF'}
                  </Button>
                )}
                <Button onClick={() => window.print()}>Print</Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
