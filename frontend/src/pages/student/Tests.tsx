import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { formatDateTime, marks, plural, relative } from '@/lib/format';
import type { AssignedTest } from '@/lib/types';
import { Empty, ErrorNote, LinkButton, PageHeader, Spinner, Status, Tabs } from '@/ui/core';

type Tab = 'sit' | 'done' | 'missed';

function Row({ test }: { test: AssignedTest }) {
  const window = test.ended
    ? `Closed ${relative(test.endAt)}`
    : !test.started
      ? `Opens ${formatDateTime(test.startAt)}`
      : test.endAt
        ? `Open until ${formatDateTime(test.endAt)}`
        : 'Open, no closing date';

  return (
    <li className="grid items-center gap-x-8 gap-y-3 border-b border-rule-2 py-5 md:grid-cols-[minmax(0,1fr)_14rem_9rem]">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-snug text-ink">{test.title}</h2>
        <p className="mt-0.5 text-base text-ink-2">{test.course ? `${test.course.code} ${test.course.name}` : 'General'}</p>
        <p className="nums mt-2 text-sm text-ink-2">
          {[
            `${test.durationMinutes} minutes`,
            plural(test.questionCount, 'question'),
            `${marks(test.totalMarks)} marks, pass at ${marks(test.passingMarks)}`,
            test.negativeMarks > 0 ? `${marks(test.negativeMarks)} off per wrong answer` : 'no negative marking',
          ].join(', ')}
        </p>
      </div>
      <div className="text-base">
        <Status tone={test.canAttempt ? 'tick' : test.ended ? 'neutral' : 'pen'}>{window}</Status>
        <div className="mt-1 text-sm text-ink-3">
          {test.attemptsUsed
            ? `Best ${marks(test.bestScore)} of ${marks(test.totalMarks)}, ${test.attemptsUsed} of ${test.maxAttempts} attempts used`
            : `${plural(test.maxAttempts, 'attempt')} allowed`}
        </div>
      </div>
      <div className="md:text-right">
        {test.canAttempt ? (
          <LinkButton to={`/tests/${test.id}/sit`}>{test.attemptsUsed ? 'Sit again' : 'Start test'}</LinkButton>
        ) : test.attemptsUsed ? (
          <LinkButton to="/results" variant="secondary">
            See result
          </LinkButton>
        ) : null}
      </div>
    </li>
  );
}

export function StudentTests() {
  const [tab, setTab] = useState<Tab>('sit');
  const tests = useQuery({
    queryKey: ['tests', 'assigned'],
    queryFn: () => api.get<{ items: AssignedTest[] }>('/tests/assigned'),
  });
  const items = tests.data?.items ?? [];
  const groups: Record<Tab, AssignedTest[]> = {
    sit: items.filter((t) => !t.ended && t.attemptsLeft > 0).sort((a, b) => Number(b.canAttempt) - Number(a.canAttempt)),
    done: items.filter((t) => t.attemptsUsed > 0),
    missed: items.filter((t) => t.ended && t.attemptsUsed === 0),
  };
  const empty: Record<Tab, [string, string]> = {
    sit: ['No test is waiting for you', 'When a teacher assigns a test to your class, it appears here with its opening time.'],
    done: ['You have not finished a test yet', 'Tests you submit move here, with your best score.'],
    missed: ['You have not missed a test', 'A test that closes before you sit it is listed here.'],
  };

  return (
    <Page>
      <PageHeader title="Tests" description="Every test assigned to you. Your answers are saved as you fill the sheet, and the clock keeps running if you close the tab." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'sit', label: 'To sit', count: groups.sit.length },
          { value: 'done', label: 'Done', count: groups.done.length },
          { value: 'missed', label: 'Missed', count: groups.missed.length },
        ]}
      />
      {tests.isLoading ? (
        <Spinner />
      ) : tests.isError ? (
        <div className="mt-6">
          <ErrorNote message="Your tests could not be loaded." onRetry={() => tests.refetch()} />
        </div>
      ) : groups[tab].length ? (
        <ul>
          {groups[tab].map((test) => (
            <Row key={test.id} test={test} />
          ))}
        </ul>
      ) : (
        <Empty title={empty[tab][0]}>{empty[tab][1]}</Empty>
      )}
    </Page>
  );
}
