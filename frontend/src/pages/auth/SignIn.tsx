import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP, Brand } from '@/app/Brand';
import { ApiError, api, errorMessage } from '@/lib/api';
import { ROLE_HOME, useAuth, type SessionUser } from '@/lib/auth';
import { Button, ErrorNote, Field, Input } from '@/ui/core';

// Shown only while the demo flag is on; a real deployment sets VITE_DEMO_LOGINS=false.
const DEMO_ENABLED = import.meta.env.VITE_DEMO_LOGINS === 'true' || (import.meta.env.DEV && import.meta.env.VITE_DEMO_LOGINS !== 'false');
const DEMO_PASSWORD = 'Meridian#2026';
const DEMO_ACCOUNTS = [
  {
    role: 'Student',
    email: 'student@meridian.example',
    sees: 'Ask with cited answers, tests on an answer sheet, a debrief after each result.',
  },
  {
    role: 'Teacher',
    email: 'teacher@meridian.example',
    sees: 'Question studio where a second agent reviews every draft, the knowledge base, class analytics.',
  },
  {
    role: 'Administrator',
    email: 'admin@meridian.example',
    sees: 'Every agent run with timing and tokens, people, audit log.',
  },
  {
    role: 'Proctor',
    email: 'proctor@meridian.example',
    sees: 'Live exam sessions and flagged candidates.',
  },
];

export function AuthFrame({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[minmax(0,30rem)_1fr]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link to="/" aria-label={`${APP.short} home`} className="self-start">
          <Brand descriptor />
        </Link>
        <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <div className="hidden border-l border-rule bg-desk lg:flex lg:flex-col lg:justify-center lg:px-14">{aside}</div>
    </div>
  );
}

export function SignIn() {
  const { user, setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const signIn = async (loginEmail: string, loginPassword: string) => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.post<{ accessToken: string; user: SessionUser }>('/auth/login', {
        email: loginEmail.trim(),
        password: loginPassword,
        ...(needsCode && code ? { twoFactorCode: code.trim() } : {}),
      });
      setSession(session.accessToken, session.user);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/' ? from : ROLE_HOME[session.user.role], { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TWO_FACTOR_REQUIRED') {
        setNeedsCode(true);
        setError(null);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void signIn(email, password);
  };

  const demoSignIn = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    void signIn(accountEmail, DEMO_PASSWORD);
  };

  return (
    <AuthFrame
      aside={
        DEMO_ENABLED && (
          <div className="max-w-xl">
            <h2 className="display text-3xl text-ink">Demo accounts</h2>
            <p className="mt-2 text-md text-ink-2">
              Choose a role to sign in straight away. Every account uses the password{' '}
              <code className="font-mono text-base text-ink">{DEMO_PASSWORD}</code>.
            </p>
            <ul className="mt-8 border-t-[1.5px] border-ink">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email} className="border-b border-rule">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => demoSignIn(account.email)}
                    className="group grid w-full grid-cols-[7.5rem_1fr] gap-x-4 py-4 text-left disabled:opacity-60"
                  >
                    <span className="display text-xl text-ink">
                      <span className={email === account.email ? 'hl' : 'group-hover:text-pen'}>{account.role}</span>
                    </span>
                    <span>
                      <span className="block text-base text-ink">{account.sees}</span>
                      <span className="mt-0.5 block text-sm text-ink-3">{account.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    >
      <form onSubmit={submit} className="w-full max-w-sm" noValidate>
        <h1 className="display text-4xl text-ink">Sign in</h1>
        <p className="mt-2 text-md text-ink-2">Use your institute account.</p>

        <div className="mt-8 space-y-4">
          {error && <ErrorNote message={error} />}
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@institute.edu"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {needsCode && (
            <Field label="Two-factor code" htmlFor="code" hint="Enter the 6-digit code from your authenticator app.">
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
          )}
          <Button type="submit" size="lg" loading={busy} disabled={!email || !password} className="w-full">
            Sign in
          </Button>
        </div>

        <div className="mt-6 flex justify-between text-base">
          <Link to="/forgot-password" className="text-pen hover:underline">
            Forgot your password?
          </Link>
          <Link to="/register" className="text-pen hover:underline">
            Create a student account
          </Link>
        </div>

        {DEMO_ENABLED && (
          <div className="mt-8 lg:hidden">
            <p className="text-sm text-ink-3">Demo: sign in as</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => demoSignIn(account.email)}
                >
                  {account.role}
                </Button>
              ))}
            </div>
          </div>
        )}
      </form>
    </AuthFrame>
  );
}
