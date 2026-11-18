import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { formatDateTime, marks } from '@/lib/format';
import type { Course, Paged } from '@/lib/types';
import { Button, Empty, PageHeader, SectionTitle, Tag } from '@/ui/core';
import { ActionForm, QueryState, type FormField } from '@/ui/forms';
import { Dialog, toast } from '@/ui/overlay';
import { Pager } from '@/pages/results/Results';

interface Submission { id: string; answerText: string | null; marks: number | null; feedback: string | null; submittedAt: string; student: { fullName: string | null; email: string } }
interface Assignment { id: string; title: string; description: string | null; dueAt: string | null; maxMarks: number; course: Course | null; submissions?: Submission[]; mySubmission?: Submission | null; _count: { submissions: number } }

function AssignmentForm({ onDone }: { onDone: () => void }) {
  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: () => api.get<Paged<Course>>('/courses', { limit: 100 }) });
  const fields: FormField[] = [{ name: 'title', label: 'Assignment title', required: true }, { name: 'courseId', label: 'Course', type: 'select', options: courses.data?.items.map(course => ({ value: course.id, label: course.name })) }, { name: 'maxMarks', label: 'Maximum marks', type: 'number', min: 1, required: true }, { name: 'dueAt', label: 'Due date', type: 'datetime-local' }, { name: 'description', label: 'Instructions', type: 'textarea', required: true }];
  return <ActionForm fields={fields} initial={{ maxMarks: '100' }} submitLabel="Create assignment" onSubmit={async values => { await api.post('/assignments', { title: values.title, description: values.description, maxMarks: Number(values.maxMarks), ...(values.courseId ? { courseId: values.courseId } : {}), ...(values.dueAt ? { dueAt: new Date(values.dueAt).toISOString() } : {}) }); toast.done('Assignment created'); onDone(); }} />;
}

export function Assignments() {
  const staff = useAuth(state => isStaffRole(state.user?.role));
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['assignments', page], queryFn: () => api.get<{ items: Assignment[]; total: number }>('/assignments', { page, limit: 20 }) });
  return <Page><PageHeader title="Assignments" description={staff ? 'Give your students room to put ideas into practice.' : 'Your next opportunity to put learning into practice.'} actions={staff && <Button onClick={() => setCreating(true)}>Create assignment</Button>} /><QueryState query={query}>
    {!query.data?.items.length && <Empty title="No assignments yet" />}
    <div className="grid gap-4 md:grid-cols-2">{query.data?.items.map(item => <Link key={item.id} to={`/assignments/${item.id}`} className="rounded-lg border border-rule bg-paper p-6 transition-colors hover:border-ink"><p className="text-xs uppercase tracking-wider text-ink-3">{item.course?.name ?? 'Independent coursework'}</p><h2 className="display mt-3 text-2xl">{item.title}</h2><p className="mt-2 line-clamp-2 text-ink-2">{item.description}</p><div className="mt-6 flex flex-wrap justify-between gap-2 text-sm text-ink-3"><span>{marks(item.maxMarks)} marks</span><span>{item.dueAt ? `Due ${formatDateTime(item.dueAt)}` : 'No deadline'}</span></div></Link>)}</div>
    <Pager page={page} pages={Math.ceil((query.data?.total ?? 0) / 20)} onPage={setPage} />
  </QueryState><Dialog open={creating} onOpenChange={setCreating} title="Create assignment">{creating && <AssignmentForm onDone={() => { setCreating(false); void client.invalidateQueries({ queryKey: ['assignments'] }); }} />}</Dialog></Page>;
}

export function AssignmentDetail() {
  const { assignmentId } = useParams();
  const staff = useAuth(state => isStaffRole(state.user?.role));
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['assignment', assignmentId], queryFn: () => api.get<{ assignment: Assignment }>(`/assignments/${assignmentId}`) });
  const data = query.data?.assignment;
  const refresh = () => client.invalidateQueries({ queryKey: ['assignment', assignmentId] });
  return <Page narrow><QueryState query={query}>{data && <>
    <PageHeader title={data.title} back={{ to: '/assignments', label: 'Assignments' }} description={`${marks(data.maxMarks)} marks · ${data.dueAt ? `Due ${formatDateTime(data.dueAt)}` : 'No deadline'}`} />
    <p className="mb-10 whitespace-pre-wrap text-md leading-relaxed text-ink-2">{data.description}</p>
    {staff ? <><SectionTitle>Submissions</SectionTitle>{!data.submissions?.length && <Empty title="No submissions yet" />}{data.submissions?.map(submission => <article className="mb-6 rounded-lg border border-rule p-5" key={submission.id}><h3 className="font-semibold">{submission.student.fullName ?? submission.student.email}</h3><p className="text-sm text-ink-3">{formatDateTime(submission.submittedAt)}</p><p className="my-5 whitespace-pre-wrap">{submission.answerText}</p><ActionForm fields={[{ name: 'marks', label: `Marks (out of ${marks(data.maxMarks)})`, type: 'number', min: 0, max: Number(data.maxMarks), step: '0.5', required: true }, { name: 'feedback', label: 'Feedback', type: 'textarea' }]} initial={{ marks: submission.marks == null ? '' : String(submission.marks), feedback: submission.feedback ?? '' }} submitLabel="Save grade" onSubmit={async values => { await api.post(`/assignments/${data.id}/submissions/${submission.id}/grade`, { marks: Number(values.marks), feedback: values.feedback }); await refresh(); toast.done('Grade saved'); }} /></article>)}</> : <>
      <SectionTitle>Your submission</SectionTitle>{data.mySubmission && <div className="mb-5"><Tag tone={data.mySubmission.marks == null ? 'pen' : 'tick'}>{data.mySubmission.marks == null ? 'Submitted · awaiting review' : `${marks(data.mySubmission.marks)} / ${marks(data.maxMarks)} marks`}</Tag>{data.mySubmission.feedback && <p className="mt-3 text-ink-2">Feedback: {data.mySubmission.feedback}</p>}</div>}
      {data.dueAt && Date.parse(data.dueAt) < Date.now() || data.mySubmission?.marks != null ? <><p className="mb-4 text-ink-3">{data.mySubmission?.marks != null ? 'This submission has been graded.' : 'The submission deadline has passed.'}</p><p className="whitespace-pre-wrap">{data.mySubmission?.answerText}</p></> : <ActionForm fields={[{ name: 'answerText', label: 'Your answer', type: 'textarea', required: true }]} initial={{ answerText: data.mySubmission?.answerText ?? '' }} submitLabel={data.mySubmission ? 'Update submission' : 'Submit assignment'} onSubmit={async values => { await api.post(`/assignments/${data.id}/submit`, values); await refresh(); toast.done('Assignment submitted'); }} />}
    </>}
  </>}</QueryState></Page>;
}
