import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import {
  activateUser,
  bulkCreateUsers,
  createUser,
  deleteUser,
  fetchRoles,
  fetchUsers,
  resetUserPassword,
  suspendUser,
  updateUser,
  type CreateUserPayload,
  type ManagedUser,
} from '../../api/users';
import { apiErrorMessage } from '../../utils/errors';
import { useAuth } from '../../stores/AuthContext';
import { useTranslation } from 'react-i18next';

const MAX_BULK_ROWS = 200;
const PER_PAGE = 100;
const BULK_CHUNK = 20;

const BUILTIN_ROLES: string[] = [
  'super_admin',
  'school_admin',
  'principal',
  'academic_coordinator',
  'registrar',
  'registration_office',
  'teacher',
  'accountant',
  'librarian',
  'nurse',
  'parent',
  'student',
];

const BADGE_TONES = ['blue', 'green', 'purple', 'yellow', 'slate'] as const;

type Draft = {
  name: string;
  email: string;
  password: string;
  phone: string;
  roles: string[];
};

type EditDraft = Omit<Draft, 'password'>;

type BulkRow = Draft & { id: number };

type RowAction = { kind: 'suspend' | 'activate' | 'delete'; id: number; name: string };

function blankDraft(): Draft {
  return { name: '', email: '', password: '', phone: '', roles: [] };
}

function blankRow(id: number): BulkRow {
  return { id, ...blankDraft() };
}

function toggleRole(list: string[], name: string, checked: boolean): string[] {
  if (checked) return list.includes(name) ? list : [...list, name];
  return list.filter((item) => item !== name);
}

function rolesOf(user: ManagedUser): string[] {
  const fromList = (user.roles ?? []).map((r) => r.name).filter(Boolean);
  if (fromList.length > 0) return fromList;
  return user.role ? [user.role] : [];
}

function isSuspended(user: ManagedUser): boolean {
  if (user.status) return user.status.toLowerCase() === 'suspended';
  return user.is_active === false;
}

function validateDraft(draft: Draft, label: string): string {
  if (!draft.name.trim()) return `${label}: name is required.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    return `${label}: a valid email address is required.`;
  }
  if (draft.password.length < 8) return `${label}: password must be at least 8 characters.`;
  if (draft.roles.length === 0) return `${label}: choose at least one role.`;
  return '';
}

function cleanDraft(draft: Draft): CreateUserPayload {
  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    password: draft.password,
    phone: draft.phone.trim() || undefined,
    roles: draft.roles,
  };
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { isAuthenticated, can } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = can('users.create');
  const canEdit = can('users.edit');
  const canReset = can('users.reset_password');
  const canActivate = can('users.activate');
  const canDelete = can('users.delete');
  const canActOnRows = canEdit || canReset || canActivate || canDelete;

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [rowError, setRowError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<Draft>(blankDraft);
  const [createError, setCreateError] = useState('');

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => [blankRow(0)]);
  const [bulkError, setBulkError] = useState('');

  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState<EditDraft>(() => {
    const blank = blankDraft();
    return { name: blank.name, email: blank.email, phone: blank.phone, roles: blank.roles };
  });
  const [editError, setEditError] = useState('');

  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetValue, setResetValue] = useState('');
  const [resetError, setResetError] = useState('');

  const usersQuery = useQuery({
    queryKey: ['users', roleFilter, statusFilter, deferredSearch, page],
    queryFn: () =>
      fetchUsers({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: deferredSearch || undefined,
        page,
        per_page: PER_PAGE,
      }),
    enabled: isAuthenticated,
    retry: false,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    enabled: isAuthenticated,
    staleTime: 300_000,
    retry: false,
  });

  const roleOptions = useMemo(() => {
    const fromApi = (rolesQuery.data ?? []).map((r) => r.name).filter(Boolean);
    return fromApi.length > 0 ? fromApi : BUILTIN_ROLES;
  }, [rolesQuery.data]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = usersQuery.data?.data ?? [];
    if (!needle) return list;
    return list.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(needle));
  }, [usersQuery.data, search]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const createMutation = useMutation({
    mutationFn: () => createUser(cleanDraft(createForm)),
    onSuccess: () => {
      refresh();
      setCreateOpen(false);
      setCreateForm(blankDraft());
      setCreateError('');
      setNotice(t('users.accountCreated'));
    },
    onError: (err) => setCreateError(apiErrorMessage(err, 'The account could not be created.')),
  });

  const bulkMutation = useMutation({
    mutationFn: (users: CreateUserPayload[]) => bulkCreateUsers(users),
    onSuccess: (created) => {
      refresh();
      setBulkOpen(false);
      setBulkRows([blankRow(0)]);
      setBulkError('');
      setNotice(`${created.length} accounts created.`);
    },
    onError: (err) => setBulkError(apiErrorMessage(err, 'The batch could not be created.')),
  });

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editTarget) throw new Error('No account selected');
      return updateUser(editTarget.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined,
        roles: editForm.roles,
      });
    },
    onSuccess: () => {
      refresh();
      setEditTarget(null);
      setEditError('');
      setNotice(t('users.accountUpdated'));
    },
    onError: (err) => setEditError(apiErrorMessage(err, 'The account could not be updated.')),
  });

  const rowMutation = useMutation({
    mutationFn: (input: RowAction) => {
      if (input.kind === 'suspend') return suspendUser(input.id);
      if (input.kind === 'activate') return activateUser(input.id);
      return deleteUser(input.id);
    },
    onSuccess: (_data, input) => {
      refresh();
      setRowError('');
      setNotice(
        input.kind === 'suspend'
          ? `${input.name} suspended.`
          : input.kind === 'activate'
            ? `${input.name} activated.`
            : `${input.name} removed.`,
      );
    },
    onError: (err) => setRowError(apiErrorMessage(err, 'That action could not be completed.')),
  });

  const resetMutation = useMutation({
    mutationFn: (input: { id: number; password: string }) =>
      resetUserPassword(input.id, input.password),
    onSuccess: (_data, input) => {
      refresh();
      setResetTarget(null);
      setResetValue('');
      setResetError('');
      setNotice(`Password reset for account #${input.id}.`);
    },
    onError: (err) => setResetError(apiErrorMessage(err, 'The password could not be reset.')),
  });

  const openCreate = () => {
    setCreateForm(blankDraft());
    setCreateError('');
    setCreateOpen(true);
  };

  const openBulk = () => {
    setBulkRows([blankRow(0)]);
    setBulkError('');
    setBulkOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditTarget(user);
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      roles: rolesOf(user),
    });
    setEditError('');
  };

  const openReset = (user: ManagedUser) => {
    setResetTarget(user);
    setResetValue('');
    setResetError('');
  };

  const patchRow = (index: number, patch: Partial<Draft>) => {
    setBulkRows((prev) => prev.map((row) => (row.id === index ? { ...row, ...patch } : row)));
  };

  const submitBulk = () => {
    const filled = bulkRows.filter(
      (row) => row.name.trim() !== '' || row.email.trim() !== '' || row.password !== '',
    );
    if (filled.length === 0) {
      setBulkError('Add at least one account to the batch.');
      return;
    }
    if (filled.length > MAX_BULK_ROWS) {
      setBulkError(`Batches are limited to ${MAX_BULK_ROWS} accounts at a time.`);
      return;
    }
    for (const [index, row] of filled.entries()) {
      const problem = validateDraft(row, `Row ${index + 1}`);
      if (problem) {
        setBulkError(problem);
        return;
      }
    }
    setBulkError('');
    bulkMutation.mutate(filled.map(cleanDraft));
  };

  const total = usersQuery.data?.total ?? rows.length;
  const roleBadges = (user: ManagedUser) => {
    const names = rolesOf(user);
    if (names.length === 0) return <span className="text-slate-400 dark:text-slate-500">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {names.map((name, index) => (
          <Badge key={name} tone={BADGE_TONES[index % BADGE_TONES.length]}>
            {name.replace(/_/g, ' ')}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('users.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('users.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-sm font-bold text-blue-800 dark:text-blue-200">
            <Users size={16} /> {t('users.shown', { count: rows.length })}
          </span>
          {canCreate && (
            <Button variant="secondary" onClick={openBulk}>
              <Plus size={16} /> {t('users.bulkCreate')}
            </Button>
          )}
          {canCreate && (
            <Button onClick={openCreate}>
              <UserPlus size={16} /> {t('users.newUser')}
            </Button>
          )}
        </div>
      </div>

      {notice && <p className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-sm text-blue-800 dark:text-blue-200">{notice}</p>}
      {rowError && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{rowError}</p>}
      {usersQuery.isError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
          The user service could not be reached, so no accounts are listed. Check that the API is
          running and that your account has the <strong>users.view</strong> permission.
        </p>
      )}
      {rolesQuery.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          Roles could not be loaded from the server — the school&apos;s built-in role set is shown
          instead.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
          <Search size={16} className="text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="{t('common.searchPlaceholder')}"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <Select
          label="Role"
          value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          className="sm:w-48"
        >
          <option value="">{t('common.allRoles')}</option>
          {roleOptions.map((name) => (
            <option key={name} value={name}>
              {name.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Select
          label={t('common.status')}
          value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          className="sm:w-40"
        >
          <option value="">{t('common.allStatuses')}</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      <Table<ManagedUser>
        columns={[
          { key: 'name', header: t('common.name') },
          { key: 'email', header: t('common.email') },
          {
            key: 'phone',
            header: t('common.phone'),
            render: (r) => r.phone || <span className="text-slate-400 dark:text-slate-500">—</span>,
          },
          { key: 'roles', header: t('nav.departments'), render: roleBadges },
          {
            key: 'status',
            header: t('common.status'),
            render: (r) => (
              <Badge tone={isSuspended(r) ? 'red' : 'green'}>
                {isSuspended(r) ? 'Suspended' : 'Active'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (r) => {
              if (!canActOnRows) {
                return <span className="text-slate-400 dark:text-slate-500">—</span>;
              }
              return (
              <div className="flex flex-wrap items-center gap-1">
                {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(r)}
                  title={`Edit ${r.name}`}
                  aria-label={`Edit ${r.name}`}
                >
                  <Pencil size={14} /> {t('common.edit')}
                </Button>
                )}
                {canReset && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReset(r)}
                  title={`Reset password for ${r.name}`}
                  aria-label={`Reset password for ${r.name}`}
                >
                  <KeyRound size={14} /> {t('users.resetPassword')}
                </Button>
                )}
                {canActivate && (isSuspended(r) ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={rowMutation.isPending}
                    onClick={() => rowMutation.mutate({ kind: 'activate', id: r.id, name: r.name })}
                    title={`Activate ${r.name}`}
                    aria-label={`Activate ${r.name}`}
                  >
                    <CheckCircle2 size={14} /> {t('users.activate')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={rowMutation.isPending}
                    onClick={() => {
                      if (!window.confirm(`Suspend ${r.name}? They will not be able to sign in.`)) {
                        return;
                      }
                      rowMutation.mutate({ kind: 'suspend', id: r.id, name: r.name });
                    }}
                    title={`Suspend ${r.name}`}
                    aria-label={`Suspend ${r.name}`}
                  >
                    <Ban size={14} /> {t('users.suspend')}
                  </Button>
                ))}
                {canDelete && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={rowMutation.isPending}
                  onClick={() => {
                    if (!window.confirm(`Delete ${r.name}? This removes the account.`)) return;
                    rowMutation.mutate({ kind: 'delete', id: r.id, name: r.name });
                  }}
                  title={`Delete ${r.name}`}
                  aria-label={`Delete ${r.name}`}
                >
                  <Trash2 size={14} /> {t('common.delete')}
                </Button>
                )}
              </div>
              );
            },
          },
        ]}
        rows={rows}
        emptyText={
          usersQuery.isError
            ? 'No accounts loaded.'
            : usersQuery.isPending
              ? 'Loading accounts…'
              : 'No accounts match the current filters.'
        }
      />

      {usersQuery.data && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {rows.length} of {total} account{total === 1 ? '' : 's'}
            {usersQuery.data.last_page > 1 && ` — page ${usersQuery.data.current_page} of ${usersQuery.data.last_page}`}
            .
          </p>
          {usersQuery.data.last_page > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= usersQuery.data.last_page || usersQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal open={createOpen} title={t('users.newUser')} onClose={() => setCreateOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const problem = validateDraft(createForm, 'This account');
            setCreateError(problem);
            if (problem) return;
            createMutation.mutate();
          }}
        >
          <Input
            label={t('users.fullName')}
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            required
          />
          <Input
            label={t('common.email')}
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            required
          />
          <Input
            label={t('users.temporaryPassword')}
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            required
          />
          <Input
            label={`${t('common.phone')} (${t('common.optional')})`}
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
          />
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Roles (at least one)
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roleOptions.map((name) => (
                <label
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm capitalize text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                    checked={createForm.roles.includes(name)}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        roles: toggleRole(prev.roles, name, e.target.checked),
                      }))
                    }
                  />
                  {name.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </fieldset>
          {createError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{createError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={bulkOpen} title="Bulk create accounts" onClose={() => setBulkOpen(false)}>
        <div className="space-y-3">
          <p className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm text-slate-600 dark:text-slate-300">
            Add every account you need and submit them together. Batches are limited to{' '}
            {MAX_BULK_ROWS} accounts at a time.
          </p>

          <Table<BulkRow>
            columns={[
              {
                key: 'name',
                header: t('common.name'),
                render: (r) => (
                  <Input
                    value={r.name}
                    onChange={(e) => patchRow(r.id, { name: e.target.value })}
                    className="min-w-[9rem]"
                    aria-label={`Row ${r.id + 1} name`}
                  />
                ),
              },
              {
                key: 'email',
                header: t('common.email'),
                render: (r) => (
                  <Input
                    type="email"
                    value={r.email}
                    onChange={(e) => patchRow(r.id, { email: e.target.value })}
                    className="min-w-[12rem]"
                    aria-label={`Row ${r.id + 1} email`}
                  />
                ),
              },
              {
                key: 'password',
                header: 'Password',
                render: (r) => (
                  <Input
                    type="password"
                    value={r.password}
                    onChange={(e) => patchRow(r.id, { password: e.target.value })}
                    className="min-w-[9rem]"
                    aria-label={`Row ${r.id + 1} password`}
                  />
                ),
              },
              {
                key: 'roles',
                header: 'Roles (ctrl-click for several)',
                render: (r) => (
                  <select
                    multiple
                    value={r.roles}
                    onChange={(e) =>
                      patchRow(r.id, {
                        roles: Array.from(e.target.selectedOptions, (option) => option.value),
                      })
                    }
                    className="min-h-[4.5rem] w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs capitalize text-slate-900 dark:text-slate-50 outline-none focus:border-blue-600"
                    aria-label={`Row ${r.id + 1} roles`}
                  >
                    {roleOptions.map((name) => (
                      <option key={name} value={name}>
                        {name.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: 'remove',
                header: '',
                render: (r) => (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkRows.length === 1}
                    onClick={() => setBulkRows((prev) => prev.filter((row) => row.id !== r.id))}
                    title="Remove this row"
                    aria-label={`Remove row ${r.id + 1}`}
                  >
                    <X size={14} />
                  </Button>
                ),
              },
            ]}
            rows={bulkRows}
            emptyText="No rows — add one to begin."
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={bulkRows.length >= MAX_BULK_ROWS}
              onClick={() => setBulkRows((prev) => [...prev, blankRow(prev.length)])}
            >
              <Plus size={16} /> Add row
            </Button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {bulkRows.length} row{bulkRows.length === 1 ? '' : 's'} in this batch
            </span>
          </div>

          {bulkRows.length > BULK_CHUNK && (
            <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-2 text-xs text-yellow-800 dark:text-yellow-200">
              Large batches can be slow to save. Splitting into groups of about {BULK_CHUNK} is
              recommended.
            </p>
          )}

          {bulkError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{bulkError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitBulk}
              disabled={bulkMutation.isPending || bulkRows.length === 0}
            >
              {bulkMutation.isPending
                ? 'Creating…'
                : `Create ${bulkRows.length} account${bulkRows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        title={t('common.edit')}
        onClose={() => setEditTarget(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editForm.name.trim()) {
              setEditError('This account: name is required.');
              return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) {
              setEditError('This account: a valid email address is required.');
              return;
            }
            if (editForm.roles.length === 0) {
              if (
                !window.confirm(
                  `Remove every role from ${editForm.name.trim() || 'this account'}? They will keep the account but lose all department access.`,
                )
              ) {
                return;
              }
            }
            setEditError('');
            editMutation.mutate();
          }}
        >
          <Input
            label={t('users.fullName')}
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
          <Input
            label={t('common.email')}
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            required
          />
          <Input
            label={`${t('common.phone')} (${t('common.optional')})`}
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Roles (uncheck all to strip every department)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roleOptions.map((name) => (
                <label
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm capitalize text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                    checked={editForm.roles.includes(name)}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        roles: toggleRole(prev.roles, name, e.target.checked),
                      }))
                    }
                  />
                  {name.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </fieldset>
          {editError && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{editError}</p>}
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

      <Modal
        open={Boolean(resetTarget)}
        title={`Reset password — ${resetTarget?.name ?? ''}`}
        onClose={() => setResetTarget(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!resetTarget) return;
            if (resetValue.length < 8) {
              setResetError('The new password must be at least 8 characters.');
              return;
            }
            setResetError('');
            resetMutation.mutate({ id: resetTarget.id, password: resetValue });
          }}
        >
          <Input
            label={t('users.newPassword')}
            type="password"
            value={resetValue}
            onChange={(e) => setResetValue(e.target.value)}
            autoComplete="new-password"
            required
          />
          {resetError && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-700 dark:text-red-300">{resetError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? 'Resetting…' : 'Reset password'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
