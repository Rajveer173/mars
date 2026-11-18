import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useAiStatus } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { plural, titleCase } from '@/lib/format';
import { streamRun, upsertStep, type Step } from '@/lib/stream';
import type { Course, Paged } from '@/lib/types';
import { Button, ErrorNote, Field, Input, Select } from '@/ui/core';
import { AGENT_JOB, AgentTrace, SourceNotes, type Source } from '@/ui/trace';
import { DIFFICULTIES, QuestionPaper, type Question, type QuestionBank } from './shared';

interface Rejected {
  text: string;
  options: string[];
  correct: number[];
  reason: string;
}

interface Outcome {
  accepted: Question[];
  rejected: Rejected[];
  sources: Source[];
}

const AUTHORED = [
  { value: 'SINGLE', label: 'Single answer' },
  { value: 'MULTIPLE', label: 'Multiple answers' },
  { value: 'TRUE_FALSE', label: 'True or false' },
];

/**
 * The author pipeline: Retriever, Examiner, Reviewer, Librarian. The page shows
 * the run as it happens and then both piles, kept and rejected, because the
 * rejections are the proof that the review did something.
 */
export function Draft() {
  const queryClient = useQueryClient();
  const status = useAiStatus();
  const connected = status.data?.chat.connected ?? true;
  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: () => api.get<Paged<Course>>('/courses', { limit: 100 }) });
  const banks = useQuery({ queryKey: ['banks'], queryFn: () => api.get<Paged<QuestionBank>>('/question-banks', { limit: 100 }) });

  const [form, setForm] = useState({ courseId: '', topic: '', count: 5, type: 'SINGLE', difficulty: 'MEDIUM', marks: 1, bankId: '' });
  const [steps, setSteps] = useState<Step[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const run = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setOutcome(null);
    setSteps([]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      let failure: string | null = null;
      await streamRun(
        '/ai/questions/generate',
        { ...form, bankId: form.bankId || undefined },
        (e) => {
          if (e.type === 'step') setSteps((s) => upsertStep(s, e.step));
          else if (e.type === 'done') setOutcome(e.data as Outcome);
          else if (e.type === 'error') failure = e.message;
        },
        controller.signal,
      );
      if (failure) setError(failure);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['questions'] }), queryClient.invalidateQueries({ queryKey: ['banks'] })]);
    } catch (err) {
      if (!controller.signal.aborted) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-x-14 gap-y-10 pt-8 lg:grid-cols-[21rem_minmax(0,1fr)]">
      <form onSubmit={run} className="space-y-4 self-start">
        <Field label="Course" htmlFor="draft-course" hint="Questions are written only from this course's passages.">
          <Select id="draft-course" required value={form.courseId} onChange={(e) => set('courseId', e.target.value)}>
            <option value="">Choose a course</option>
            {courses.data?.items.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} {course.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Topic" htmlFor="draft-topic" hint="Name it the way the lessons do.">
          <Input id="draft-topic" required value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="Deadlock prevention" maxLength={160} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Questions" htmlFor="draft-count">
            <Input id="draft-count" type="number" min={1} max={10} value={form.count} onChange={(e) => set('count', Number(e.target.value))} />
          </Field>
          <Field label="Marks each" htmlFor="draft-marks">
            <Input id="draft-marks" type="number" min={0.5} max={20} step={0.5} value={form.marks} onChange={(e) => set('marks', Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" htmlFor="draft-type">
            <Select id="draft-type" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {AUTHORED.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty" htmlFor="draft-difficulty">
            <Select id="draft-difficulty" value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {titleCase(d)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="File into" htmlFor="draft-bank" hint="Accepted questions always go to your question list.">
          <Select id="draft-bank" value={form.bankId} onChange={(e) => set('bankId', e.target.value)}>
            <option value="">Question list only</option>
            {banks.data?.items.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.name}
              </option>
            ))}
          </Select>
        </Field>
        {!connected && <p className="text-base text-red">No model is connected. Set LLM_API_KEY to draft questions.</p>}
        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={busy} disabled={!connected || !form.courseId || form.topic.trim().length < 2}>
            Draft questions
          </Button>
          {busy && (
            <Button variant="ghost" onClick={() => abort.current?.abort()}>
              Stop
            </Button>
          )}
        </div>
      </form>

      <div className="min-w-0">
        {!steps.length && !error ? (
          <div className="max-w-xl">
            <h2 className="display text-2xl text-ink">Two agents have to agree before a question is kept.</h2>
            <dl className="mt-5 border-t-[1.5px] border-ink">
              {(['retriever', 'examiner', 'reviewer', 'librarian'] as const).map((agent) => (
                <div key={agent} className="grid grid-cols-[6.5rem_1fr] gap-x-4 border-b border-rule py-3 text-base">
                  <dt className="font-semibold text-ink">{titleCase(agent)}</dt>
                  <dd className="leading-relaxed text-ink-2">{AGENT_JOB[agent]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="grid gap-x-12 gap-y-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="min-w-0">
              {error && <ErrorNote message={error} />}
              {outcome && (
                <>
                  <h2 className="display text-2xl text-ink">
                    {outcome.accepted.length} kept, {outcome.rejected.length} rejected
                  </h2>
                  <p className="mt-1 text-base text-ink-2">
                    {outcome.accepted.length
                      ? `${plural(outcome.accepted.length, 'question')} passed review and ${outcome.accepted.length === 1 ? 'is' : 'are'} in your question list.`
                      : 'No question passed review. Try a narrower topic, or add material that covers it.'}
                  </p>
                  {outcome.accepted.length > 0 && (
                    <ol className="mt-5 border-t-[1.5px] border-ink">
                      {outcome.accepted.map((question, i) => (
                        <li key={question.id} className="border-b border-rule py-5">
                          <QuestionPaper question={question} number={i + 1} />
                        </li>
                      ))}
                    </ol>
                  )}
                  {outcome.rejected.length > 0 && (
                    <>
                      <h3 className="mt-10 text-md font-semibold text-ink">Rejected by review</h3>
                      <ul className="mt-2 border-t border-rule">
                        {outcome.rejected.map((item) => (
                          <li key={item.text} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 border-b border-rule py-4">
                            <X className="mt-1 size-4 text-red" strokeWidth={3} aria-hidden />
                            <div>
                              <p className="font-serif text-[0.9375rem] leading-relaxed text-ink-2 line-through decoration-red/40">{item.text}</p>
                              <p className="mt-1 text-base text-red">{item.reason}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
              {busy && !outcome && (
                <p className="flex items-center gap-2 text-base text-ink-2">
                  <span className="size-2 animate-pulse-dot rounded-full bg-pen" aria-hidden />
                  {steps.at(-1)?.title ?? 'Starting the run'}
                </p>
              )}
            </div>
            <aside className="space-y-8">
              <div>
                <h3 className="mb-3 text-base font-semibold text-ink">Run sheet</h3>
                <AgentTrace steps={steps} />
              </div>
              {!!outcome?.sources.length && (
                <div>
                  <h3 className="mb-3 text-base font-semibold text-ink">Passages used</h3>
                  <SourceNotes sources={outcome.sources} active={active} onSelect={setActive} />
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
