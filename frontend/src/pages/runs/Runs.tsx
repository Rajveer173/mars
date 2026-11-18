import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isAdminRole, useAuth } from '@/lib/auth';
import { formatMs, formatNumber, relative } from '@/lib/format';
import type { Step } from '@/lib/stream';
import { verifiedShare, type RunSummary } from '@/pages/staff/Overview';
import { Material } from '@/ui/Material';
import { DataTable, Empty, ErrorNote, Figure, FigureRow, PageHeader, Spinner, Status, Tabs, type Column, type Tone } from '@/ui/core';
import { Dialog } from '@/ui/overlay';
import { AgentTrace, GroundingNote, SourceNotes, type Source } from '@/ui/trace';

interface RunRow {
  id: string;
  kind: 'ASK' | 'AUTHOR' | 'DEBRIEF';
  input: string;
  status: 'RUNNING' | 'DONE' | 'FAILED';
  route: string | null;
  grounded: string | null;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
  steps: number;
  user: { fullName: string | null; role: string };
}

interface RunDetail extends Omit<RunRow, 'steps'> {
  output: string | null;
  steps: Step[];
  sources: Source[];
}

const KIND: Record<RunRow['kind'], string> = { ASK: 'Ask', AUTHOR: 'Author', DEBRIEF: 'Debrief' };
const STATUS: Record<RunRow['status'], { label: string; tone: Tone }> = {
  DONE: { label: 'Finished', tone: 'tick' },
  FAILED: { label: 'Failed', tone: 'red' },
  RUNNING: { label: 'Running', tone: 'pen' },
};
const GROUNDED: Record<string, string> = { grounded: 'Verified', partial: 'Mostly verified', revised: 'Rewritten', ungrounded: 'Not verified' };

function RunView({ id }: { id: string }) {
  const run = useQuery({ queryKey: ['ai', 'run', id], queryFn: () => api.get<{ run: RunDetail }>(`/ai/runs/${id}`) });
  const [active, setActive] = useState<number | null>(null);
  if (run.isLoading) return <Spinner />;
  if (!run.data) return <ErrorNote message={errorMessage(run.error)} />;
  const data = run.data.run;
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <p className="text-md font-semibold text-pen-deep">{data.input}</p>
        {data.error && <p className="mt-3 text-base text-red">{data.error}</p>}
        {data.output && (
          <div className="mt-4">
            <Material small onCite={setActive} activeCite={active}>
              {data.output}
            </Material>
            <div className="mt-3">
              <GroundingNote verdict={data.grounded} />
            </div>
          </div>
        )}
        {data.sources.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-3 text-base font-semibold text-ink">Passages retrieved</h3>
            <SourceNotes sources={data.sources} active={active} onSelect={setActive} />
          </div>
        )}
      </div>
      <aside>
        <h3 className="mb-3 text-base font-semibold text-ink">Run sheet</h3>
        <AgentTrace steps={data.steps} />
        <p className="mt-4 break-words text-sm text-ink-3">{data.model}</p>
      </aside>
    </div>
  );
}

export function Runs() {
  const user = useAuth((state) => state.user)!;
  const admin = isAdminRole(user.role);
  const [kind, setKind] = useState<'ALL' | RunRow['kind']>('ALL');
  const [open, setOpen] = useState<RunRow | null>(null);

  const runs = useQuery({
    queryKey: ['ai', 'runs', kind],
    queryFn: () => api.get<{ runs: RunRow[]; summary: RunSummary }>('/ai/runs', { limit: 60, ...(kind !== 'ALL' ? { kind } : {}) }),
  });
  const summary = runs.data?.summary;
  const verified = verifiedShare(summary);

  const columns: Column<RunRow>[] = [
    { key: 'when', header: 'When', cell: (row) => <span className="whitespace-nowrap text-ink-2">{relative(row.createdAt)}</span> },
    ...(admin ? [{ key: 'who', header: 'Who', cell: (row: RunRow) => <span className="whitespace-nowrap">{row.user.fullName ?? 'Unknown'}</span> }] : []),
    { key: 'kind', header: 'Pipeline', cell: (row) => KIND[row.kind] },
    { key: 'input', header: 'Request', className: 'max-w-md', cell: (row) => <span className="line-clamp-1 text-ink">{row.input}</span> },
    {
      key: 'outcome',
      header: 'Outcome',
      cell: (row) =>
        row.status === 'DONE' && row.grounded ? (
          <Status tone={row.grounded === 'grounded' ? 'tick' : row.grounded === 'ungrounded' ? 'red' : 'mark'}>{GROUNDED[row.grounded]}</Status>
        ) : (
          <Status tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Status>
        ),
    },
    { key: 'steps', header: 'Steps', align: 'right', cell: (row) => row.steps },
    { key: 'time', header: 'Time', align: 'right', cell: (row) => formatMs(row.latencyMs) },
    { key: 'tokens', header: 'Tokens', align: 'right', cell: (row) => formatNumber(row.promptTokens + row.completionTokens) },
  ];

  return (
    <Page>
      <PageHeader
        title="Agent runs"
        description={
          admin
            ? 'Every pipeline execution at the institute, with each agent step, its timing, its tokens and its evidence.'
            : 'Every pipeline you have run, with each agent step, its timing, its tokens and its evidence.'
        }
      />
      <FigureRow>
        <Figure label="Runs" value={formatNumber(summary?.total)} note={summary?.byStatus.FAILED ? `${summary.byStatus.FAILED} failed` : 'none failed'} />
        <Figure label="Verified outright" value={verified == null ? 'No data' : `${verified}%`} note="of answers the Verifier checked" />
        <Figure label="Average run time" value={summary?.averageLatencyMs ? formatMs(summary.averageLatencyMs) : 'No data'} />
        <Figure
          label="Tokens"
          value={formatNumber((summary?.promptTokens ?? 0) + (summary?.completionTokens ?? 0))}
          note={summary ? `${formatNumber(summary.promptTokens)} in, ${formatNumber(summary.completionTokens)} out` : undefined}
        />
      </FigureRow>

      <Tabs
        className="mt-10"
        value={kind}
        onChange={setKind}
        items={[
          { value: 'ALL', label: 'All' },
          { value: 'ASK', label: 'Ask', count: summary?.byKind.ASK },
          { value: 'AUTHOR', label: 'Author', count: summary?.byKind.AUTHOR },
          { value: 'DEBRIEF', label: 'Debrief', count: summary?.byKind.DEBRIEF },
        ]}
      />
      <div className="pt-4">
        {runs.isLoading ? (
          <Spinner />
        ) : runs.isError ? (
          <ErrorNote message="Runs could not be loaded." onRetry={() => runs.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={runs.data?.runs ?? []}
            rowKey={(row) => row.id}
            onRowClick={setOpen}
            empty={
              <Empty title="No runs yet">
                A run is recorded each time someone asks a question, drafts questions or requests a debrief.
              </Empty>
            }
          />
        )}
      </div>

      <Dialog open={!!open} onOpenChange={() => setOpen(null)} title={open ? `${KIND[open.kind]} run` : ''} description={open ? relative(open.createdAt) : undefined} size="xl">
        {open && <RunView id={open.id} />}
      </Dialog>
    </Page>
  );
}
