import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { useAuth, type SessionUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { Avatar, Button, Empty, PageHeader, SectionTitle, Tag } from '@/ui/core';
import { ActionForm, QueryState } from '@/ui/forms';
import { ConfirmDialog, toast } from '@/ui/overlay';

export function Profile() {
  const { user, patchUser } = useAuth();
  return <Page narrow><PageHeader title="Your profile" description="The details your institute sees." />
    <div className="mb-8 flex items-center gap-4"><Avatar name={user?.fullName} size="lg" /><div><p className="font-semibold">{user?.email}</p><Tag>{user?.isEmailVerified ? 'Email verified' : 'Email not verified'}</Tag></div></div>
    <ActionForm fields={[{ name: 'fullName', label: 'Full name', required: true }]} initial={{ fullName: user?.fullName ?? '', username: user?.username ?? '' }} onSubmit={async values => { const result = await api.patch<{ user: SessionUser }>('/users/me', values); patchUser(result.user); toast.done('Profile updated'); }} />
    {!user?.isEmailVerified && <div className="mt-10"><ActionForm fields={[]} submitLabel="Send verification email" onSubmit={async () => { await api.post('/auth/resend-verification', { email: user?.email }); toast.done('Verification email requested'); }} /></div>}
  </Page>;
}

interface Session { id: string; device: string; ipAddress: string | null; createdAt: string; current: boolean }
export function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, patchUser, clear } = useAuth();
  const sessions = useQuery({ queryKey: ['account', 'sessions'], queryFn: () => api.get<Session[]>('/auth/sessions') });
  const [removing, setRemoving] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  return <Page narrow><PageHeader title="Security and sessions" description="Keep your account protected and review where you are signed in." />
    <SectionTitle>Password</SectionTitle><ActionForm fields={[{ name: 'currentPassword', label: 'Current password', type: 'password', required: true }, { name: 'newPassword', label: 'New password', type: 'password', required: true, hint: '10+ characters with uppercase, lowercase, a number and a symbol.' }]} submitLabel="Change password" onSubmit={async values => { await api.post('/auth/change-password', values); clear(); queryClient.clear(); navigate('/sign-in'); toast.done('Password changed. Sign in again.'); }} />
    <section className="mt-10 border-t border-rule pt-6"><SectionTitle>Two-factor authentication</SectionTitle>
      <p className="mb-4 text-ink-2">{user?.twoFactorEnabled ? 'Your authenticator adds a second layer of protection.' : 'Add a code from your authenticator when signing in.'}</p>
      {setup ? <><p className="mb-3 text-ink-2">Add this setup key to your authenticator, then enter the generated code.</p><p className="mb-4 break-all font-mono text-sm">Setup key: {setup.secret}</p><ActionForm fields={[{ name: 'code', label: 'Authenticator code', required: true }]} submitLabel="Verify and enable" onSubmit={async values => { await api.post('/auth/verify-2fa-setup', values); patchUser({ twoFactorEnabled: true }); setSetup(null); toast.done('Two-factor authentication enabled'); }} /></> : <ActionForm key={String(user?.twoFactorEnabled)} fields={[{ name: 'password', label: 'Current password', type: 'password', required: true }, ...(user?.twoFactorEnabled ? [{ name: 'code', label: 'Authenticator code', required: true }] : [])]} submitLabel={user?.twoFactorEnabled ? 'Disable two-factor authentication' : 'Set up authenticator'} onSubmit={async values => { if (user?.twoFactorEnabled) { await api.post('/auth/disable-2fa', values); patchUser({ twoFactorEnabled: false }); toast.done('Two-factor authentication disabled'); } else setSetup(await api.post('/auth/enable-2fa', values)); }} />}
    </section>
    <section className="mt-10 border-t border-rule pt-6"><SectionTitle>Active sessions</SectionTitle><QueryState query={sessions}>{sessions.data?.length === 0 && <Empty title="No active sessions" />}{sessions.data?.map(session => <div key={session.id} className="flex items-center justify-between gap-4 border-b border-rule-2 py-4"><div><p className="font-medium">{session.device || 'Unknown device'} {session.current && <Tag tone="tick">This device</Tag>}</p><p className="mt-1 text-sm text-ink-3">{session.ipAddress ?? 'Unknown address'} · Signed in {formatDateTime(session.createdAt)}</p></div>{!session.current && <Button variant="secondary" onClick={() => setRemoving(session)}>Revoke</Button>}</div>)}</QueryState></section>
    <ConfirmDialog open={!!removing} onOpenChange={() => setRemoving(null)} title="Revoke this session?" confirmLabel="Revoke session" danger busy={busy} onConfirm={async () => { if (!removing) return; setBusy(true); try { await api.delete(`/auth/sessions/${removing.id}`); await queryClient.invalidateQueries({ queryKey: ['account', 'sessions'] }); setRemoving(null); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not revoke session'); } finally { setBusy(false); } }}>This device will need to sign in again.</ConfirmDialog>
  </Page>;
}
