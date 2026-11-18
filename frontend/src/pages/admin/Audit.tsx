import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import { Pager } from '@/pages/results/Results';
import { DataTable, Empty, ErrorNote, PageHeader, Select, Spinner, type Column } from '@/ui/core';

interface Entry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  user: { fullName: string | null; email: string } | null;
}

const ENTITIES = ['User', 'Course', 'Module', 'Lesson', 'Test', 'Question', 'Assignment', 'Announcement'];

export function Audit() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const log = useQuery({
    queryKey: ['audit', page, entity],
    queryFn: () => api.get<{ items: Entry[]; total: number; limit: number }>('/audit-logs', { page, limit: 25, ...(entity ? { entity } : {}) }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<Entry>[] = [
    { key: 'when', header: 'When', cell: (row) => <span className="nums whitespace-nowrap text-ink-2">{formatDateTime(row.createdAt)}</span> },
    {
      key: 'who',
      header: 'Who',
      cell: (row) =>
        row.user ? (
          <div>
            <div className="text-ink">{row.user.fullName ?? row.user.email}</div>
            <div className="text-sm text-ink-3">{row.user.email}</div>
          </div>
        ) : (
          <span className="text-ink-3">System</span>
        ),
    },
    { key: 'action', header: 'Did', cell: (row) => <span className="font-medium text-ink">{titleCase(row.action)}</span> },
    { key: 'entity', header: 'To', cell: (row) => row.entity },
    { key: 'id', header: 'Record', cell: (row) => <span className="font-mono text-xs text-ink-3">{row.entityId ?? ''}</span> },
    { key: 'ip', header: 'From', cell: (row) => <span className="nums text-ink-2">{row.ip ?? ''}</span> },
  ];

  return (
    <Page>
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Entries are written by the server on every create, update and delete, and cannot be edited."
        actions={
          <Select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            aria-label="Record type"
            className="w-48"
          >
            <option value="">Every record type</option>
            {ENTITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        }
      />
      {log.isLoading ? (
        <Spinner />
      ) : log.isError ? (
        <ErrorNote message="The audit log could not be loaded." onRetry={() => log.refetch()} />
      ) : (
        <>
          <DataTable columns={columns} rows={log.data?.items ?? []} rowKey={(row) => row.id} empty={<Empty title="No entries match" />} />
          <Pager page={page} pages={Math.max(1, Math.ceil((log.data?.total ?? 0) / (log.data?.limit ?? 25)))} onPage={setPage} />
        </>
      )}
    </Page>
  );
}
