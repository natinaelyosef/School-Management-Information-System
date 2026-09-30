import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import { createAssignment, fetchAssignments, fetchSubjects, gradeSubmission, submitAssignment } from '../../api/academics';
import { apiErrorMessage } from '../../utils/errors';
import { useAuth } from '../../stores/AuthContext';
import { formatDate } from '../../utils/format';
import type { Assignment } from '../../types';
import { useTranslation } from 'react-i18next';

export default function AssignmentsPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['assignments'], queryFn: fetchAssignments, retry: false });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects, retry: false });
  const rows = query.data ?? [];
  const subjects = subjectsQuery.data ?? [];

  const isTeacher = role === 'teacher' || role === 'academic' || role === 'principal' || role === 'super_admin';
  const isStudent = role === 'student';

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', grade_id: '8', section_id: '1', subject_id: '1' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [gradeTarget, setGradeTarget] = useState<Assignment | null>(null);
  const [scores, setScores] = useState<Record<number, string>>({});
  const [submitTarget, setSubmitTarget] = useState<Assignment | null>(null);
  const [answer, setAnswer] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['assignments'] });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createAssignment({
        title: form.title,
        description: form.description,
        due_date: form.due_date,
        grade_id: Number(form.grade_id),
        section_id: Number(form.section_id),
        subject_id: Number(form.subject_id),
      });
      await refresh();
      setCreateOpen(false);
      setForm({ title: '', description: '', due_date: '', grade_id: '8', section_id: '1', subject_id: '1' });
    } catch (err) {
      setError(apiErrorMessage(err, 'The assignment could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const saveGrades = async () => {
    if (!gradeTarget) return;
    setBusy(true);
    setNotice('');
    try {
      const subs = gradeTarget.submissions ?? [];
      for (const sub of subs) {
        const raw = scores[sub.id];
        if (raw === undefined || raw === '') continue;
        await gradeSubmission(gradeTarget.id, sub.id, Number(raw));
      }
      await refresh();
      setNotice('Grades saved to backend.');
      setGradeTarget(null);
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Grades could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const sendAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTarget) return;
    setBusy(true);
    setNotice('');
    try {
      await submitAssignment(submitTarget.id, answer);
      await refresh();
      setNotice('Answer submitted.');
      setSubmitTarget(null);
      setAnswer('');
    } catch (err) {
      setNotice(apiErrorMessage(err, 'The answer could not be submitted.'));
    } finally {
      setBusy(false);
    }
  };

  const gradeSubmissionList = gradeTarget?.submissions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.assignments.title')}</h1>
        {isTeacher && <Button onClick={() => setCreateOpen(true)}>+ New Assignment</Button>}
      </div>
      {query.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(query.error, 'The assignments could not be loaded.')}
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-800 dark:text-green-200">{notice}</p>}
      <Table<Assignment>
        columns={[
          { key: 'title', header: 'Assignment' },
          { key: 'subject_name', header: t('pages.subjects.title'), render: (r) => r.subject_name ?? '—' },
          { key: 'class', header: 'Class', render: (r) => `${r.grade_name ?? `Grade ${r.grade_id ?? '—'}`}-${r.section_name ?? '—'}` },
          { key: 'due_date', header: 'Due', render: (r) => (r.due_date ? formatDate(r.due_date) : '—') },
          { key: 'submissions', header: 'Submitted', render: (r) => `${r.submitted_count ?? r.submissions?.length ?? 0} / ${r.total_students ?? '—'}` },
          {
            key: 'actions',
            header: '',
            render: (r) =>
              isTeacher ? (
                <Button size="sm" variant="outline" onClick={() => { setScores({}); setGradeTarget(r); }}>
                  Grade submissions
                </Button>
              ) : isStudent ? (
                <Button size="sm" onClick={() => { setAnswer(''); setSubmitTarget(r); }}>
                  Submit answer
                </Button>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">View only</span>
              ),
          },
        ]}
        rows={rows}
        emptyText={
          query.isPending
            ? 'Loading…'
            : query.isError
              ? 'No assignments loaded.'
              : 'No assignments yet.'
        }
      />

      <Modal open={createOpen} title="Create Assignment" onClose={() => setCreateOpen(false)}>
        <form onSubmit={create} className="space-y-3">
          <Input label={t('common.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Due date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <Select label={t('campaigns.subject')} value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
              {subjects.length === 0 && <option value="">None available</option>}
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select label="Grade ID" value={form.grade_id} onChange={(e) => setForm({ ...form, grade_id: e.target.value })}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </Select>
            <Select label="Section" value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
              {['A', 'B', 'C'].map((s, i) => (
                <option key={s} value={i + 1}>Section {s}</option>
              ))}
            </Select>
          </div>
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(gradeTarget)} title={`Grade — ${gradeTarget?.title ?? ''}`} onClose={() => setGradeTarget(null)}>
        <div className="space-y-3">
          {gradeSubmissionList.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{sub.student_name ?? `Student #${sub.student_id}`}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={sub.score != null ? String(sub.score) : 'score'}
                    value={scores[sub.id] ?? ''}
                    onChange={(e) => setScores({ ...scores, [sub.id]: e.target.value })}
                    className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">/ 100</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{sub.answer}</p>
            </div>
          ))}
          {notice && <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-2 text-xs text-yellow-800 dark:text-yellow-200">{notice}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGradeTarget(null)}>{t('common.close')}</Button>
            <Button onClick={saveGrades} disabled={busy}>{busy ? 'Saving…' : 'Save Grades'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(submitTarget)} title={`Submit — ${submitTarget?.title ?? ''}`} onClose={() => setSubmitTarget(null)}>
        <form onSubmit={sendAnswer} className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">{submitTarget?.description}</p>
          <Textarea label="Your answer" rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSubmitTarget(null)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Answer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
