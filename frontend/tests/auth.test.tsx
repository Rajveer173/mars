import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api, ApiError } from '../src/lib/api';
import { useAuth, type SessionUser } from '../src/lib/auth';
import { SignIn } from '../src/pages/auth/SignIn';
import { ActionForm } from '../src/ui/forms';

beforeEach(() => useAuth.setState({ user: null, accessToken: null, ready: true }));

describe('session restoration', () => {
  it('finishes even when local storage is corrupt', async () => {
    useAuth.setState({ ready: false });
    localStorage.setItem('mars-session', '{corrupt');
    await useAuth.persist.rehydrate();
    await waitFor(() => expect(useAuth.getState().ready).toBe(true));
  });
});

describe('sign in', () => {
  const form = () => render(<MemoryRouter initialEntries={['/sign-in']}><Routes><Route path="/sign-in" element={<SignIn />} /><Route path="/home" element={<h1>Student workspace</h1>} /></Routes></MemoryRouter>);
  it('opens the correct dashboard after successful authentication', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ accessToken: 'test-token', user: { id: 'student', email: 'student@example.test', role: 'STUDENT' } as SessionUser });
    form();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'student@example.test');
    await user.type(screen.getByLabelText('Password'), 'Example#2026');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Student workspace' })).toBeTruthy();
  });
  it('shows an actionable server error instead of silently failing', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError('Origin not allowed', 403, 'ORIGIN_BLOCKED'));
    form();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'student@example.test');
    await user.type(screen.getByLabelText('Password'), 'Example#2026');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect((await screen.findByRole('alert')).textContent).toContain('Origin not allowed');
    expect(useAuth.getState().user).toBeNull();
  });
  it('requests the authenticator code when required', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new ApiError('Code required', 401, 'TWO_FACTOR_REQUIRED'));
    form();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'student@example.test');
    await user.type(screen.getByLabelText('Password'), 'Example#2026');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(await screen.findByLabelText('Two-factor code')).toBeTruthy();
  });
});

it('keeps a failed form editable and supports retry without losing input', async () => {
  const submit = vi.fn().mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue(undefined);
  render(<ActionForm fields={[{ name: 'title', label: 'Title', required: true }]} onSubmit={submit} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Title'), 'My assignment');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Save failed');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit).toHaveBeenLastCalledWith({ title: 'My assignment' });
});
