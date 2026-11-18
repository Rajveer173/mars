import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../src/app/App';
import { api, http } from '../src/lib/api';
import { useAuth, type Role, type SessionUser } from '../src/lib/auth';
import { NAV } from '../src/app/nav';
import { TooltipProvider } from '../src/ui/overlay';

// Optional integration suite: real API + seeded local database, no mock records.
// Only signs in and reads data. Does not submit exams or modify coursework.
describe.skipIf(!process.env.LIVE_API_URL)('live role workspaces', () => {
  afterEach(cleanup);
  for (const role of ['STUDENT', 'TEACHER', 'ADMIN', 'PROCTOR'] as Role[]) {
    it(`renders every navigation destination for ${role}`, async () => {
      http.defaults.baseURL = process.env.LIVE_API_URL;
      http.defaults.adapter = 'fetch';
      const session = await api.post<{ accessToken: string; user: SessionUser }>('/auth/login', { email: `${role.toLowerCase()}@meridian.example`, password: 'Meridian#2026' });
      useAuth.setState({ ...session, ready: true });
      const routes = [...NAV[role].flatMap(group => group.items.map(item => item.to)), '/profile', '/settings', '/notifications', '/search?q=operating'];
      for (const path of routes) {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(<QueryClientProvider client={client}><TooltipProvider><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></TooltipProvider></QueryClientProvider>);
        await waitFor(() => expect(screen.queryByText('Opening your workspace')).toBeNull());
        await waitFor(() => expect(client.isFetching()).toBe(0));
        const errors = client.getQueryCache().getAll().filter(query => query.state.status === 'error').map(query => `${path}: ${String(query.state.error)}`);
        expect(errors).toEqual([]);
        expect(screen.queryByText('There is no page at this address.')).toBeNull();
        expect(screen.queryByText('This page stopped working.')).toBeNull();
        expect(screen.queryByText('Restoring your session')).toBeNull();
        cleanup(); client.clear();
      }
    }, 120_000);
  }
});
