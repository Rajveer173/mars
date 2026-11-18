import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { formatDateTime, marks, relative } from '@/lib/format';
import type { CourseRef, Paged, TestStatus } from '@/lib/types';
import { Pager } from '@/pages/results/Results';
import { DataTable, Empty, ErrorNote, Input, LinkButton, PageHeader, Spinner, Status, Tabs, type Column, type Tone } from '@/ui/core';

export interface TestRow {
  id: string;
  title: string;
  status: TestStatus;
  durationMinutes: number;
  totalMarks: string | number;
  passingMarks: string | number;
  startAt: string | null;
  endAt: string | null;
  examMode: string | null;
  createdAt: string;
  course: CourseRef | null;
  _count: { testQuestions: number; attempts: number; assignments: number };
}

export const TEST_STATUS: Record<TestStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PUBLISHED: { label: 'Published', tone: 'tick' },
  CLOSED: { label: 'Closed', tone: 'red' },
};

/** Where a published test is in its window: what a teacher needs to know at a glance. */
export const windowText = (test: { status: TestStatus; startAt: string | null; endAt: string | null }) => {
  if (test.status === 'DRAFT') return 'Not published';
  const now = Date.now();
  if (test.startAt && Date.parse(test.startAt) > now) return `Opens ${relative(test.startAt)}`;
  if (test.endAt && Date.parse(test.endAt) < now) return `Ended ${relative(test.endAt)}`;
  return test.endAt ? `Open until ${formatDateTime(test.endAt)}` : 'Open, no closing date';
};

type Filter = 'ALL' | TestStatus;

export function StaffTests() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const tests = useQuery({
    queryKey: ['tests', 'staff', status, search, page],
    queryFn: () =>
      api.get<Paged<TestRow>>('/tests', { page, limit: 20, ...(status !== 'ALL' ? { status } : {}), ...(search ? { search } : {}) }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<TestRow>[] = [
    {
      key: 'title',
      header: 'Test',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink">{row.title}</div>
          <div className="text-sm text-ink-3">{row.course ? `${row.course.code} ${row.course.name}` : 'No course'}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (row) => <Status tone={TEST_STATUS[row.status].tone}>{TEST_STATUS[row.status].label}</Status> },
    { key: 'window', header: 'Window', cell: (row) => <span className="text-ink-2">{windowText(row)}</span> },
    { key: 'questions', header: 'Questions', align: 'right', cell: (row) => row._count.testQuestions },
    { key: 'marks', header: 'Marks', align: 'right', cell: (row) => marks(row.totalMarks) },
    { key: 'duration', header: 'Minutes', align: 'right', cell: (row) => row.durationMinutes },
    { key: 'attempts', header: 'Attempts', align: 'right', cell: (row) => row._count.attempts },
  ];

  return (
    <Page>
      <PageHeader
        title="Tests"
        description="Build a test from your questions, publish it to a class, and follow the attempts as they come in."
        actions={<LinkButton to="/tests/new">New test</LinkButton>}
      />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <Tabs
          className="flex-1"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          items={[
            { value: 'ALL', label: 'All' },
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'DRAFT', label: 'Drafts' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
        />
        <Input
          type="search"
          placeholder="Find a test"
          aria-label="Find a test"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />
      </div>
      {tests.isLoading ? (
        <Spinner />
      ) : tests.isError ? (
        <ErrorNote message="Tests could not be loaded." onRetry={() => tests.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={tests.data?.items ?? []}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate(`/tests/${row.id}`)}
            empty={
              <Empty title={search || status !== 'ALL' ? 'No test matches' : 'No tests yet'} action={<LinkButton to="/tests/new">Build your first test</LinkButton>}>
                A test is a timed set of questions assigned to students.
              </Empty>
            }
          />
          <Pager page={page} pages={tests.data?.meta.pages ?? 1} onPage={setPage} />
        </>
      )}
    </Page>
  );
}
