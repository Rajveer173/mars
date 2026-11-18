import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/format';
import { DataTable, Empty, PageHeader, SectionTitle, Tag } from '@/ui/core';
import { ActionForm, QueryState } from '@/ui/forms';
import { Dialog, toast } from '@/ui/overlay';

interface Session { id: string; status: string; suspicionScore: number; startedAt: string; student: { fullName: string | null; email: string }; test: { title: string }; events?: { id: string; type: string; createdAt: string; severity: string }[] }
export function Proctoring() {
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['proctoring', 'active'], queryFn: () => api.get<{ sessions: Session[] }>('/proctoring/sessions/active'), refetchInterval: 15_000 });
  const detail = useQuery({ queryKey: ['proctoring', selected], queryFn: () => api.get<{ session: Session }>(`/proctoring/sessions/${selected}`), enabled: !!selected, refetchInterval: 15_000 });
  return <Page><PageHeader title="Live invigilation" description="Active exam sessions. Updates automatically every 15 seconds." /><QueryState query={query}><DataTable rows={query.data?.sessions ?? []} rowKey={row => row.id} onRowClick={row => setSelected(row.id)} empty={<Empty title="No active sessions">Candidates appear here when a proctored assessment starts.</Empty>} columns={[{ key: 'student', header: 'Candidate', cell: row => <div><p className="font-medium">{row.student.fullName ?? row.student.email}</p><p className="text-sm text-ink-3">{row.student.email}</p></div> }, { key: 'test', header: 'Assessment', cell: row => row.test.title }, { key: 'score', header: 'Suspicion score', cell: row => <Tag tone={row.suspicionScore > 30 ? 'red' : 'neutral'}>{row.suspicionScore}</Tag> }, { key: 'start', header: 'Started', cell: row => formatDateTime(row.startedAt) }]} /></QueryState>
    <Dialog open={!!selected} onOpenChange={() => setSelected(null)} title={detail.data?.session.student.fullName ?? 'Session detail'} size="lg"><QueryState query={detail}>
      <ActionForm fields={[{ name: 'message', label: 'Message to candidate', type: 'textarea', required: true }]} submitLabel="Send alert" onSubmit={async values => { await api.post(`/proctoring/sessions/${selected}/alert`, values); toast.done('Alert sent to candidate'); }} />
      <SectionTitle className="mt-8">Event timeline</SectionTitle>{!detail.data?.session.events?.length && <Empty title="No events recorded" />}{detail.data?.session.events?.map(event => <div key={event.id} className="flex justify-between gap-4 border-t border-rule py-3"><span>{titleCase(event.type)}</span><span className="text-sm text-ink-3">{formatDateTime(event.createdAt)}</span></div>)}
    </QueryState></Dialog>
  </Page>;
}
