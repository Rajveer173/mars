import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, useAiStatus } from '@/app/Shell';
import { api } from '@/lib/api';
import { isAdminRole, useAuth } from '@/lib/auth';
import { formatMs, formatNumber, percent, plural, relative } from '@/lib/format';
import type { Overview } from '@/lib/types';
import { Histogram, TrendLine } from '@/ui/charts';
import { ErrorNote, Figure, FigureRow, LinkButton, SectionTitle, Select, Skeleton } from '@/ui/core';

export interface RunSummary {
  total: number;
  averageLatencyMs: number | null;
  promptTokens: number;
  completionTokens: number;
  byStatus: Record<string, number>;
  byGrounding: Record<string, number>;
  byKind: Record<string, number>;
}

interface AdminStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalProctors: number;
  totalCourses: number;
  totalTests: number;
  publishedTests: number;
  totalQuestions: number;
  totalAttempts: number;
  totalAssignments: number;
  totalCodingProblems: number;
}

const delta = (value: number, unit = '') =>
  value === 0 ? 'no change on the previous period' : `${value > 0 ? 'up' : 'down'} ${Math.abs(value)}${unit} on the previous period`;

/** The share of checked answers the Verifier passed outright. */
export const verifiedShare = (summary: RunSummary | undefined) => {
  const checked = Object.values(summary?.byGrounding ?? {}).reduce((n, v) => n + v, 0);
  return checked ? Math.round(((summary!.byGrounding.grounded ?? 0) / checked) * 100) : null;
};

export function StaffOverview() {
  const user = useAuth((state) => state.user)!;
  const admin = isAdminRole(user.role);
  const [range, setRange] = useState('30d');
  const status = useAiStatus();

  const overview = useQuery({ queryKey: ['analytics', 'overview', range], queryFn: () => api.get<Overview>('/analytics/overview', { range }) });
  const runs = useQuery({ queryKey: ['ai', 'runs', 'summary'], queryFn: () => api.get<{ summary: RunSummary }>('/ai/runs', { limit: 1 }) });
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<AdminStats>('/admin/stats'), enabled: user.role === 'ADMIN' });

  const data = overview.data;
  const agent = runs.data?.summary;
  const verified = verifiedShare(agent);
  const points = (data?.series ?? []).map((p) => ({ label: p.date.slice(5), value: p.attempts ? p.avgScore : null }));

  return (
    <Page>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl text-ink sm:text-4xl">{admin ? 'Institute overview' : 'Your teaching'}</h1>
          <p className="mt-2 text-md text-ink-2">
            {admin ? 'Every test and every agent run across the institute.' : 'How your tests are going, and what the agents have done for you.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Period" className="w-40">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last year</option>
          </Select>
          <LinkButton to="/questions" variant="secondary">
            Draft questions
          </LinkButton>
          <LinkButton to="/tests/new">New test</LinkButton>
        </div>
      </header>

      {overview.isError && <ErrorNote message="The overview could not be loaded." onRetry={() => overview.refetch()} />}

      <FigureRow>
        {data ? (
          <>
            <Figure label="Attempts submitted" value={formatNumber(data.kpis.attempts)} note={delta(data.kpis.deltaAttempts)} />
            <Figure label="Average score" value={percent(data.kpis.avgScore)} note={delta(data.kpis.deltaAvgScore, ' points')} />
            <Figure label="Pass rate" value={percent(data.kpis.passRate)} note={delta(data.kpis.deltaPassRate, ' points')} tone={data.kpis.attempts > 0 && data.kpis.passRate < 50 ? 'red' : undefined} />
            <Figure label="Students who sat a test" value={formatNumber(data.kpis.activeStudents)} note={`${plural(data.kpis.publishedTests, 'test')} published`} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)
        )}
      </FigureRow>

      <div className="mt-12 grid gap-x-14 gap-y-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-12">
          <section>
            <SectionTitle aside="average score on each day with attempts">Scores over the period</SectionTitle>
            {data ? <TrendLine points={points} mark={40} /> : <Skeleton className="h-40" />}
          </section>
          <section>
            <SectionTitle aside={<Link to="/tests" className="text-pen hover:underline">All tests</Link>}>Most attempted tests</SectionTitle>
            {data?.topTests.length ? (
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr className="border-b-[1.5px] border-ink text-left text-sm text-ink-2">
                    <th className="pb-2 font-medium">Test</th>
                    <th className="pb-2 text-right font-medium">Attempts</th>
                    <th className="pb-2 text-right font-medium">Average</th>
                    <th className="pb-2 text-right font-medium">Passed</th>
                  </tr>
                </thead>
                <tbody className="nums">
                  {data.topTests.map((test) => (
                    <tr key={test.id} className="border-b border-rule-2">
                      <td className="py-2.5 pr-4">
                        <Link to={`/tests/${test.id}`} className="font-medium text-ink hover:text-pen">
                          {test.title}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right">{test.attempts}</td>
                      <td className="py-2.5 text-right">{percent(test.avgScore)}</td>
                      <td className={`py-2.5 text-right ${test.passRate < 50 ? 'text-red' : ''}`}>{percent(test.passRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="border-t-[1.5px] border-ink py-4 text-base text-ink-2">No attempts in this period.</p>
            )}
          </section>
          <section>
            <SectionTitle>Score distribution</SectionTitle>
            {data ? <Histogram buckets={data.scoreDistribution.map((b) => ({ label: b.bucket, count: b.count }))} highlightFrom={4} /> : <Skeleton className="h-36" />}
          </section>
        </div>

        <div className="space-y-12">
          <section>
            <SectionTitle aside={<Link to="/runs" className="text-pen hover:underline">All runs</Link>}>Agents</SectionTitle>
            <dl className="border-t-[1.5px] border-ink text-base">
              {[
                ['Runs', agent ? formatNumber(agent.total) : ''],
                ['Answers verified outright', verified == null ? 'No checked answers yet' : `${verified}%`],
                ['Average run time', agent?.averageLatencyMs ? formatMs(agent.averageLatencyMs) : 'No runs yet'],
                ['Tokens used', agent ? formatNumber(agent.promptTokens + agent.completionTokens) : ''],
                ['Passages indexed', formatNumber(status.data?.knowledge.chunks)],
                ['Model', status.data ? (status.data.chat.connected ? status.data.chat.model : 'Not connected') : ''],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-rule-2 py-2.5">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="nums max-w-[60%] truncate text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {stats.data && (
            <section>
              <SectionTitle>On the platform</SectionTitle>
              <dl className="grid grid-cols-2 gap-x-8 border-t-[1.5px] border-ink text-base">
                {[
                  ['Students', stats.data.totalStudents],
                  ['Teachers', stats.data.totalTeachers],
                  ['Courses', stats.data.totalCourses],
                  ['Tests', stats.data.totalTests],
                  ['Questions', stats.data.totalQuestions],
                  ['Attempts', stats.data.totalAttempts],
                  ['Assignments', stats.data.totalAssignments],
                  ['Coding problems', stats.data.totalCodingProblems],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-rule-2 py-2.5">
                    <dt className="text-ink-2">{label}</dt>
                    <dd className="nums font-medium text-ink">{formatNumber(value as number)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section>
            <SectionTitle>Latest activity</SectionTitle>
            {data?.recentActivity.length ? (
              <ul className="border-t-[1.5px] border-ink">
                {data.recentActivity.slice(0, 9).map((item) => (
                  <li key={item.id} className="border-b border-rule-2 py-2.5 text-base">
                    <span className="text-ink">{item.message}</span>
                    <span className="ml-2 whitespace-nowrap text-sm text-ink-3">{relative(item.at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t-[1.5px] border-ink py-4 text-base text-ink-2">Nothing has happened in this period.</p>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}
