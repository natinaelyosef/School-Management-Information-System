import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import Table, { type Column } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import {
  createDepartment,
  deleteDepartment,
  fetchDepartment,
  fetchDepartments,
  fetchPermissions,
  updateDepartment,
  type RoleSummary,
} from '../../api/users';
import { apiErrorMessage } from '../../utils/errors';
import { useAuth } from '../../stores/AuthContext';
import { useTranslation } from 'react-i18next';

type Draft = { name: string; permissions: string[] };

function blankDraft(): Draft {
  return { name: '', permissions: [] };
}

function toggle(list: string[], value: string, checked: boolean): string[] {
  if (checked) return list.includes(value) ? list : [...list, value];
  return list.filter((item) => item !== value);
}

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<Draft>(blankDraft);
  const [createError, setCreateError] = useState('');

  const [editTarget, setEditTarget] = useState<RoleSummary | null>(null);
  const [editForm, setEditForm] = useState<Draft>(blankDraft);
  const [editError, setEditError] = useState('');

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    retry: 1,
  });

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    staleTime: 300_000,
    retry: 1,
  });

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of permissionsQuery.data ?? []) {
      const group = name.includes('.') ? name.split('.')[0] : 'other';
      const list = map.get(group) ?? [];
      list.push(name);
      map.set(group, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissionsQuery.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['departments'] });
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    queryClient.invalidateQueries({ queryKey: ['department-detail'] });
  };

  const createMutation = useMutation({
    mutationFn: () => createDepartment(createForm),
    onSuccess: () => {
      refresh();
      setCreateOpen(false);
      setCreateForm(blankDraft());
      setCreateError('');
      setNotice(t('departments.created'));
    },
    onError: (err) => setCreateError(apiErrorMessage(err, 'The department could not be created.')),
  });

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editTarget) throw new Error('No department selected');
      return updateDepartment(editTarget.id, editForm);
    },
    onSuccess: () => {
      refresh();
      setEditTarget(null);
      setEditError('');
      setNotice('Department updated.');
    },
    onError: (err) => setEditError(apiErrorMessage(err, 'The department could not be updated.')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      refresh();
      setError('');
      setNotice(t('departments.deleted'));
    },
    onError: (err) => setError(apiErrorMessage(err, 'The department could not be deleted.')),
  });

  const openEdit = async (row: RoleSummary) => {
    setEditTarget(row);
    setEditError('');
    setEditForm(blankDraft());
    try {
      const detail = await fetchDepartment(row.id);
      setEditForm({ name: detail.name, permissions: detail.permissions });
    } catch (err) {
      setEditError(apiErrorMessage(err, 'That department could not be loaded.'));
    }
  };

  const permissionChecklist = (draft: Draft, setDraft: (next: Draft) => void) => (
    <div className="max-h-[45vh] space-y-3 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      {groups.map(([group, names]) => {
        const allOn = names.every((n) => draft.permissions.includes(n));
        return (
          <div key={group}>
            <label className="mb-1 flex items-center gap-2 text-sm font-bold capitalize text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                checked={allOn}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    permissions: names.reduce(
                      (acc, n) => toggle(acc, n, e.target.checked),
                      draft.permissions,
                    ),
                  })
                }
              />
              {group.replace(/_/g, ' ')}
              <span className="font-normal text-slate-400">{names.length}</span>
            </label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {names.map((name) => (
                <label
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
                    checked={draft.permissions.includes(name)}
                    onChange={(e) =>
                      setDraft({ ...draft, permissions: toggle(draft.permissions, name, e.target.checked) })
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {groups.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {permissionsQuery.isPending
            ? 'Loading permissions…'
            : 'No permissions could be loaded from the server.'}
        </p>
      )}
    </div>
  );

  const rows = departmentsQuery.data ?? [];

  const columns: Column<RoleSummary>[] = [
    {
      key: 'name',
      header: t('departments.title'),
      render: (r) => (
        <span className="font-semibold capitalize text-slate-900 dark:text-slate-50">
          {r.name.replace(/_/g, ' ')}
        </span>
      ),
    },
    { key: 'permissions_count', header: t('departments.permissions'), render: (r) => r.permissions_count ?? 0 },
    { key: 'users_count', header: t('departments.members'), render: (r) => r.users_count ?? 0 },
    {
      key: 'built_in',
      header: t('common.type'),
      render: (r) => (
        <Badge tone={r.built_in ? 'blue' : 'purple'}>{r.built_in ? t('departments.builtIn') : 'Custom'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        can('roles.manage') ? (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => void openEdit(r)}>
              <Pencil size={14} /> {t('common.edit')}
            </Button>
            {!r.built_in && (
              <Button
                size="sm"
                variant="danger"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete the ${r.name.replace(/_/g, ' ')} department? Accounts can only be removed from it first.`,
                    )
                  ) {
                    deleteMutation.mutate(r.id);
                  }
                }}
              >
                <Trash2 size={14} /> {t('common.delete')}
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('departments.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('departments.subtitle')}
          </p>
        </div>
        {can('roles.manage') && (
          <Button
            onClick={() => {
              setCreateForm(blankDraft());
              setCreateError('');
              setCreateOpen(true);
            }}
          >
            <Plus size={16} /> {t('departments.new')}
          </Button>
        )}
      </div>

      {notice && (
        <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {departmentsQuery.isError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          {apiErrorMessage(
            departmentsQuery.error,
            'The department list could not be loaded. Check that your account has the roles.manage permission.',
          )}
        </p>
      )}

      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-sm font-bold text-blue-800 dark:text-blue-200">
        <Building2 size={16} /> {rows.length} department{rows.length === 1 ? '' : 's'}
      </span>

      <Table<RoleSummary>
        columns={columns}
        rows={rows}
        emptyText={
          departmentsQuery.isPending
            ? 'Loading departments…'
            : departmentsQuery.isError
              ? 'No departments loaded.'
              : 'No departments yet — create the first one.'
        }
      />

      <Modal
        open={createOpen}
        title="New department"
        onClose={() => setCreateOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^[a-z0-9_]{2,60}$/.test(createForm.name)) {
              setCreateError(
                'Use a short id-style name: lowercase letters, numbers and underscores (e.g. admissions_office).',
              );
              return;
            }
            setCreateError('');
            createMutation.mutate();
          }}
        >
          <Input
            label={t('departments.name')}
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value.toLowerCase() })}
            placeholder="e.g. admissions_office"
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {createForm.permissions.length} permission{createForm.permissions.length === 1 ? '' : 's'}{' '}
            selected.
          </p>
          {permissionChecklist(createForm, setCreateForm)}
          {createError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
              {createError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create department'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editTarget !== null}
        title={editTarget ? `Edit ${editTarget.name.replace(/_/g, ' ')}` : 'Edit department'}
        onClose={() => setEditTarget(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (editTarget && editTarget.built_in && editForm.name !== editTarget.name) {
              setEditError(`${t('departments.builtIn')} departments cannot be renamed.`);
              return;
            }
            if (!/^[a-z0-9_]{2,60}$/.test(editForm.name)) {
              setEditError(
                'Use a short id-style name: lowercase letters, numbers and underscores.',
              );
              return;
            }
            setEditError('');
            editMutation.mutate();
          }}
        >
          <Input
            label={t('departments.name')}
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value.toLowerCase() })}
            disabled={Boolean(editTarget?.built_in)}
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {editForm.permissions.length} permission{editForm.permissions.length === 1 ? '' : 's'}{' '}
            selected — changes apply to every account in this department.
          </p>
          {permissionChecklist(editForm, setEditForm)}
          {editError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">
              {editError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
