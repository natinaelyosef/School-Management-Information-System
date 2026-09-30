import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { createStudent, fetchStudents } from '../../api/students';
import { fetchGrades, fetchSections } from '../../api/structure';
import { apiErrorMessage } from '../../utils/errors';
import { classLabel } from '../../utils/format';
import type { Student } from '../../types';
import { useTranslation } from 'react-i18next';

function studentClass(s: Student): string {
  return classLabel(s.grade, s.section) || s.grade_level || '—';
}

const EMPTY_FORM = {
  admission_no: '',
  first_name: '',
  last_name: '',
  gender: 'female',
  dob: '',
  grade_id: '',
  section_id: '',
};

export default function StudentList() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['students', page],
    queryFn: () => fetchStudents(page),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const gradesQuery = useQuery({ queryKey: ['grades'], queryFn: fetchGrades, retry: 1 });
  const sectionsQuery = useQuery({
    queryKey: ['sections', form.grade_id],
    queryFn: () => fetchSections({ grade_id: form.grade_id }),
    enabled: form.grade_id !== '',
    retry: 1,
  });

  const create = useMutation({
    mutationFn: () =>
      createStudent({
        ...(form.admission_no.trim() ? { admission_no: form.admission_no.trim() } : {}),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender as Student['gender'],
        dob: form.dob || null,
        grade_id: form.grade_id ? Number(form.grade_id) : null,
        section_id: form.section_id ? Number(form.section_id) : null,
      }),
    onSuccess: async (student) => {
      setNotice(`${student.first_name} ${student.last_name} added as ${student.admission_no}.`);
      setError('');
      setForm(EMPTY_FORM);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'The student could not be created.')),
  });

  const rows: Student[] = (query.data?.data ?? []).filter((s) =>
    `${s.first_name} ${s.last_name} ${s.admission_no} ${studentClass(s)}`.toLowerCase().includes(q.toLowerCase()),
  );

  const lastPage = query.data?.last_page ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.students.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {query.data
              ? t('pages.students.enrolled', { count: query.data.total })
              : t('pages.students.subtitle')}
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setError('');
            setOpen(true);
          }}
        >
          <Plus size={16} /> Add Student
        </Button>
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {error && !open && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {query.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(query.error, 'The student list could not be loaded. Check the students.view permission.')}
        </p>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
        <Search size={16} className="text-slate-400 dark:text-slate-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, admission no, class…" className="w-full bg-transparent text-sm outline-none" />
      </div>

      <Table<Student>
        columns={[
          { key: 'admission_no', header: 'Adm No' },
          { key: 'name', header: t('common.name'), render: (r) => `${r.first_name} ${r.last_name}` },
          { key: 'class', header: 'Class', render: (r) => studentClass(r) },
          { key: 'gender', header: 'Gender' },
          { key: 'status', header: t('common.status'), render: (r) => <Badge tone={r.status === 'active' ? 'green' : 'slate'}>{r.status}</Badge> },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Link
                to={`/dashboard/students/${r.id}/timeline`}
                className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
              >
                Timeline
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyText={
          query.isPending
            ? 'Loading students…'
            : query.isError
              ? 'No students loaded.'
              : q
                ? 'No students match your search.'
                : 'No students yet — add the first one.'
        }
      />

      {query.data && lastPage > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-xs text-slate-500 dark:text-slate-400">{query.data.current_page} / {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage || query.isFetching} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal open={open} title="Add student" onClose={() => setOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <Input
            label="Admission number"
            value={form.admission_no}
            onChange={(e) => setForm({ ...form, admission_no: e.target.value })}
            placeholder="Leave blank to generate automatically"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            <Input label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Date of birth</span>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Grade" value={form.grade_id} onChange={(e) => setForm({ ...form, grade_id: e.target.value, section_id: '' })}>
              <option value="">Not assigned</option>
              {(gradesQuery.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
            <Select
              label="Section"
              value={form.section_id}
              onChange={(e) => setForm({ ...form, section_id: e.target.value })}
              disabled={form.grade_id === ''}
            >
              <option value="">Not assigned</option>
              {(sectionsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Create student'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
