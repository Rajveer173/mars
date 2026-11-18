import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { percent, plural } from '@/lib/format';
import type { Course, Paged, StudentAnalytics } from '@/lib/types';
import { Button, Empty, ErrorNote, Field, Input, Meter, PageHeader, SectionTitle, Spinner, Textarea } from '@/ui/core';
import { Dialog, toast } from '@/ui/overlay';

interface Enrollment {
  id: string;
  course: Course;
}

export function CourseForm({ course, onDone }: { course?: Course; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(course?.name ?? '');
  const [code, setCode] = useState(course?.code ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), code: code.trim(), description: description.trim() || undefined };
      if (course) await api.put(`/courses/${course.id}`, body);
      else await api.post('/courses', body);
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      await queryClient.invalidateQueries({ queryKey: ['course'] });
      toast.done(course ? 'Course saved' : 'Course created');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <ErrorNote message={error} />}
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <Field label="Code" htmlFor="course-code" hint="Letters, numbers, dashes">
          <Input id="course-code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CS301" maxLength={20} />
        </Field>
        <Field label="Name" htmlFor="course-name">
          <Input id="course-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
      </div>
      <Field label="Description" htmlFor="course-description" hint="One or two sentences shown on the course list.">
        <Textarea id="course-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!name.trim() || !code.trim()}>
          {course ? 'Save course' : 'Create course'}
        </Button>
      </div>
    </form>
  );
}

function CourseRow({ course, children }: { course: Course; children?: React.ReactNode }) {
  return (
    <li className="grid items-center gap-x-8 gap-y-2 border-b border-rule-2 py-5 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]">
      <span className="display nums text-2xl text-ink-3">{course.code}</span>
      <div className="min-w-0">
        <Link to={`/courses/${course.id}`} className="text-lg font-semibold leading-snug text-ink hover:text-pen">
          {course.name}
        </Link>
        {course.description && <p className="mt-0.5 line-clamp-2 max-w-2xl text-base text-ink-2">{course.description}</p>}
      </div>
      <div className="sm:text-right">{children}</div>
    </li>
  );
}

export function Courses() {
  const user = useAuth((state) => state.user)!;
  const staff = isStaffRole(user.role);
  const student = user.role === 'STUDENT';
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const all = useQuery({ queryKey: ['courses', 'all'], queryFn: () => api.get<Paged<Course>>('/courses', { limit: 100 }) });
  const mine = useQuery({
    queryKey: ['courses', 'mine'],
    queryFn: () => api.get<{ enrollments: Enrollment[] }>('/my-courses'),
    enabled: student,
  });
  const analytics = useQuery({
    queryKey: ['analytics', 'me', '90d'],
    queryFn: () => api.get<StudentAnalytics>('/analytics/me', { range: '90d' }),
    enabled: student,
  });

  const enrolledIds = new Set(mine.data?.enrollments.map((e) => e.course.id));
  const progress = new Map(analytics.data?.byCourse.map((c) => [c.courseId, c]));
  const others = (all.data?.items ?? []).filter((course) => !enrolledIds.has(course.id));

  const enroll = async (course: Course) => {
    setEnrolling(course.id);
    try {
      await api.post(`/courses/${course.id}/enroll`);
      await queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.done(`Enrolled in ${course.name}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Courses"
        description={
          student
            ? 'The courses you are enrolled in. Their lessons are what the agents read when you ask a question.'
            : 'Every course at the institute. Each lesson is indexed into the knowledge base when it is saved.'
        }
        actions={user.role !== 'PROCTOR' && staff && <Button onClick={() => setCreating(true)}>New course</Button>}
      />

      {all.isLoading || (student && mine.isLoading) ? (
        <Spinner />
      ) : all.isError ? (
        <ErrorNote message="Courses could not be loaded." onRetry={() => all.refetch()} />
      ) : student ? (
        <>
          {mine.data?.enrollments.length ? (
            <ul className="border-t-[1.5px] border-ink">
              {mine.data.enrollments.map(({ course }) => {
                const stats = progress.get(course.id);
                return (
                  <CourseRow key={course.id} course={course}>
                    <div className="w-44">
                      <div className="nums mb-1.5 flex justify-between text-sm text-ink-2">
                        <span>{Math.round(stats?.progress ?? 0)}% read</span>
                        <span>{stats?.avgScore ? `avg ${percent(stats.avgScore)}` : 'no tests yet'}</span>
                      </div>
                      <Meter value={stats?.progress ?? 0} />
                    </div>
                  </CourseRow>
                );
              })}
            </ul>
          ) : (
            <Empty title="You are not enrolled in a course yet">Pick one from the list below to start reading its lessons.</Empty>
          )}
          {others.length > 0 && (
            <>
              <SectionTitle className="mt-14">Other courses</SectionTitle>
              <ul className="border-t-[1.5px] border-ink">
                {others.map((course) => (
                  <CourseRow key={course.id} course={course}>
                    <Button variant="secondary" size="sm" loading={enrolling === course.id} onClick={() => enroll(course)}>
                      Enrol
                    </Button>
                  </CourseRow>
                ))}
              </ul>
            </>
          )}
        </>
      ) : all.data?.items.length ? (
        <ul className="border-t-[1.5px] border-ink">
          {all.data.items.map((course) => (
            <CourseRow key={course.id} course={course}>
              <span className="nums text-base text-ink-2">
                {plural(course._count?.tests ?? 0, 'test')}, {plural(course._count?.classBatches ?? 0, 'class', 'classes')}
              </span>
            </CourseRow>
          ))}
        </ul>
      ) : (
        <Empty title="No courses yet" action={<Button onClick={() => setCreating(true)}>Create the first course</Button>}>
          A course holds modules and lessons. Lessons become the knowledge base the agents answer from.
        </Empty>
      )}

      <Dialog open={creating} onOpenChange={setCreating} title="New course">
        <CourseForm onDone={() => setCreating(false)} />
      </Dialog>
    </Page>
  );
}
