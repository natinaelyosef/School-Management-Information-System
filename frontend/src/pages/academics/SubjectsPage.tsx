import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { createSubject, deleteSubject, fetchSubjects } from '../../api/academics';
import { fetchLevels } from '../../api/structure';
import { apiErrorMessage } from '../../utils/errors';
import type { Subject } from '../../types';
import { useTranslation } from 'react-i18next';

export default function SubjectsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['subjects'], queryFn: fetchSubjects, retry: 1 });
  const levelsQuery = useQuery({ queryKey: ['levels'], queryFn: fetchLevels, retry: 1 });
  const rows = query.data ?? [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', school_level_id: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['subjects'] });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createSubject({
        name: form.name,
        code: form.code,
        school_level_id: form.school_level_id ? Number(form.school_level_id) : null,
      });
      await refresh();
      setForm({ name: '', code: '', school_level_id: '' });
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'The subject could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (subject: Subject) => {
    if (!window.confirm(`Delete subject "${subject.name}"?`)) return;
    setError('');
    try {
      await deleteSubject(subject.id);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, 'The subject could not be deleted.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.subjects.title')}</h1>
        <Button onClick={() => setOpen(true)}>+ New Subject</Button>
      </div>

      {query.isError && (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-200">
          Subjects could not be loaded — check the backend connection, then refresh.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <Table<Subject>
        columns={[
          { key: 'code', header: 'Code' },
          { key: 'name', header: t('pages.subjects.title') },
          {
            key: 'level_name',
            header: 'Level',
            render: (r) => r.level_name ?? (r.level_id ? `Level ${r.level_id}` : '—'),
          },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Button variant="outline" size="sm" onClick={() => remove(r)}>
                Delete
              </Button>
            ),
          },
        ]}
        rows={rows}
      />

      <Modal open={open} title="Create Subject" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <Input
            label="Subject name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Mathematics"
            required
          />
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="e.g. MATH-08"
            required
          />
          <Select
            label="School level"
            value={form.school_level_id}
            onChange={(e) => setForm({ ...form, school_level_id: e.target.value })}
          >
            <option value="">— Optional —</option>
            {(levelsQuery.data ?? []).map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </Select>
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
