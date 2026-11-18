import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { plural, relative } from '@/lib/format';
import type { Course, ModuleOutline } from '@/lib/types';
import { Button, ErrorNote, Field, Input, LinkButton, Meter, PageHeader, SectionTitle, Spinner, Textarea } from '@/ui/core';
import { Dialog, toast } from '@/ui/overlay';
import { CourseForm } from './Courses';

export interface LessonDraft {
  id?: string;
  title: string;
  durationMin: number | null;
  content: string;
}

/** Create or edit a lesson. Saving re-indexes it into the knowledge base. */
export function LessonForm({ moduleId, lesson, onDone }: { moduleId?: string; lesson?: LessonDraft; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [duration, setDuration] = useState(lesson?.durationMin?.toString() ?? '');
  const [content, setContent] = useState(lesson?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { title: title.trim(), content, type: 'text', ...(duration ? { durationMin: Number(duration) } : {}) };
      if (lesson?.id) await api.put(`/lessons/${lesson.id}`, body);
      else await api.post(`/modules/${moduleId}/lessons`, body);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course'] }),
        queryClient.invalidateQueries({ queryKey: ['lesson'] }),
        queryClient.invalidateQueries({ queryKey: ['ai'] }),
      ]);
      toast.done(lesson?.id ? 'Lesson saved' : 'Lesson added');
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
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Title" htmlFor="lesson-title">
          <Input id="lesson-title" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </Field>
        <Field label="Minutes" htmlFor="lesson-minutes">
          <Input id="lesson-minutes" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>
      <Field
        label="Lesson text"
        htmlFor="lesson-content"
        hint="Markdown. Each heading starts a new passage, and passages are what the agents retrieve and cite."
      >
        <Textarea
          id="lesson-content"
          rows={16}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="font-mono text-sm"
          maxLength={50000}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!title.trim()}>
          {lesson?.id ? 'Save lesson' : 'Add lesson'}
        </Button>
      </div>
    </form>
  );
}

function ModuleForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/courses/${courseId}/modules`, { title: title.trim() });
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.done('Module added');
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Module title" htmlFor="module-title" hint="A module groups the lessons of one unit.">
        <Input id="module-title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!title.trim()}>
          Add module
        </Button>
      </div>
    </form>
  );
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  pinned: boolean;
  createdAt: string;
  author: { fullName: string | null; username: string };
}

export function CourseDetail() {
  const { courseId = '' } = useParams();
  const user = useAuth((state) => state.user)!;
  const staff = isStaffRole(user.role);
  const [dialog, setDialog] = useState<{ kind: 'course' } | { kind: 'module' } | { kind: 'lesson'; moduleId: string } | null>(null);

  const course = useQuery({ queryKey: ['course', courseId], queryFn: () => api.get<{ course: Course }>(`/courses/${courseId}`) });
  const outline = useQuery({
    queryKey: ['course', courseId, 'modules'],
    queryFn: () => api.get<{ modules: ModuleOutline[] }>(`/courses/${courseId}/modules`),
  });
  const progress = useQuery({
    queryKey: ['course', courseId, 'progress'],
    queryFn: () => api.get<{ progress: { lessonId: string; completed: boolean }[] }>(`/courses/${courseId}/lesson-progress`),
    enabled: user.role === 'STUDENT',
  });
  const announcements = useQuery({
    queryKey: ['course', courseId, 'announcements'],
    queryFn: () => api.get<{ announcements: Announcement[] }>(`/courses/${courseId}/announcements`),
  });
  const documents = useQuery({
    queryKey: ['ai', 'documents', courseId],
    queryFn: () => api.get<{ documents: { id: string; chunks: number }[] }>('/ai/knowledge/documents', { courseId }),
  });

  if (course.isLoading) return <Page><Spinner /></Page>;
  if (course.isError || !course.data) return <Page><ErrorNote message={errorMessage(course.error)} /></Page>;

  const data = course.data.course;
  const modules = outline.data?.modules ?? [];
  const lessons = modules.flatMap((m) => m.lessons);
  const done = new Set(progress.data?.progress.filter((p) => p.completed).map((p) => p.lessonId));
  const next = lessons.find((lesson) => !done.has(lesson.id));
  const passages = documents.data?.documents.reduce((n, d) => n + d.chunks, 0) ?? 0;

  return (
    <Page>
      <PageHeader
        back={{ to: '/courses', label: 'All courses' }}
        title={data.name}
        description={data.description ?? undefined}
        actions={
          <>
            <LinkButton to={`/ask?course=${data.id}`} variant="secondary">
              Ask about this course
            </LinkButton>
            {staff && (
              <Button variant="secondary" onClick={() => setDialog({ kind: 'course' })}>
                Edit course
              </Button>
            )}
            {user.role === 'STUDENT' && next && <LinkButton to={`/lessons/${next.id}`}>{done.size ? 'Continue reading' : 'Start reading'}</LinkButton>}
          </>
        }
      />

      <div className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section>
          <SectionTitle
            aside={
              staff && (
                <button onClick={() => setDialog({ kind: 'module' })} className="inline-flex items-center gap-1 font-medium text-pen hover:underline">
                  <Plus className="size-3.5" aria-hidden /> Add module
                </button>
              )
            }
          >
            Lessons
          </SectionTitle>
          {outline.isLoading ? (
            <Spinner />
          ) : modules.length ? (
            <div className="border-t-[1.5px] border-ink">
              {modules.map((module, moduleIndex) => (
                <div key={module.id} className="border-b border-rule py-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-md font-semibold text-ink">
                      <span className="nums mr-2 text-ink-3">{moduleIndex + 1}</span>
                      {module.title}
                    </h3>
                    {staff && (
                      <button onClick={() => setDialog({ kind: 'lesson', moduleId: module.id })} className="shrink-0 text-sm font-medium text-pen hover:underline">
                        Add lesson
                      </button>
                    )}
                  </div>
                  <ol className="mt-2">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li key={lesson.id}>
                        <Link to={`/lessons/${lesson.id}`} className="group flex items-center gap-3 rounded-md py-1.5 pl-6 pr-2 hover:bg-desk">
                          <span className="nums w-8 shrink-0 text-sm text-ink-3">
                            {moduleIndex + 1}.{lessonIndex + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-serif text-md text-ink group-hover:text-pen">{lesson.title}</span>
                          {lesson.durationMin != null && <span className="nums shrink-0 text-sm text-ink-3">{lesson.durationMin} min</span>}
                          {user.role === 'STUDENT' && (
                            <span className="flex size-4 shrink-0 items-center justify-center" aria-label={done.has(lesson.id) ? 'Read' : 'Not read yet'}>
                              {done.has(lesson.id) ? <Check className="size-4 text-tick" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-rule" />}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                    {!module.lessons.length && <li className="py-1.5 pl-6 text-base text-ink-3">No lessons in this module yet.</li>}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <p className="border-t-[1.5px] border-ink py-4 text-base text-ink-2">
              This course has no lessons yet.{staff && ' Add a module, then add lessons to it.'}
            </p>
          )}
        </section>

        <aside className="space-y-10">
          {user.role === 'STUDENT' && lessons.length > 0 && (
            <div>
              <div className="nums mb-2 flex items-baseline justify-between">
                <span className="display text-3xl text-ink">{Math.round((done.size / lessons.length) * 100)}%</span>
                <span className="text-sm text-ink-2">
                  {done.size} of {plural(lessons.length, 'lesson')} read
                </span>
              </div>
              <Meter value={(done.size / lessons.length) * 100} />
            </div>
          )}

          <div>
            <h3 className="text-base font-semibold text-ink">In the knowledge base</h3>
            <p className="mt-1.5 text-base leading-relaxed text-ink-2">
              {documents.data
                ? `${plural(documents.data.documents.length, 'document')} from this course, split into ${plural(passages, 'passage')} the agents can retrieve and cite.`
                : 'Checking what is indexed.'}
            </p>
            {staff && (
              <Link to={`/knowledge?course=${data.id}`} className="mt-1.5 inline-block text-base font-medium text-pen hover:underline">
                Open the knowledge base
              </Link>
            )}
          </div>

          {!!announcements.data?.announcements.length && (
            <div>
              <h3 className="text-base font-semibold text-ink">Announcements</h3>
              <ul className="mt-2 space-y-4">
                {announcements.data.announcements.slice(0, 4).map((item) => (
                  <li key={item.id} className="border-l-2 border-rule pl-3">
                    <div className="text-base font-medium text-ink">{item.title}</div>
                    <p className="mt-0.5 text-base leading-relaxed text-ink-2">{item.message}</p>
                    <div className="mt-1 text-sm text-ink-3">
                      {item.author.fullName ?? item.author.username}, {relative(item.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <Dialog open={dialog?.kind === 'course'} onOpenChange={() => setDialog(null)} title="Edit course">
        <CourseForm course={data} onDone={() => setDialog(null)} />
      </Dialog>
      <Dialog open={dialog?.kind === 'module'} onOpenChange={() => setDialog(null)} title="Add a module" size="sm">
        <ModuleForm courseId={courseId} onDone={() => setDialog(null)} />
      </Dialog>
      <Dialog open={dialog?.kind === 'lesson'} onOpenChange={() => setDialog(null)} title="Add a lesson" size="lg">
        {dialog?.kind === 'lesson' && <LessonForm moduleId={dialog.moduleId} onDone={() => setDialog(null)} />}
      </Dialog>
    </Page>
  );
}
