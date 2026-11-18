import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { cn, formatDateTime, formatDuration, marks, percent, plural, titleCase } from '@/lib/format';
import type { TestStatus } from '@/lib/types';
import { QuestionPaper, type Question } from '@/pages/questions/shared';
import { Histogram } from '@/ui/charts';
import { Button, Checkbox, DataTable, ErrorNote, Figure, FigureRow, Input, PageHeader, SectionTitle, Spinner, Status, Tabs, type Column } from '@/ui/core';
import { ConfirmDialog, Dialog, toast } from '@/ui/overlay';
import { TEST_STATUS, windowText } from './StaffTests';

interface TestFull {
  id: string;
  title: string;
  description: string | null;
  status: TestStatus;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  negativeMarks: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  randomOptionOrder: boolean;
  showResultImmediately: boolean;
  startAt: string | null;
  endAt: string | null;
  examMode: string | null;
  course: { id: string; name: string; code: string } | null;
  questions: Question[];
  assignments: {
    id: string;
    student: { id: string; fullName: string | null; email: string } | null;
    class: { id: string; name: string; _count: { students: number } } | null;
  }[];
}

interface TestAnalytics {
  summary: {
    attempts: number;
    avgPercentage: number;
    passRate: number;
    avgDurationSec: number;
    highest: number;
    lowest: number;
    median: number;
    inProgress: number;
  };
  scoreDistribution: { bucket: string; count: number }[];
  questionStats: {
    questionId: string;
    text: string;
    attempts: number;
    correctRate: number;
    difficultyIndex: number;
    discrimination: number;
    avgTimeSec: number;
  }[];
}

interface ClassBatch {
  id: string;
  name: string;
  course: { code: string };
  _count: { students: number };
}

/** Assign to whole classes, to named students, or both. */
function Assign({ test, onDone }: { test: TestFull; onDone: () => void }) {
  const queryClient = useQueryClient();
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get<{ classBatches?: ClassBatch[]; batches?: ClassBatch[] } | ClassBatch[]>('/class-batches') });
  const [search, setSearch] = useState('');
  const students = useQuery({
    queryKey: ['students', 'assignable', search],
    queryFn: () => api.get<{ students: { id: string; fullName: string | null; email: string }[] }>('/tests/students/list', search ? { search } : undefined),
  });
  const [classIds, setClassIds] = useState<Set<string>>(new Set());
  const [studentIds, setStudentIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const raw = classes.data;
  const classList = Array.isArray(raw) ? raw : (raw?.classBatches ?? raw?.batches ?? []);
  const already = new Set(test.assignments.flatMap((a) => [a.class?.id, a.student?.id]).filter(Boolean));
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/tests/${test.id}/assign`, { classIds: [...classIds], studentIds: [...studentIds] });
      await queryClient.invalidateQueries({ queryKey: ['test', test.id] });
      toast.done('Assigned. Students have been notified.');
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-medium text-ink">Classes</h3>
        {classList.length ? (
          <ul className="space-y-2">
            {classList.map((item) => (
              <li key={item.id}>
                <Checkbox
                  checked={classIds.has(item.id) || already.has(item.id)}
                  disabled={already.has(item.id)}
                  onChange={() => setClassIds((s) => toggle(s, item.id))}
                  label={
                    <span>
                      {item.name}
                      <span className="ml-2 text-sm text-ink-3">
                        {item.course?.code}, {plural(item._count.students, 'student')}
                        {already.has(item.id) && ', already assigned'}
                      </span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-ink-2">No classes yet. Create one under Classes, or pick students below.</p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-ink">Individual students</h3>
        <Input type="search" placeholder="Find a student by name or email" aria-label="Find a student" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
          {students.data?.students.map((student) => (
            <li key={student.id}>
              <Checkbox
                checked={studentIds.has(student.id) || already.has(student.id)}
                disabled={already.has(student.id)}
                onChange={() => setStudentIds((s) => toggle(s, student.id))}
                label={
                  <span>
                    {student.fullName ?? student.email}
                    <span className="ml-2 text-sm text-ink-3">{student.email}</span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} loading={busy} disabled={classIds.size + studentIds.size === 0}>
          Assign test
        </Button>
      </div>
    </div>
  );
}

function ItemAnalysis({ testId, passPercent }: { testId: string; passPercent: number }) {
  const analytics = useQuery({ queryKey: ['analytics', 'test', testId], queryFn: () => api.get<TestAnalytics>(`/analytics/tests/${testId}`) });
  if (analytics.isLoading) return <Spinner />;
  if (!analytics.data) return <ErrorNote message={errorMessage(analytics.error)} />;
  const { summary, scoreDistribution, questionStats } = analytics.data;
  if (!summary.attempts) return <p className="py-6 text-base text-ink-2">No one has submitted this test yet. Item analysis appears after the first attempts.</p>;

  type Row = TestAnalytics['questionStats'][number] & { number: number };
  const columns: Column<Row>[] = [
    { key: 'n', header: '#', cell: (row) => <span className="nums text-ink-3">{row.number}</span> },
    { key: 'text', header: 'Question', className: 'max-w-md', cell: (row) => <span className="line-clamp-2 font-serif text-[0.9375rem] leading-snug">{row.text}</span> },
    {
      key: 'right',
      header: 'Answered right',
      align: 'right',
      cell: (row) => <span className={cn('font-semibold', row.difficultyIndex < 0.3 && 'text-red')}>{percent(row.difficultyIndex * 100)}</span>,
    },
    {
      key: 'disc',
      header: 'Discrimination',
      align: 'right',
      cell: (row) => <span className={cn(row.discrimination < 0.15 && 'text-red')}>{row.discrimination.toFixed(2)}</span>,
    },
    { key: 'time', header: 'Average time', align: 'right', cell: (row) => formatDuration(row.avgTimeSec) },
  ];
  const weak = questionStats.filter((q) => q.discrimination < 0.15).length;

  return (
    <div className="space-y-12 pt-6">
      <FigureRow>
        <Figure label="Attempts" value={summary.attempts} note={summary.inProgress ? `${summary.inProgress} still in progress` : 'all submitted'} />
        <Figure label="Average score" value={percent(summary.avgPercentage)} note={`median ${percent(summary.median)}`} />
        <Figure label="Pass rate" value={percent(summary.passRate)} tone={summary.passRate < 50 ? 'red' : undefined} />
        <Figure label="Range" value={`${Math.round(summary.lowest)} to ${Math.round(summary.highest)}`} note={`average time ${formatDuration(summary.avgDurationSec)}`} />
      </FigureRow>
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div>
          <SectionTitle>Score distribution</SectionTitle>
          <Histogram buckets={scoreDistribution.map((b) => ({ label: b.bucket, count: b.count }))} highlightFrom={Math.floor(passPercent / 10)} />
          <p className="mt-3 text-sm text-ink-3">Candidates per ten-point band. Bands below the pass mark are red.</p>
        </div>
        <div className="min-w-0">
          <SectionTitle aside={weak ? `${plural(weak, 'question')} to review` : undefined}>Item analysis</SectionTitle>
          <DataTable columns={columns} rows={questionStats.map((q, i) => ({ ...q, number: i + 1 }))} rowKey={(row) => row.questionId} />
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
            Discrimination compares the top and bottom 27% of candidates. Below 0.15, strong and weak candidates do
            about equally well on the question, so it is not telling them apart and is worth rewriting.
          </p>
        </div>
      </div>
    </div>
  );
}

type Tab = 'paper' | 'analysis';

export function TestDetail() {
  const { testId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('paper');
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const test = useQuery({ queryKey: ['test', testId], queryFn: () => api.get<{ test: TestFull }>(`/tests/${testId}`) });
  if (test.isLoading) return <Page><Spinner /></Page>;
  if (test.isError || !test.data) return <Page><ErrorNote message={errorMessage(test.error)} /></Page>;
  const data = test.data.test;

  const change = async (action: 'publish' | 'unpublish' | 'close', done: string) => {
    setBusy(true);
    try {
      await api.post(`/tests/${data.id}/${action}`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['test', data.id] }), queryClient.invalidateQueries({ queryKey: ['tests'] })]);
      toast.done(done);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/tests/${data.id}`);
      await queryClient.invalidateQueries({ queryKey: ['tests'] });
      toast.done('Test deleted');
      navigate('/tests');
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  };

  const classes = data.assignments.filter((a) => a.class);
  const individuals = data.assignments.filter((a) => a.student);
  const reach = classes.reduce((n, a) => n + a.class!._count.students, 0) + individuals.length;
  const settings: [string, string][] = [
    ['Kind', titleCase(data.examMode ?? 'Test')],
    ['Time allowed', `${data.durationMinutes} minutes`],
    ['Marks', `${marks(data.totalMarks)}, pass at ${marks(data.passingMarks)}`],
    ['Wrong answers', data.negativeMarks > 0 ? `${marks(data.negativeMarks)} marks off each` : 'No penalty'],
    ['Attempts', `${data.maxAttempts} per student`],
    ['Opens', data.startAt ? formatDateTime(data.startAt) : 'On publish'],
    ['Closes', data.endAt ? formatDateTime(data.endAt) : 'Never'],
    ['Order', [data.shuffleQuestions && 'questions shuffled', data.randomOptionOrder && 'options shuffled'].filter(Boolean).join(', ') || 'Fixed'],
    ['Result', data.showResultImmediately ? 'Shown on submit' : 'Held until released'],
  ];

  return (
    <Page>
      <PageHeader
        back={{ to: '/tests', label: 'All tests' }}
        title={data.title}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Status tone={TEST_STATUS[data.status].tone}>{TEST_STATUS[data.status].label}</Status>
            <span>{windowText(data)}</span>
            {data.course && <Link to={`/courses/${data.course.id}`} className="text-pen hover:underline">{data.course.code} {data.course.name}</Link>}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setAssigning(true)}>
              Assign
            </Button>
            {data.status === 'DRAFT' && (
              <Button loading={busy} disabled={!data.questions.length} onClick={() => change('publish', 'Published')}>
                Publish
              </Button>
            )}
            {data.status === 'PUBLISHED' && (
              <>
                <Button variant="secondary" loading={busy} onClick={() => change('unpublish', 'Moved back to draft')}>
                  Unpublish
                </Button>
                <Button loading={busy} onClick={() => change('close', 'Closed')}>
                  Close test
                </Button>
              </>
            )}
            <Button variant="ghost" className="text-red hover:text-red" onClick={() => setDeleting(true)}>
              Delete
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'paper', label: 'Paper', count: data.questions.length },
          { value: 'analysis', label: 'Results and item analysis' },
        ]}
      />

      {tab === 'analysis' ? (
        <ItemAnalysis testId={data.id} passPercent={data.totalMarks ? (data.passingMarks / data.totalMarks) * 100 : 40} />
      ) : (
        <div className="grid gap-x-14 gap-y-10 pt-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="min-w-0">
            {data.description && <p className="mb-6 max-w-measure text-md leading-relaxed text-ink-2">{data.description}</p>}
            {data.questions.length ? (
              <ol className="border-t-[1.5px] border-ink">
                {data.questions.map((question, index) => (
                  <li key={question.id} className="border-b border-rule py-5">
                    <QuestionPaper question={question} number={index + 1} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="border-t-[1.5px] border-ink py-4 text-base text-ink-2">This test has no questions, so it cannot be published.</p>
            )}
          </section>
          <aside className="space-y-10">
            <dl>
              {settings.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-rule-2 py-2 text-base">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="text-right text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="text-base font-semibold text-ink">Assigned to</h3>
              {data.assignments.length ? (
                <>
                  <p className="mt-1 text-base text-ink-2">{plural(reach, 'student')} can sit this test.</p>
                  <ul className="mt-2 space-y-1 text-base text-ink">
                    {classes.map((a) => (
                      <li key={a.id}>
                        {a.class!.name} <span className="text-ink-3">({a.class!._count.students})</span>
                      </li>
                    ))}
                    {individuals.slice(0, 6).map((a) => (
                      <li key={a.id}>{a.student!.fullName ?? a.student!.email}</li>
                    ))}
                    {individuals.length > 6 && <li className="text-ink-3">and {individuals.length - 6} more students</li>}
                  </ul>
                </>
              ) : (
                <p className="mt-1 text-base text-ink-2">No one yet. Students only see a published test that is assigned to them.</p>
              )}
            </div>
          </aside>
        </div>
      )}

      <Dialog open={assigning} onOpenChange={setAssigning} title="Assign this test" description="Assigned students are notified and see the test once it is published.">
        <Assign test={data} onDone={() => setAssigning(false)} />
      </Dialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Delete this test?" confirmLabel="Delete test" onConfirm={remove} busy={busy} danger>
        The test, its assignments and every attempt on it are deleted. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}
