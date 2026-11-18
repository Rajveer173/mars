import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, marks, percent, plural, relative } from '@/lib/format';
import type { AssignedTest, StudentAnalytics } from '@/lib/types';
import { BarList } from '@/ui/charts';
import { ErrorNote, Figure, FigureRow, LinkButton, SectionTitle, Skeleton, Tag } from '@/ui/core';

const PASS_MARK = 40;

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

function TestLine({ test }: { test: AssignedTest }) {
  const open = test.canAttempt;
  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule-2 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-md font-semibold text-ink">{test.title}</span>
          {open && test.endAt && Date.parse(test.endAt) - Date.now() < 2 * 86_400_000 && <Tag tone="red">Closes {relative(test.endAt)}</Tag>}
        </div>
        <div className="mt-0.5 text-sm text-ink-2">
          {[
            test.course?.code,
            `${test.durationMinutes} min`,
            plural(test.questionCount, 'question'),
            `${marks(test.totalMarks)} marks`,
          ]
            .filter(Boolean)
            .join(', ')}
        </div>
      </div>
      <div className="text-sm text-ink-2">
        {open
          ? test.endAt
            ? `Open until ${formatDateTime(test.endAt)}`
            : 'Open now'
          : `Opens ${formatDateTime(test.startAt)}`}
      </div>
      {open ? (
        <LinkButton to={`/tests/${test.id}/sit`} size="sm">
          Start test
        </LinkButton>
      ) : (
        <span className="w-[5.25rem]" />
      )}
    </li>
  );
}

export function StudentHome() {
  const user = useAuth((state) => state.user)!;
  const analytics = useQuery({
    queryKey: ['analytics', 'me', '90d'],
    queryFn: () => api.get<StudentAnalytics>('/analytics/me', { range: '90d' }),
  });
  const tests = useQuery({
    queryKey: ['tests', 'assigned'],
    queryFn: () => api.get<{ items: AssignedTest[] }>('/tests/assigned'),
  });

  const pending = (tests.data?.items ?? [])
    .filter((t) => !t.ended && t.attemptsLeft > 0 && t.attemptsUsed === 0)
    .sort((a, b) => Number(b.canAttempt) - Number(a.canAttempt) || Date.parse(a.endAt ?? a.startAt ?? '') - Date.parse(b.endAt ?? b.startAt ?? ''));
  const data = analytics.data;
  const weakest = data?.byCourse.filter((c) => c.avgScore > 0).sort((a, b) => a.avgScore - b.avgScore)[0];

  return (
    <Page>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl text-ink sm:text-4xl">
            {greeting()}, {(user.fullName ?? user.username).split(' ')[0]}.
          </h1>
          <p className="mt-2 text-md text-ink-2">
            {pending.filter((t) => t.canAttempt).length
              ? `${plural(pending.filter((t) => t.canAttempt).length, 'test')} open for you right now.`
              : 'No test is open for you right now.'}
          </p>
        </div>
        <LinkButton to="/ask" variant="secondary">
          Ask your course material
        </LinkButton>
      </header>

      {analytics.isError && <ErrorNote message="Your figures could not be loaded." onRetry={() => analytics.refetch()} />}

      <FigureRow>
        {data ? (
          <>
            <Figure label="Average score" value={percent(data.kpis.avgScore)} note={`across ${plural(data.kpis.attempts, 'test')}`} />
            <Figure
              label="Tests passed"
              value={percent(data.kpis.passRate)}
              tone={data.kpis.attempts > 0 && data.kpis.passRate < 50 ? 'red' : undefined}
            />
            <Figure label="Lessons read" value={data.kpis.lessonsCompleted} note={`in ${plural(data.kpis.coursesEnrolled, 'course')}`} />
            <Figure
              label="Study streak"
              value={plural(data.kpis.streakDays, 'day')}
              note={data.kpis.streakDays ? 'days in a row with a test' : 'sit a test to start one'}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)
        )}
      </FigureRow>

      <div className="mt-12 grid gap-x-14 gap-y-12 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle aside={<Link to="/tests" className="text-pen hover:underline">All tests</Link>}>Tests to sit</SectionTitle>
          {tests.isLoading ? (
            <Skeleton className="h-32" />
          ) : pending.length ? (
            <ul className="border-t-[1.5px] border-ink">
              {pending.slice(0, 5).map((test) => (
                <TestLine key={test.id} test={test} />
              ))}
            </ul>
          ) : (
            <p className="border-t-[1.5px] border-ink py-4 text-base text-ink-2">
              Nothing is waiting. New tests appear here when a teacher assigns them to your class.
            </p>
          )}

          <SectionTitle className="mt-12" aside={<Link to="/results" className="text-pen hover:underline">All results</Link>}>
            Latest results
          </SectionTitle>
          {data?.recentResults.length ? (
            <ul className="border-t-[1.5px] border-ink">
              {data.recentResults.slice(0, 5).map((result) => (
                <li key={result.attemptId} className="flex items-center gap-4 border-b border-rule-2 py-3">
                  <span className={`nums display w-16 text-2xl ${result.passed ? 'text-ink' : 'text-red'}`}>
                    {percent(result.percentage)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-md font-medium text-ink">{result.testTitle}</div>
                    <div className="text-sm text-ink-2">
                      {result.passed ? 'Passed' : 'Below the pass mark'}, {relative(result.submittedAt)}
                    </div>
                  </div>
                  <Link to={`/results/${result.attemptId}`} className="shrink-0 text-base font-medium text-pen hover:underline">
                    Review and debrief
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t-[1.5px] border-ink py-4 text-base text-ink-2">
              Your marks appear here after your first test, with a debrief of what to revise.
            </p>
          )}
        </section>

        <section>
          <SectionTitle>Score by course</SectionTitle>
          {data ? (
            data.byCourse.length ? (
              <>
                <BarList
                  rows={data.byCourse.map((c) => ({ label: c.title, value: c.avgScore, note: `${Math.round(c.progress)}% read` }))}
                  mark={PASS_MARK}
                  tone={(value) => (value < PASS_MARK ? 'red' : 'ink')}
                />
                <p className="mt-3 text-sm text-ink-3">The line marks {PASS_MARK}%, the usual pass mark.</p>
                {weakest && (
                  <div className="mt-8 border-l-[3px] border-mark pl-4">
                    <p className="text-base leading-relaxed text-ink">
                      <span className="font-semibold">{weakest.title}</span> is your lowest course at {percent(weakest.avgScore)}.
                    </p>
                    <Link to={`/ask?course=${weakest.courseId}`} className="mt-1 inline-block text-base font-medium text-pen hover:underline">
                      Ask about this course
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <p className="text-base text-ink-2">Enrol in a course to see how you are doing in it.</p>
            )
          ) : (
            <Skeleton className="h-40" />
          )}
        </section>
      </div>
    </Page>
  );
}
