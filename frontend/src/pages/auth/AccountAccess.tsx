import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { api } from '@/lib/api';
import { ActionForm, type FormField } from '@/ui/forms';
import { AuthFrame } from './SignIn';

const password: FormField = { name: 'newPassword', label: 'New password', type: 'password', required: true, hint: 'At least 10 characters, with uppercase, lowercase, a number and a symbol.' };
const email: FormField = { name: 'email', label: 'Email address', type: 'email', required: true };
const configs = {
  register: { title: 'Start your next chapter.', button: 'Create student account', endpoint: '/auth/register', fields: [
    { name: 'fullName', label: 'Full name', required: true }, email,
    { name: 'username', label: 'Username', required: true, hint: 'Letters, numbers and underscores.' }, { ...password, name: 'password', label: 'Password' },
  ] as FormField[], message: 'Your account is ready. Sign in to start learning.' },
  forgot: { title: 'Reset your password.', button: 'Send reset link', endpoint: '/auth/forgot-password', fields: [email], message: 'If an account matches that email, a password reset link has been sent.' },
  reset: { title: 'A fresh start.', button: 'Set new password', endpoint: '/auth/reset-password', fields: [password], message: 'Password changed. Sign in with your new password.' },
  verify: { title: 'Verify your email.', button: 'Verify email', endpoint: '/auth/verify-email', fields: [] as FormField[], message: 'Your email is verified.' },
};

export function AccountAccess({ mode }: { mode: keyof typeof configs }) {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const config = configs[mode];
  const token = params.get('token');
  const needsToken = mode === 'reset' || mode === 'verify';
  return <AuthFrame aside={<div className="max-w-lg"><p className="text-sm uppercase tracking-widest text-ink-3">Meridian Institute of Technology</p><p className="display mt-6 text-5xl leading-tight">A little more curious.<br />A little more prepared.</p><p className="mt-6 text-md text-ink-2">Your courses, assessments and feedback, together in one thoughtful workspace.</p></div>}>
    <h1 className="display mb-6 text-4xl">{config.title}</h1>
    {done ? <p role="status" className="rounded-lg border border-tick/30 bg-tick-wash p-4">{config.message}</p> : <ActionForm fields={needsToken && !token ? [{ name: 'token', label: 'Link token', required: true, hint: 'Use the token from the link in your email.' }, ...config.fields] : config.fields} submitLabel={config.button} onSubmit={async values => { await api.post(config.endpoint, { ...values, ...(token ? { token } : {}) }); setDone(true); }} />}
    <Link className="mt-6 text-pen hover:underline" to="/sign-in">Back to sign in</Link>
  </AuthFrame>;
}
