import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { createParent, deleteParent, fetchParents, updateParent, type SchoolParent } from '../../api/parents';
import { fetchStudents } from '../../api/students';
import { useAuth } from '../../stores/AuthContext';
import { apiErrorMessage } from '../../utils/errors';
import type { Student } from '../../types';
import { useTranslation } from 'react-i18next';

const RELATIONSHIPS = ['mother', 'father', 'guardian', 'sponsor', 'other'];

const EMPTY = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  relationship: 'guardian',
  occupation: '',
  address: '',
};

export default function ParentsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolParent | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [studentFilter, setStudentFilter] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState<SchoolParent | null>(null);

  const query = useQuery({
    queryKey: ['parents', page, search],
    queryFn: () => fetchParents(page, { search: search || undefined }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const studentsQuery = useQuery({
    queryKey: ['students', 'all'],
    queryFn: () => fetchStudents(1, { per_page: 200 }),
    enabled: open,
    retry: 1,
  });

  const students: Student[] = studentsQuery.data?.data ?? [];

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        relationship: form.relationship || null,
        occupation: form.occupation.trim() || null,
        address: form.address.trim() || null,
        student_ids: studentIds,
      };
      return editing ? updateParent(editing.id, payload) : createParent(payload);
    },
    onSuccess: async (saved) => {
      setNotice(`${saved.first_name} ${saved.last_name} ${editing ? 'updated' : 'added'}.`);
      setError('');
      close();
      await queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'The guardian record could not be saved.')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteParent(id),
    onSuccess: async () => {
      setNotice('Guardian removed.');
      setError('');
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
    onError: (err) => setError(apiErrorMessage(err, 'The guardian record could not be deleted.')),
  });

  const close = () => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY);
    setStudentIds([]);
    setStudentFilter('');
    setError('');
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setStudentIds([]);
    setStudentFilter('');
    setError('');
    setOpen(true);
  };

  const openEdit = (parent: SchoolParent) => {
    setEditing(parent);
    setForm({
      first_name: parent.first_name ?? '',
      last_name: parent.last_name ?? '',
      phone: parent.phone ?? '',
      email: parent.email ?? '',
      relationship: parent.relationship ?? 'guardian',
      occupation: parent.occupation ?? '',
      address: parent.address ?? '',
    });
    setStudentIds((parent.students ?? []).map((s) => s.id));
    setStudentFilter('');
    setError('');
    setOpen(true);
  };

  const rows = query.data?.data ?? [];
  const lastPage = query.data?.last_page ?? 1;
  const visibleStudents = students.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.admission_no}`.toLowerCase().includes(studentFilter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.parents.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {query.data
              ? t('pages.parents.onFile', { count: query.data.total })
              : t('pages.parents.subtitle')}
          </p>
        </div>
        {can('parents.create') && (
          <Button onClick={openCreate}>
            <Plus size={16} /> Add guardian
          </Button>
        )}
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {error && !open && !confirming && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
      {query.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(query.error, 'The guardian list could not be loaded. Check the parents.view permission.')}
        </p>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
        <Search size={16} className="text-slate-400 dark:text-slate-500" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, phone or email…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <Table<SchoolParent>
        columns={[
          { key: 'name', header: t('common.name'), render: (r) => `${r.first_name} ${r.last_name}` },
          { key: 'phone', header: t('common.phone'), render: (r) => r.phone || '—' },
          { key: 'email', header: t('common.email'), render: (r) => r.email || '—' },
          { key: 'relationship', header: 'Relationship', render: (r) => <Badge tone="slate">{r.relationship ?? 'guardian'}</Badge> },
          {
            key: 'students',
            header: 'Children',
            render: (r) => {
              const children = r.students ?? [];
              if (children.length === 0) return <span className="text-slate-400 dark:text-slate-500">—</span>;
              return (
                <span className="flex flex-wrap gap-1">
                  {children.slice(0, 3).map((c) => (
                    <Badge key={c.id} tone="blue">{`${c.first_name} ${c.last_name}`}</Badge>
                  ))}
                  {children.length > 3 && <span className="text-xs text-slate-500 dark:text-slate-400">+{children.length - 3}</span>}
                </span>
              );
            },
          },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <span className="flex items-center justify-end gap-1">
                {can('parents.edit') && (
                  <button
                    onClick={() => openEdit(r)}
                    className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label={`Edit ${r.first_name} ${r.last_name}`}
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {can('parents.delete') && (
                  <button
                    onClick={() => setConfirming(r)}
                    className="rounded-lg p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    aria-label={`Delete ${r.first_name} ${r.last_name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </span>
            ),
          },
        ]}
        rows={rows}
        emptyText={
          query.isPending
            ? 'Loading guardians…'
            : query.isError
              ? 'No guardians loaded.'
              : search
                ? 'No guardians match your search.'
                : 'No guardians yet — add the first one.'
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

      <Modal open={open} title={editing ? 'Edit guardian' : 'Add guardian'} onClose={close}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            <Input label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+2519…" />
            <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
            <Input label="Occupation" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                <Users size={13} className="mr-1 inline" /> Children ({studentIds.length} selected)
              </span>
              <input
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                placeholder="Filter students…"
                className="w-40 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
              />
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2">
              {studentsQuery.isPending && <p className="px-1 text-xs text-slate-500 dark:text-slate-400">Loading students…</p>}
              {studentsQuery.isError && (
                <p className="px-1 text-xs text-yellow-700 dark:text-yellow-300">
                  {apiErrorMessage(studentsQuery.error, 'The student list could not be loaded.')}
                </p>
              )}
              {visibleStudents.map((s) => {
                const checked = studentIds.includes(s.id);
                return (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setStudentIds((ids) =>
                          checked ? ids.filter((i) => i !== s.id) : [...ids, s.id],
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      {s.first_name} {s.last_name}{' '}
                      <span className="text-xs text-slate-400 dark:text-slate-500">{s.admission_no}</span>
                    </span>
                  </label>
                );
              })}
              {!studentsQuery.isPending && !studentsQuery.isError && visibleStudents.length === 0 && (
                <p className="px-1 text-xs text-slate-500 dark:text-slate-400">No students match.</p>
              )}
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create guardian'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={confirming !== null}
        title="Delete guardian"
        onClose={() => {
          setConfirming(null);
          setError('');
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {confirming
              ? `${confirming.first_name} ${confirming.last_name} will be removed from the guardian directory. The link to their children is cleared.`
              : ''}
          </p>
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => confirming && remove.mutate(confirming.id)} disabled={remove.isPending}>
              {remove.isPending ? 'Deleting…' : 'Delete guardian'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
