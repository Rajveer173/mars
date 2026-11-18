import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { ROLE_LABEL, useAuth, type Role } from '@/lib/auth';
import { relative } from '@/lib/format';
import type { Paged } from '@/lib/types';
import { Pager } from '@/pages/results/Results';
import { Avatar, Button, DataTable, Empty, ErrorNote, Field, Input, PageHeader, Select, Spinner, Status, type Column } from '@/ui/core';
import { ConfirmDialog, Dialog, Menu, MenuContent, MenuItem, MenuTrigger, toast } from '@/ui/overlay';

interface Person {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  role: Role;
  isActive: boolean;
  isBlocked: boolean;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLES: Role[] = ['STUDENT', 'TEACHER', 'PROCTOR', 'ADMIN'];

function NewPerson({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', role: 'STUDENT' as Role });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/users', { ...form, fullName: form.fullName.trim() || undefined, email: form.email.trim() });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.done('Account created');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <ErrorNote message={error} />}
      <Field label="Full name" htmlFor="p-name">
        <Input id="p-name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="p-email">
          <Input id="p-email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Username" htmlFor="p-username" hint="Letters, numbers, underscores">
          <Input id="p-username" required pattern="[A-Za-z0-9_]{3,30}" value={form.username} onChange={(e) => set('username', e.target.value)} />
        </Field>
        <Field label="Role" htmlFor="p-role">
          <Select id="p-role" value={form.role} onChange={(e) => set('role', e.target.value)}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Temporary password" htmlFor="p-password" hint="At least 10 characters. They change it after signing in.">
          <Input id="p-password" type="text" required minLength={10} value={form.password} onChange={(e) => set('password', e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Create account
        </Button>
      </div>
    </form>
  );
}

export function People() {
  const me = useAuth((state) => state.user)!;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Person | null>(null);
  const [busy, setBusy] = useState(false);

  const people = useQuery({
    queryKey: ['users', page, role, search],
    queryFn: () => api.get<Paged<Person>>('/users', { page, limit: 20, ...(role ? { role } : {}), ...(search ? { search } : {}) }),
    placeholderData: keepPreviousData,
  });

  const update = async (person: Person, patch: Partial<Pick<Person, 'role' | 'isBlocked'>>, done: string) => {
    try {
      await api.patch(`/users/${person.id}`, patch);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.done(done);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/users/${removing.id}`);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.done('Account deleted');
      setRemoving(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Person>[] = [
    {
      key: 'name',
      header: 'Person',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName ?? row.email} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{row.fullName ?? row.username}</div>
            <div className="truncate text-sm text-ink-3">{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (row) => ROLE_LABEL[row.role] },
    {
      key: 'state',
      header: 'Account',
      cell: (row) =>
        row.isBlocked ? <Status tone="red">Blocked</Status> : !row.isActive ? <Status>Inactive</Status> : <Status tone="tick">Active</Status>,
    },
    { key: '2fa', header: 'Two-factor', cell: (row) => <span className="text-ink-2">{row.twoFactorEnabled ? 'On' : 'Off'}</span> },
    { key: 'seen', header: 'Last sign-in', cell: (row) => <span className="text-ink-2">{row.lastLoginAt ? relative(row.lastLoginAt) : 'Never'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (row) =>
        row.id === me.id ? (
          <span className="text-sm text-ink-3">You</span>
        ) : (
          <Menu>
            <MenuTrigger asChild>
              <button className="rounded px-2 py-1 text-base font-medium text-pen hover:bg-pen-wash">Manage</button>
            </MenuTrigger>
            <MenuContent>
              {ROLES.filter((r) => r !== row.role).map((r) => (
                <MenuItem key={r} onSelect={() => update(row, { role: r }, `Role changed to ${ROLE_LABEL[r]}`)}>
                  Make {ROLE_LABEL[r].toLowerCase()}
                </MenuItem>
              ))}
              <MenuItem onSelect={() => update(row, { isBlocked: !row.isBlocked }, row.isBlocked ? 'Account unblocked' : 'Account blocked')}>
                {row.isBlocked ? 'Unblock' : 'Block sign-in'}
              </MenuItem>
              <MenuItem danger onSelect={() => setRemoving(row)}>
                Delete account
              </MenuItem>
            </MenuContent>
          </Menu>
        ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="People"
        description="Every account at the institute. Students can register themselves. Staff accounts are created here."
        actions={<Button onClick={() => setCreating(true)}>New account</Button>}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Input
          type="search"
          placeholder="Find by name, email or username"
          aria-label="Find a person"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-80"
        />
        <Select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          aria-label="Role"
          className="w-48"
        >
          <option value="">Every role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <span className="nums ml-auto self-center text-base text-ink-2">{people.data ? `${people.data.meta.total} accounts` : ''}</span>
      </div>
      {people.isLoading ? (
        <Spinner />
      ) : people.isError ? (
        <ErrorNote message="Accounts could not be loaded." onRetry={() => people.refetch()} />
      ) : (
        <>
          <DataTable columns={columns} rows={people.data?.items ?? []} rowKey={(row) => row.id} empty={<Empty title="No account matches" />} />
          <Pager page={page} pages={people.data?.meta.pages ?? 1} onPage={setPage} />
        </>
      )}

      <Dialog open={creating} onOpenChange={setCreating} title="New account">
        <NewPerson onDone={() => setCreating(false)} />
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={() => setRemoving(null)} title="Delete this account?" confirmLabel="Delete account" onConfirm={remove} busy={busy} danger>
        {removing?.fullName ?? removing?.email} loses access, and their attempts, submissions and conversations are deleted with the account.
      </ConfirmDialog>
    </Page>
  );
}
