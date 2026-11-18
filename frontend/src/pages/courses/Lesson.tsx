import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { cn } from '@/lib/format';
import type { ModuleOutline } from '@/lib/types';
import { Material } from '@/ui/Material';
import { Button, ErrorNote, LinkButton, Spinner } from '@/ui/core';
import { ConfirmDialog, Dialog, toast } from '@/ui/overlay';
import { LessonForm } from './CourseDetail';

interface LessonData {
  id: string;
  title: string;
  content: string | null;
  durationMin: number | null;
  module: { id: string; title: string; courseId: string };
}

export function Lesson() {
  const { lessonId = '' } = useParams();
  const user = useAuth((state) => state.user)!;
  const staff = isStaffRole(user.role);
  const student = user.role === 'STUDENT';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const lesson = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api.get<{ lesson: LessonData }>(`/lessons/${lessonId}`) });
  const courseId = lesson.data?.lesson.module.courseId;
  const outline = useQuery({
    queryKey: ['course', courseId, 'modules'],
    queryFn: () => api.get<{ modules: ModuleOutline[] }>(`/courses/${courseId}/modules`),
    enabled: !!courseId,
  });
  const progress = useQuery({
    queryKey: ['course', courseId, 'progress'],
    queryFn: () => api.get<{ progress: { lessonId: string; completed: boolean }[] }>(`/courses/${courseId}/lesson-progress`),
    enabled: !!courseId && student,
  });

  if (lesson.isLoading) return <Page><Spinner label="Opening the lesson" /></Page>;
  if (lesson.isError || !lesson.data) return <Page><ErrorNote message={errorMessage(lesson.error)} /></Page>;

  const data = lesson.data.lesson;
  const modules = outline.data?.modules ?? [];
  const sequence = modules.flatMap((m) => m.lessons);
  const position = sequence.findIndex((l) => l.id === data.id);
  const previous = sequence[position - 1];
  const next = sequence[position + 1];
  const done = new Set(progress.data?.progress.filter((p) => p.completed).map((p) => p.lessonId));
  const read = done.has(data.id);

  const markRead = async () => {
    setBusy(true);
    try {
      await api.post(`/lessons/${data.id}/complete`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['course', courseId] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      ]);
      if (next) navigate(`/lessons/${next.id}`);
      else toast.done('Lesson marked as read');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/lessons/${data.id}`);
      await queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.done('Lesson deleted');
      navigate(`/courses/${courseId}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  };

  return (
    <Page>
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <article className="min-w-0">
          <Link to={`/courses/${courseId}`} className="text-sm text-ink-2 hover:text-ink">
            {data.module.title}
          </Link>
          <h1 className="display mt-2 text-4xl text-ink">{data.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-ink-2">
            {data.durationMin != null && <span className="nums">{data.durationMin} minute read</span>}
            {student && read && (
              <span className="inline-flex items-center gap-1 text-tick">
                <Check className="size-4" strokeWidth={3} aria-hidden /> Read
              </span>
            )}
            <Link to={`/ask?course=${courseId}`} className="font-medium text-pen hover:underline">
              Ask about this lesson
            </Link>
            {staff && (
              <>
                <button onClick={() => setEditing(true)} className="font-medium text-pen hover:underline">
                  Edit lesson
                </button>
                <button onClick={() => setDeleting(true)} className="font-medium text-red hover:underline">
                  Delete
                </button>
              </>
            )}
          </div>

          <div className="mt-8 border-t-[1.5px] border-ink pt-8">
            {data.content?.trim() ? (
              <Material className="max-w-measure">{data.content}</Material>
            ) : (
              <p className="text-md text-ink-2">This lesson has no text yet.</p>
            )}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-rule pt-6">
            {previous && (
              <LinkButton to={`/lessons/${previous.id}`} variant="secondary">
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </LinkButton>
            )}
            <div className="ml-auto flex gap-3">
              {student && !read ? (
                <Button onClick={markRead} loading={busy}>
                  {next ? 'Mark as read and continue' : 'Mark as read'}
                </Button>
              ) : (
                next && (
                  <LinkButton to={`/lessons/${next.id}`}>
                    Next lesson <ChevronRight className="size-4" aria-hidden />
                  </LinkButton>
                )
              )}
            </div>
          </div>
        </article>

        <aside className="hidden lg:block">
          <nav className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto text-base" aria-label="Course outline">
            {modules.map((module) => (
              <div key={module.id} className="mb-5">
                <div className="mb-1 text-sm font-medium text-ink-3">{module.title}</div>
                <ol>
                  {module.lessons.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={`/lessons/${item.id}`}
                        aria-current={item.id === data.id ? 'page' : undefined}
                        className={cn('flex items-start gap-2 py-1 leading-snug', item.id === data.id ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink')}
                      >
                        <span className="mt-1.5 flex size-3 shrink-0 items-center justify-center">
                          {done.has(item.id) ? <Check className="size-3 text-tick" strokeWidth={3.5} /> : <span className="size-1 rounded-full bg-rule" />}
                        </span>
                        <span className={cn(item.id === data.id && 'hl')}>{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </nav>
        </aside>
      </div>

      <Dialog open={editing} onOpenChange={setEditing} title="Edit lesson" size="lg">
        <LessonForm
          lesson={{ id: data.id, title: data.title, durationMin: data.durationMin, content: data.content ?? '' }}
          onDone={() => setEditing(false)}
        />
      </Dialog>
      <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Delete this lesson?" confirmLabel="Delete lesson" onConfirm={remove} busy={busy} danger>
        The lesson and its passages in the knowledge base are removed. Answers that cited it keep their text but lose the link.
      </ConfirmDialog>
    </Page>
  );
}
