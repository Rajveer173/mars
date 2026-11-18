import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu as MenuIcon, Search, Settings, UserRound, X } from 'lucide-react';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { ROLE_HOME, ROLE_LABEL, useAuth, type Role } from '@/lib/auth';
import { cn } from '@/lib/format';
import { Avatar, IconButton, Spinner } from '@/ui/core';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/ui/overlay';
import { APP, Brand } from './Brand';
import { NAV } from './nav';

export interface AiStatus {
  chat: { connected: boolean; model: string; host: string | null };
  embeddings: { connected: boolean; model: string | null; host: string | null };
  verify: boolean;
  knowledge: { documents: number; chunks: number; embeddedChunks: number; coursesCovered: number };
}

export const useAiStatus = () =>
  useQuery({ queryKey: ['ai', 'status'], queryFn: () => api.get<AiStatus>('/ai/status'), staleTime: 60_000 });

/** Whether a model is connected, in the one place every agent screen can see it. */
function ModelStatus() {
  const { data } = useAiStatus();
  if (!data) return null;
  const { chat, embeddings } = data;
  return (
    <div className="border-t border-rule px-4 py-3 text-xs leading-relaxed">
      <div className="flex items-center gap-1.5 font-medium text-ink">
        <span className={cn('size-1.5 rounded-full', chat.connected ? 'bg-tick' : 'bg-red')} aria-hidden />
        {chat.connected ? 'Model connected' : 'No model connected'}
      </div>
      <div className="mt-0.5 truncate text-ink-3" title={chat.model}>
        {chat.connected ? chat.model : 'Set LLM_API_KEY to turn the agents on'}
      </div>
      <div className="text-ink-3">{embeddings.connected ? 'Hybrid retrieval' : 'Keyword retrieval'}</div>
    </div>
  );
}

function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-paper">
      <Link to={ROLE_HOME[role]} onClick={onNavigate} className="flex h-14 shrink-0 items-center px-4">
        <Brand />
      </Link>
      <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-2" aria-label="Main">
        {NAV[role].map((group) => (
          <div key={group.label} className="mb-5">
            <div className="px-2 pb-1 text-xs font-medium text-ink-3">{group.label}</div>
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex h-8 items-center gap-2.5 rounded-md px-2 text-base transition-colors',
                        isActive ? 'font-semibold text-ink' : 'text-ink-2 hover:bg-desk hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn('size-4 shrink-0', isActive ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2')} aria-hidden />
                        {/* The highlighter marks where you are. */}
                        <span className={cn(isActive && 'hl')}>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <ModelStatus />
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const user = useAuth((state) => state.user)!;
  const clear = useAuth((state) => state.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });

  const search = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const signOut = async () => {
    // A failed call still ends the session here: a stranded token helps no one.
    await api.post('/auth/logout').catch(() => undefined);
    clear();
    queryClient.clear();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-rule bg-paper/95 px-4 backdrop-blur-sm sm:px-6">
      <IconButton label="Open navigation" className="lg:hidden" onClick={onMenu}>
        <MenuIcon className="size-5" />
      </IconButton>
      <form onSubmit={search} role="search" className="relative hidden max-w-sm flex-1 sm:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search courses, tests and questions"
          aria-label="Search"
          className="h-8 w-full rounded-md border border-transparent bg-desk pl-8 pr-3 text-base text-pen-deep placeholder:text-ink-3 focus:border-pen focus:bg-paper focus:outline-none"
        />
      </form>
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-2 hidden text-sm text-ink-3 xl:inline">{APP.institute}</span>
        <Link
          to="/notifications"
          aria-label={unread?.unreadCount ? `Notifications, ${unread.unreadCount} unread` : 'Notifications'}
          className="relative inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-desk hover:text-ink"
        >
          <Bell className="size-[1.125rem]" />
          {!!unread?.unreadCount && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red ring-2 ring-paper" />}
        </Link>
        <Menu>
          <MenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-desk" aria-label="Account menu">
              <Avatar name={user.fullName ?? user.email} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-40 truncate text-sm font-semibold text-ink">{user.fullName ?? user.username}</span>
                <span className="block text-xs text-ink-3">{ROLE_LABEL[user.role]}</span>
              </span>
            </button>
          </MenuTrigger>
          <MenuContent>
            <div className="px-2.5 py-1.5 text-sm text-ink-3">{user.email}</div>
            <MenuSeparator />
            <MenuItem onSelect={() => navigate('/profile')}>
              <UserRound className="size-4 text-ink-3" /> Profile
            </MenuItem>
            <MenuItem onSelect={() => navigate('/settings')}>
              <Settings className="size-4 text-ink-3" /> Security and sessions
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={signOut}>
              <LogOut className="size-4 text-ink-3" /> Sign out
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}

/** The signed-in frame: navigation on the left, the page on the right. */
export function Shell() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [location.pathname]);

  if (!ready) return <Spinner label="Restoring your session" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;

  return (
    <div className="min-h-dvh lg:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-rule lg:block">
        <Sidebar role={user.role} />
      </aside>

      <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/35 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-64 shadow-float focus:outline-none lg:hidden" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <Sidebar role={user.role} onNavigate={() => setDrawer(false)} />
            <DialogPrimitive.Close asChild>
              <IconButton label="Close navigation" className="absolute right-2 top-3">
                <X className="size-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <TopBar onMenu={() => setDrawer(true)} />
      <main id="main">
        <Suspense fallback={<div className="px-6"><Spinner /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

/** Standard page gutter and width. Full-bleed screens (Ask, the exam) skip it. */
export function Page({ children, narrow, className }: { children: React.ReactNode; narrow?: boolean; className?: string }) {
  return <div className={cn('mx-auto w-full px-4 pb-20 pt-8 sm:px-6 lg:px-10', narrow ? 'max-w-4xl' : 'max-w-page', className)}>{children}</div>;
}

/** Renders its children only for the listed roles; anyone else goes to their own home. */
export function Only({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = useAuth((state) => state.user);
  if (!user) return null;
  return roles.includes(user.role) ? <>{children}</> : <Navigate to={ROLE_HOME[user.role]} replace />;
}
