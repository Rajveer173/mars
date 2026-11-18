import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Empty, Input, PageHeader, SectionTitle } from '@/ui/core';
import { QueryState } from '@/ui/forms';

interface Hit { id: string; title?: string; name?: string; text?: string; fullName?: string; email?: string; description?: string; code?: string }
type Group = 'courses' | 'tests' | 'questions' | 'assignments' | 'users' | 'lessons';
type SearchData = Record<Group, Hit[]> & { count: number };
export function Search() {
  const [params, setParams] = useSearchParams();
  const term = params.get('q') ?? '';
  const student = useAuth(state => state.user?.role === 'STUDENT');
  const query = useQuery({ queryKey: ['search', term], queryFn: () => api.get<SearchData>('/search', { q: term }), enabled: !!term.trim() });
  const href = (group: Group, id: string) => group === 'tests' && student ? '/tests' : group === 'questions' || group === 'users' ? `/${group}` : `/${group}/${id}`;
  return <Page><PageHeader title="Search your workspace" description={term ? `Results for “${term}”` : 'Find courses, lessons, tests and coursework.'} /><form className="mb-8" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setParams({ q: String(data.get('q') ?? '') }); }}><Input key={term} name="q" aria-label="Search workspace" defaultValue={term} placeholder="Type a search and press Enter" /></form>{term.trim() ? <QueryState query={query}>
    {query.data?.count === 0 && <Empty title="No matches yet">Try a course name, topic or a shorter search.</Empty>}
    {(['courses', 'lessons', 'tests', 'assignments', 'questions', 'users'] as Group[]).map(group => !!query.data?.[group]?.length && <section key={group} className="mb-8"><SectionTitle>{group[0].toUpperCase() + group.slice(1)}</SectionTitle>{query.data[group].map(hit => <Link key={hit.id} to={href(group, hit.id)} className="block border-t border-rule py-4 hover:text-pen"><h3 className="font-medium">{hit.title ?? hit.name ?? hit.text ?? hit.fullName ?? hit.email}</h3><p className="mt-1 line-clamp-2 text-sm text-ink-3">{hit.description ?? hit.code ?? hit.email}</p></Link>)}</section>)}
  </QueryState> : <Empty title="What would you like to find?" />}</Page>;
}
