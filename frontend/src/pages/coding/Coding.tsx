import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { formatDateTime, titleCase } from '@/lib/format';
import { Button, Empty, Field, PageHeader, SectionTitle, Select, Tag, Textarea } from '@/ui/core';
import { ActionForm, QueryState, options } from '@/ui/forms';
import { Dialog, toast } from '@/ui/overlay';
import { Material } from '@/ui/Material';
import { Pager } from '@/pages/results/Results';

interface Problem { id: string; title: string; description: string; difficulty: string; allowedLanguages: string | string[]; timeLimitMs: number; memoryLimitMB: number; testCases: { id: string; input: string; expectedOutput: string }[]; submissions: { id: string; language: string; status: string; createdAt: string }[] }
interface Execution { status: string; passedCount: number; totalCount: number; error?: string; results: { passed: boolean; expected?: string; actual?: string; runtimeMs: number }[] }
export function Coding() {
  const staff = useAuth(state => isStaffRole(state.user?.role));
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['coding', page], queryFn: () => api.get<{ items: Problem[]; total: number }>('/coding-problems', { page, limit: 20 }) });
  return <Page><PageHeader title="Coding practice" description="Think it through. Write it down. Make it work." actions={staff && <Button onClick={() => setCreating(true)}>Create problem</Button>} /><QueryState query={query}>{!query.data?.items.length && <Empty title="No problems yet" />}
    {query.data?.items.map((problem, index) => <Link key={problem.id} to={`/coding/${problem.id}`} className="group flex items-center gap-5 border-t border-rule py-5"><span className="nums text-sm text-ink-3">{String((page - 1) * 20 + index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><h2 className="display text-xl group-hover:text-pen">{problem.title}</h2><p className="mt-1 text-sm text-ink-3">{problem.timeLimitMs} ms · {problem.memoryLimitMB} MB</p></div><Tag>{titleCase(problem.difficulty)}</Tag></Link>)}
    <Pager page={page} pages={Math.ceil((query.data?.total ?? 0) / 20)} onPage={setPage} />
  </QueryState><Dialog open={creating} onOpenChange={setCreating} title="Create coding problem" size="lg">{creating && <ActionForm fields={[{ name: 'title', label: 'Title', required: true }, { name: 'difficulty', label: 'Difficulty', type: 'select', required: true, options: options(['EASY', 'MEDIUM', 'HARD', 'EXPERT']) }, { name: 'description', label: 'Problem statement', type: 'textarea', required: true }, { name: 'input', label: 'Example input', type: 'textarea' }, { name: 'expectedOutput', label: 'Expected output', type: 'textarea', required: true }]} initial={{ difficulty: 'EASY' }} submitLabel="Create problem" onSubmit={async values => { await api.post('/coding-problems', { title: values.title, description: values.description, difficulty: values.difficulty, allowedLanguages: ['python', 'javascript'], testCases: [{ input: values.input ?? '', expectedOutput: values.expectedOutput, isPublic: true }] }); setCreating(false); await client.invalidateQueries({ queryKey: ['coding'] }); toast.done('Problem created'); }} />}</Dialog></Page>;
}

export function CodingDetail() {
  const { problemId } = useParams();
  const user = useAuth(state => state.user);
  const query = useQuery({ queryKey: ['coding', problemId], queryFn: () => api.get<{ problem: Problem }>(`/coding-problems/${problemId}`) });
  return <Page><QueryState query={query}>{query.data && <Workbench key={`${user?.id}:${problemId}`} problem={query.data.problem} refresh={() => void query.refetch()} />}</QueryState></Page>;
}

function Workbench({ problem, refresh }: { problem: Problem; refresh: () => void }) {
  const languages: string[] = Array.isArray(problem.allowedLanguages) ? problem.allowedLanguages : JSON.parse(problem.allowedLanguages);
  const [language, setLanguage] = useState(languages[0] ?? 'python');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Execution | null>(null);
  const staff = useAuth(state => isStaffRole(state.user?.role));
  const [adding, setAdding] = useState(false);
  async function run() { setBusy(true); setResult(null); try { setResult(await api.post(`/coding-problems/${problem.id}/execute`, { code, language })); refresh(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); } }
  return <><PageHeader title={problem.title} description={`${titleCase(problem.difficulty)} · ${problem.timeLimitMs} ms · ${problem.memoryLimitMB} MB`} back={{ to: '/coding', label: 'Coding practice' }} actions={staff && <Button variant="secondary" onClick={() => setAdding(true)}>Add test case</Button>} />
    <div className="grid gap-10 xl:grid-cols-2"><section><Material>{problem.description}</Material><SectionTitle className="mt-8">Examples</SectionTitle>{problem.testCases?.map((test, index) => <div key={test.id} className="mb-4 rounded-lg border border-rule bg-paper p-4"><h3 className="mb-3 text-sm font-medium">Example {index + 1}</h3><p className="text-xs text-ink-3">Input</p><pre className="my-2 overflow-auto font-mono text-sm">{test.input || '(no input)'}</pre><p className="text-xs text-ink-3">Expected output</p><pre className="mt-2 overflow-auto font-mono text-sm">{test.expectedOutput}</pre></div>)}</section>
      <section><Field label="Language" htmlFor="language"><Select id="language" value={language} onChange={event => setLanguage(event.target.value)}>{languages.map(value => <option key={value} value={value}>{titleCase(value)}</option>)}</Select></Field><Field className="mt-4" label="Your solution" htmlFor="solution" hint="Read from standard input and print your answer to standard output."><Textarea id="solution" rows={18} spellCheck={false} className="font-mono text-sm leading-6" value={code} onChange={event => setCode(event.target.value)} /></Field><Button className="mt-4" loading={busy} disabled={!code.trim()} onClick={() => void run()}>Run and submit</Button>
        {result && <div role="status" className="mt-6 rounded-lg border border-rule p-5"><Tag tone={result.status === 'ACCEPTED' ? 'tick' : 'red'}>{titleCase(result.status)}</Tag><p className="mt-3">{result.passedCount} of {result.totalCount} tests passed</p>{result.error && <p className="mt-2 text-red">{result.error}</p>}{result.results.map((test, index) => <p key={index} className="mt-2 text-sm">Test {index + 1}: {test.passed ? 'Passed' : 'Failed'} · {test.runtimeMs} ms</p>)}</div>}
        <SectionTitle className="mt-10">Recent submissions</SectionTitle>{!problem.submissions?.length && <p className="text-ink-3">Your submitted solutions will appear here.</p>}{problem.submissions?.map(submission => <div key={submission.id} className="flex justify-between gap-3 border-t border-rule py-3 text-sm"><span>{titleCase(submission.status)} · {titleCase(submission.language)}</span><span className="text-ink-3">{formatDateTime(submission.createdAt)}</span></div>)}
      </section></div>
      <Dialog open={adding} onOpenChange={setAdding} title="Add test case">{adding && <ActionForm fields={[{ name: 'input', label: 'Input', type: 'textarea' }, { name: 'expectedOutput', label: 'Expected output', type: 'textarea', required: true }, { name: 'visibility', label: 'Visibility', type: 'select', required: true, options: [{ value: 'public', label: 'Public example' }, { value: 'hidden', label: 'Hidden test' }] }]} initial={{ visibility: 'hidden' }} submitLabel="Add test case" onSubmit={async values => { await api.post(`/coding-problems/${problem.id}/testcases`, { input: values.input, expectedOutput: values.expectedOutput, isPublic: values.visibility === 'public' }); setAdding(false); refresh(); toast.done('Test case added'); }} />}</Dialog>
  </>;
}
