import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import type { Course, Paged } from '@/lib/types';
import { Button, DataTable, Empty, PageHeader } from '@/ui/core';
import { ActionForm, QueryState } from '@/ui/forms';
import { Dialog, toast } from '@/ui/overlay';

interface Student { id: string; fullName: string | null; email: string }
interface ClassBatch { id: string; name: string; courseId: string; course: Course; _count: { students: number; testAssignments: number }; students?: { student: Student }[] }
export function Classes() {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['classes'], queryFn: () => api.get<{ batches: ClassBatch[] }>('/class-batches') });
  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: () => api.get<Paged<Course>>('/courses', { limit: 100 }) });
  const detail = useQuery({ queryKey: ['class', selected], queryFn: () => api.get<{ batch: ClassBatch }>(`/class-batches/${selected}`), enabled: !!selected });
  const students = useQuery({ queryKey: ['students', 'picker'], queryFn: () => api.get<{ students: Student[] }>('/tests/students/list'), enabled: !!selected });
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['classes'] }), client.invalidateQueries({ queryKey: ['class', selected] })]); };
  return <Page><PageHeader title="Classes" description="Organise your learners and assign assessments to a whole class." actions={<Button onClick={() => setCreating(true)}>Create class</Button>} /><QueryState query={query}><DataTable rows={query.data?.batches ?? []} rowKey={row => row.id} onRowClick={row => setSelected(row.id)} columns={[{ key: 'name', header: 'Class', cell: row => <span className="font-medium">{row.name}</span> }, { key: 'course', header: 'Course', cell: row => row.course?.name }, { key: 'students', header: 'Students', cell: row => row._count.students, align: 'right' }, { key: 'tests', header: 'Assigned tests', cell: row => row._count.testAssignments, align: 'right' }]} /></QueryState>
    <Dialog open={creating} onOpenChange={setCreating} title="Create class">{creating && <ActionForm fields={[{ name: 'name', label: 'Class name', required: true }, { name: 'courseId', label: 'Course', type: 'select', required: true, options: courses.data?.items.map(course => ({ value: course.id, label: course.name })) }]} submitLabel="Create class" onSubmit={async values => { await api.post('/class-batches', values); setCreating(false); await refresh(); toast.done('Class created'); }} />}</Dialog>
    <Dialog open={!!selected} onOpenChange={() => setSelected(null)} title={detail.data?.batch.name ?? 'Class roster'} size="lg"><QueryState query={detail}>
      <ActionForm fields={[{ name: 'studentId', label: 'Add a student', type: 'select', required: true, options: students.data?.students.filter(student => !detail.data?.batch.students?.some(member => member.student.id === student.id)).map(student => ({ value: student.id, label: `${student.fullName ?? student.email} · ${student.email}` })) }]} submitLabel="Add student" onSubmit={async values => { await api.post(`/class-batches/${selected}/students`, { studentIds: [values.studentId] }); await refresh(); toast.done('Student added'); }} />
      <div className="mt-6">{!detail.data?.batch.students?.length && <Empty title="No students in this class" />}{detail.data?.batch.students?.map(({ student }) => <div key={student.id} className="flex justify-between gap-4 border-t border-rule py-3"><div><p>{student.fullName ?? student.email}</p><p className="text-sm text-ink-3">{student.email}</p></div><Button variant="ghost" onClick={async () => { try { await api.delete(`/class-batches/${selected}/students/${student.id}`); await refresh(); } catch (err) { toast.error(errorMessage(err)); } }}>Remove</Button></div>)}</div>
    </QueryState></Dialog>
  </Page>;
}
