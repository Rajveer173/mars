import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { Button, Empty, Figure, FigureRow, PageHeader, SectionTitle } from '@/ui/core';
import { ActionForm, QueryState } from '@/ui/forms';
import { Dialog, toast } from '@/ui/overlay';

interface Organization { id: string; name: string; slug: string; description: string | null; _count: { members: number; courses: number; departments: number } }
interface Department { id: string; name: string; code: string }
export function Organizations() {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Organization | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['organizations'], queryFn: () => api.get<{ organizations: Organization[] }>('/organizations') });
  const departments = useQuery({ queryKey: ['departments', selected?.id], queryFn: () => api.get<{ departments: Department[] }>(`/organizations/${selected?.id}/departments`), enabled: !!selected });
  return <Page><PageHeader title="Organisation" description="The institutes and departments that make up your learning community." actions={<Button onClick={() => setCreating(true)}>Add organisation</Button>} /><QueryState query={query}>{!query.data?.organizations.length && <Empty title="No organisations yet" />}{query.data?.organizations.map(org => <section key={org.id} className="mb-6 rounded-lg border border-rule bg-paper p-6"><div className="mb-6 flex justify-between gap-4"><div><h2 className="display text-2xl">{org.name}</h2><p className="mt-2 text-ink-2">{org.description}</p></div><Button variant="secondary" onClick={() => setSelected(org)}>Departments</Button></div><FigureRow><Figure label="Members" value={org._count.members} /><Figure label="Departments" value={org._count.departments} /><Figure label="Courses" value={org._count.courses} /></FigureRow></section>)}</QueryState>
    <Dialog open={creating} onOpenChange={setCreating} title="Add organisation">{creating && <ActionForm fields={[{ name: 'name', label: 'Name', required: true }, { name: 'slug', label: 'Short identifier', required: true, hint: 'Lowercase letters, numbers and hyphens.' }, { name: 'description', label: 'Description', type: 'textarea' }]} submitLabel="Create organisation" onSubmit={async values => { await api.post('/organizations', values); setCreating(false); await client.invalidateQueries({ queryKey: ['organizations'] }); toast.done('Organisation created'); }} />}</Dialog>
    <Dialog open={!!selected} onOpenChange={() => setSelected(null)} title={selected?.name ?? 'Departments'}><QueryState query={departments}>{departments.data?.departments.map(department => <p key={department.id} className="border-b border-rule py-3">{department.name} <span className="ml-2 text-sm text-ink-3">{department.code}</span></p>)}</QueryState><SectionTitle className="mt-8">Add department</SectionTitle><ActionForm fields={[{ name: 'name', label: 'Department name', required: true }, { name: 'code', label: 'Code', required: true }]} submitLabel="Add department" onSubmit={async values => { await api.post(`/organizations/${selected?.id}/departments`, values); await departments.refetch(); await client.invalidateQueries({ queryKey: ['organizations'] }); toast.done('Department added'); }} /></Dialog>
  </Page>;
}
