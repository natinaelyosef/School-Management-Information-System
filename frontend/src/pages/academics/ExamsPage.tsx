import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import {
  createExam,
  fetchExam,
  fetchExamResults,
  fetchExams,
  fetchSubjects,
  publishExam,
  saveExamResults,
} from '../../api/academics';
import { fetchCurrentTerm, fetchCurrentYear, fetchGrades } from '../../api/structure';
import { fetchStudents } from '../../api/students';
import { apiErrorMessage } from '../../utils/errors';
import { formatDate, letterGrade } from '../../utils/format';
import type { Exam, ExamResult } from '../../types';
import { useTranslation } from 'react-i18next';

const EXAM_TYPES = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'test', label: 'Test' },
  { value: 'midterm', label: 'Mid-term' },
  { value: 'final', label: 'Final' },
];

const SUBMISSION_TONES: Record<string, 'slate' | 'blue' | 'green' | 'purple'> = {
  draft: 'slate',
  scheduled: 'blue',
  ongoing: 'blue',
  completed: 'purple',
  published: 'green',
};

interface ExamSubjectRow {
  id: number;
  subject_id?: number | null;
  grade_id?: number | null;
  total_marks?: number | null;
  subject?: { id: number; name: string } | null;
}

interface ExamDetail extends Exam {
  examSubjects?: ExamSubjectRow[];
  subjects?: ExamSubjectRow[];
}

export default function ExamsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['exams'], queryFn: fetchExams, retry: 1 });
  const rows = query.data ?? [];

  const yearQuery = useQuery({ queryKey: ['structure', 'year', 'current'], queryFn: fetchCurrentYear, staleTime: 300_000 });
  const termQuery = useQuery({ queryKey: ['structure', 'term', 'current'], queryFn: fetchCurrentTerm, staleTime: 300_000 });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects, retry: 1 });
  const gradesQuery = useQuery({ queryKey: ['grades'], queryFn: fetchGrades, retry: 1 });

  const [selected, setSelected] = useState<Exam | null>(null);
  const [entering, setEntering] = useState(false);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'midterm',
    start_date: '',
    total_marks: '100',
    subject_id: '',
    grade_id: '',
  });
  const [error, setError] = useState('');

  const detailQuery = useQuery({
    queryKey: ['exam', selected?.id],
    queryFn: () => fetchExam(selected!.id),
    enabled: Boolean(selected),
    retry: 1,
  });

  const detail = detailQuery.data as ExamDetail | undefined;
  const examSubject = detail?.examSubjects?.[0] ?? detail?.subjects?.[0] ?? null;
  const gradeId = examSubject?.grade_id ?? null;

  const resultsQuery = useQuery({
    queryKey: ['exam-results', selected?.id],
    queryFn: () => fetchExamResults(selected!.id),
    enabled: Boolean(selected),
    retry: 1,
  });

  const rosterQuery = useQuery({
    queryKey: ['students', 'roster', gradeId],
    queryFn: () => fetchStudents(1, { grade_id: gradeId!, per_page: 200 }),
    enabled: Boolean(gradeId),
    retry: 1,
  });

  const results: ExamResult[] = resultsQuery.data ?? [];
  const roster = rosterQuery.data?.data ?? [];

  const entryRows: Array<{ student_id: number; name: string; score: number | null }> = (() => {
    const map = new Map<number, { student_id: number; name: string; score: number | null }>();
    for (const student of roster) {
      map.set(student.id, {
        student_id: student.id,
        name: `${student.first_name} ${student.last_name}`.trim(),
        score: null,
      });
    }
    for (const result of results) {
      const existing = map.get(result.student_id);
      map.set(result.student_id, {
        student_id: result.student_id,
        name: result.student_name ?? existing?.name ?? `Student #${result.student_id}`,
        score: result.score ?? result.marks_obtained ?? null,
      });
    }
    return Array.from(map.values());
  })();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['exams'] });
    queryClient.invalidateQueries({ queryKey: ['exam-results'] });
    queryClient.invalidateQueries({ queryKey: ['exam'] });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const year = yearQuery.data;
    if (!year) {
      setError('No academic year is configured yet — ask an administrator to create one first.');
      return;
    }

    setBusy(true);
    try {
      await createExam({
        name: form.name,
        academic_year_id: year.id,
        term_id: termQuery.data?.id ?? null,
        type: form.type as 'quiz' | 'test' | 'midterm' | 'final',
        start_date: form.start_date || null,
        total_marks: Number(form.total_marks) || 100,
        subject_id: form.subject_id ? Number(form.subject_id) : null,
        grade_id: form.grade_id ? Number(form.grade_id) : null,
      });
      await refresh();
      setCreateOpen(false);
      setForm({ name: '', type: 'midterm', start_date: '', total_marks: '100', subject_id: '', grade_id: '' });
    } catch (err) {
      setError(apiErrorMessage(err, 'The exam could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const openExam = (exam: Exam) => {
    setSelected(exam);
    setEntering(false);
    setNotice('');
    setMarks({});
  };

  const startEntering = () => {
    const initial: Record<number, string> = {};
    for (const row of entryRows) {
      if (row.score != null) initial[row.student_id] = String(row.score);
    }
    setMarks(initial);
    setEntering(true);
  };

  const submitMarks = async () => {
    if (!selected) return;
    setBusy(true);
    setNotice('');
    try {
      const payload = entryRows
        .filter((row) => marks[row.student_id] !== undefined && marks[row.student_id] !== '')
        .map((row) => ({
          student_id: row.student_id,
          score: Number(marks[row.student_id]),
          exam_subject_id: examSubject?.id,
        }));
      if (payload.length === 0) {
        setNotice('Enter at least one score first.');
        return;
      }
      await saveExamResults(selected.id, payload);
      await refresh();
      setNotice('Marks saved.');
      setEntering(false);
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Marks could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!selected) return;
    if (!window.confirm(`Publish results for "${selected.title}"? Students and parents will see them.`)) return;
    setBusy(true);
    setNotice('');
    try {
      await publishExam(selected.id);
      await refresh();
      setSelected({ ...selected, status: 'published', is_published: true });
      setNotice('Results published.');
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Results could not be published.'));
    } finally {
      setBusy(false);
    }
  };

  const isPublished = Boolean(selected && (selected.status === 'published' || selected.is_published));
  const subjectName =
    (typeof examSubject?.subject === 'object' ? examSubject.subject?.name : null) ?? selected?.subject ?? null;
  const totalMarks = examSubject?.total_marks ?? selected?.total_marks ?? 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.exams.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>+ New Exam</Button>
      </div>

      {query.isError && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
          Exams could not be loaded — check the backend connection, then refresh.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <Table<Exam>
        columns={[
          { key: 'title', header: 'Exam' },
          { key: 'exam_type', header: t('common.type'), render: (r) => r.exam_type ?? '—' },
          { key: 'exam_date', header: t('common.date'), render: (r) => (r.exam_date ? formatDate(r.exam_date) : '—') },
          { key: 'total_marks', header: 'Marks', render: (r) => String(r.total_marks ?? '—') },
          {
            key: 'status',
            header: t('common.status'),
            render: (r) => {
              const published = r.status === 'published' || r.is_published;
              const tone = published ? 'green' : SUBMISSION_TONES[r.status ?? 'draft'] || 'slate';
              return <Badge tone={tone}>{published ? 'published' : (r.status ?? 'draft')}</Badge>;
            },
          },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Button size="sm" variant="outline" onClick={() => openExam(r)}>
                View results
              </Button>
            ),
          },
        ]}
        rows={rows}
      />

      <Modal open={createOpen} title="Create Exam" onClose={() => setCreateOpen(false)}>
        <form onSubmit={create} className="space-y-3">
          <Input
            label="Exam name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Grade 8 Mid-term"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {EXAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input label="Start date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('campaigns.subject')} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
              <option value="">— Optional —</option>
              {(subjectsQuery.data ?? []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
            <Select label="Grade" value={form.grade_id} onChange={(e) => setForm({ ...form, grade_id: e.target.value })}>
              <option value="">— Optional —</option>
              {(gradesQuery.data ?? []).map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Total marks"
            type="number"
            min={1}
            value={form.total_marks}
            onChange={(e) => setForm({ ...form, total_marks: e.target.value })}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Academic year: {yearQuery.data?.name ?? (yearQuery.isLoading ? 'loading…' : 'not configured')} · Term:{' '}
            {termQuery.data?.name ?? '—'}
          </p>
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create Exam'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title={selected?.title ?? 'Exam results'} onClose={() => setSelected(null)}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Badge tone={isPublished ? 'green' : 'blue'}>{isPublished ? 'published' : (selected?.status ?? 'draft')}</Badge>
            <span>{subjectName ?? '—'}</span>
            <span>•</span>
            <span>{selected?.exam_date ? formatDate(selected.exam_date) : '—'}</span>
            <span>•</span>
            <span>{totalMarks} marks</span>
          </div>

          {detailQuery.isError && (
            <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-200">
              Exam details could not be loaded from the backend.
            </p>
          )}
          {resultsQuery.isError && (
            <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-800 dark:text-amber-200">
              Results could not be loaded from the backend.
            </p>
          )}
          {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2 text-xs text-blue-800 dark:text-blue-200">{notice}</p>}

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Student</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Score</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entryRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400">
                      {resultsQuery.isLoading || rosterQuery.isLoading
                        ? 'Loading roster…'
                        : 'No students found for this exam.'}
                    </td>
                  </tr>
                )}
                {entryRows.map((row) => {
                  const raw = entering ? (marks[row.student_id] ?? '') : (row.score != null ? String(row.score) : '');
                  const numeric = raw === '' ? null : Number(raw);
                  return (
                    <tr key={row.student_id}>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.name}</td>
                      <td className="px-3 py-2">
                        {entering ? (
                          <input
                            type="number"
                            min={0}
                            max={totalMarks}
                            value={raw}
                            onChange={(e) => setMarks({ ...marks, [row.student_id]: e.target.value })}
                            className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">{raw === '' ? '—' : raw}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">
                        {numeric != null ? letterGrade(numeric) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {entering ? (
              <>
                <Button variant="outline" onClick={() => setEntering(false)}>{t('common.cancel')}</Button>
                <Button onClick={submitMarks} disabled={busy}>{busy ? 'Saving…' : 'Save Marks'}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startEntering}>Enter marks</Button>
                <Button onClick={publish} disabled={busy || isPublished}>
                  {isPublished ? 'Published' : 'Publish results'}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
