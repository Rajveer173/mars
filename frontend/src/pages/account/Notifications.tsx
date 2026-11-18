import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { relative } from '@/lib/format';
import { Button, Empty, PageHeader, Tag } from '@/ui/core';
import { QueryState } from '@/ui/forms';
import { toast } from '@/ui/overlay';
import { Pager } from '@/pages/results/Results';

interface Notice { id: string; title: string; message: string; isRead: boolean; createdAt: string }
export function Notifications() {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['notifications', page], queryFn: () => api.get<{ items: Notice[]; total: number }>('/notifications', { page, limit: 20 }) });
  async function read(id?: string) { setBusy(true); try { await api.post(id ? `/notifications/${id}/read` : '/notifications/read-all'); await client.invalidateQueries({ queryKey: ['notifications'] }); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); } }
  return <Page narrow><PageHeader title="Notifications" description="Updates from your courses and assessments." actions={<Button variant="secondary" loading={busy} onClick={() => void read()}>Mark all as read</Button>} /><QueryState query={query}>
    {!query.data?.items.length && <Empty title="You're all caught up">New updates will appear here.</Empty>}
    {query.data?.items.map(item => <article key={item.id} className="border-b border-rule py-5"><div className="flex items-start justify-between gap-4"><h2 className="font-semibold">{item.title} {!item.isRead && <Tag tone="mark">New</Tag>}</h2><time className="shrink-0 text-sm text-ink-3">{relative(item.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap text-ink-2">{item.message}</p>{!item.isRead && <Button variant="ghost" size="sm" className="mt-2" disabled={busy} onClick={() => void read(item.id)}>Mark as read</Button>}</article>)}
    <Pager page={page} pages={Math.ceil((query.data?.total ?? 0) / 20)} onPage={setPage} />
  </QueryState></Page>;
}
