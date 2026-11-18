import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { formatDateTime, formatDuration, marks, percent } from '@/lib/format';
import type { Paged, ResultRow } from '@/lib/types';
import { Button, DataTable, Empty, ErrorNote, Input, PageHeader, Spinner, Status, type Column } from '@/ui/core';

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-base text-ink-2">
      <span className="nums">
        Page {page} of {pages}
      </span>
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

export function Results() {
  const user = useAuth((state) => state.user)!;
  const staff = isStaffRole(user.role);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const results = useQuery({
    queryKey: ['results', staff ? 'all' : 'mine', page, search],
    queryFn: () => api.get<Paged<ResultRow>>(staff ? '/results' : '/results/my', { page, limit: 20, ...(search ? { search } : {}) }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<ResultRow>[] = [
    ...(staff
      ? [
          {
            key: 'student',
            header: 'Candidate',
            cell: (row: ResultRow) => (
              <div>
                <div className="font-medium text-ink">{row.student?.fullName ?? row.student?.email}</div>
                <div className="text-sm text-ink-3">{row.student?.email}</div>
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'test',
      header: 'Test',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink">{row.test.title}</div>
          <div className="text-sm text-ink-3">{row.test.course ?? 'General'}</div>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Marks',
      align: 'right',
      cell: (row) => (
        <span>
          <span className="font-semibold text-ink">{marks(row.score)}</span>
          <span className="text-ink-3"> / {marks(row.test.totalMarks)}</span>
        </span>
      ),
    },
    { key: 'percent', header: 'Score', align: 'right', cell: (row) => <span className="font-semibold">{percent(row.percentage)}</span> },
    {
      key: 'outcome',
      header: 'Outcome',
      cell: (row) =>
        row.status !== 'EVALUATED' ? (
          <Status tone="pen">Awaiting grading</Status>
        ) : row.passed ? (
          <Status tone="tick">Passed</Status>
        ) : (
          <Status tone="red">Below pass mark</Status>
        ),
    },
    { key: 'time', header: 'Time taken', align: 'right', cell: (row) => formatDuration(row.timeTakenSeconds) },
    ...(staff
      ? [
          {
            key: 'flags',
            header: 'Flags',
            align: 'right' as const,
            cell: (row: ResultRow) =>
              row.suspiciousEventCount ? <span className="text-red">{row.suspiciousEventCount}</span> : <span className="text-ink-3">0</span>,
          },
        ]
      : []),
    { key: 'when', header: 'Submitted', cell: (row) => <span className="text-ink-2">{formatDateTime(row.submittedAt)}</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Results"
        description={
          staff
            ? 'Every submitted attempt on your tests. Open one to review the answers and grade written responses.'
            : 'Every test you have submitted. Open one to review your answers and get a debrief of what to revise.'
        }
        actions={
          staff && (
            <Input
              type="search"
              placeholder="Find a candidate"
              aria-label="Find a candidate"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-64"
            />
          )
        }
      />
      {results.isLoading ? (
        <Spinner />
      ) : results.isError ? (
        <ErrorNote message="Results could not be loaded." onRetry={() => results.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={results.data?.items ?? []}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate(`/results/${row.id}`)}
            empty={
              <Empty title={search ? 'No candidate matches that search' : 'No results yet'}>
                {staff ? 'Attempts appear here as soon as candidates submit.' : 'Sit a test and your marks appear here.'}
              </Empty>
            }
          />
          <Pager page={page} pages={results.data?.meta.pages ?? 1} onPage={setPage} />
        </>
      )}
    </Page>
  );
}
