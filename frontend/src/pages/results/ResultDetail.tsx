import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, useAiStatus } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { cn, formatDateTime, formatDuration, marks, percent, plural } from '@/lib/format';
import { streamRun, upsertStep, type Step } from '@/lib/stream';
import type { ResultDetail as Detail, ResultQuestion } from '@/lib/types';
import { Material } from '@/ui/Material';
import { BarList } from '@/ui/charts';
import { Bubble, Button, ErrorNote, Figure, FigureRow, Input, PageHeader, SectionTitle, Spinner } from '@/ui/core';
import { toast } from '@/ui/overlay';
import { AgentTrace, SourceNotes, type Source } from '@/ui/trace';

const LETTERS = 'ABCDEFGH';

interface DebriefRun {
  id: string;
  output: string | null;
  createdAt: string;
  steps: Step[];
  sources: Source[];
}

/** The Coach's debrief: what went wrong by topic and what to reread, cited to the lessons. */
function Debrief({ attemptId, own }: { attemptId: string; own: boolean }) {
  const queryClient = useQueryClient();
  const status = useAiStatus();
  const connected = status.data?.chat.connected ?? true;
  const saved = useQuery({
    queryKey: ['ai', 'debrief', attemptId],
    queryFn: () => api.get<{ run: DebriefRun | null }>(`/ai/debrief/${attemptId}`),
  });
  const [live, setLive] = useState<{ text: string; steps: Step[]; error: string | null } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const write = async () => {
    setLive({ text: '', steps: [], error: null });
    const controller = new AbortController();
    abort.current = controller;
    try {
      let failure: string | null = null;
      await streamRun(
        `/ai/debrief/${attemptId}`,
        {},
        (event) => {
          if (event.type === 'step') setLive((s) => s && { ...s, steps: upsertStep(s.steps, event.step) });
          else if (event.type === 'token') setLive((s) => s && { ...s, text: s.text + event.text });
          else if (event.type === 'error') failure = event.message;
        },
        controller.signal,
      );
      if (failure) return setLive((s) => s && { ...s, error: failure });
      await queryClient.invalidateQueries({ queryKey: ['ai', 'debrief', attemptId] });
      setLive(null);
    } catch (error) {
      setLive((s) => s && { ...s, error: errorMessage(error) });
    }
  };

  const run = saved.data?.run ?? null;
  const steps = live?.steps ?? run?.steps ?? [];
  const text = live ? live.text : (run?.output ?? '');
  const liveHits = (live?.steps.find((s) => s.agent === 'retriever')?.detail as { hits?: Source[] } | null)?.hits ?? [];
  const sources = live ? liveHits.map((hit) => ({ ...hit, cited: text.includes(`[${hit.n}`) })) : (run?.sources ?? []);
  const byTopic = (steps.find((s) => s.agent === 'records')?.detail as { byTopic?: { topic: string; percent: number; questions: number }[] } | null)
    ?.byTopic;
  const busy = !!live && !live.error;

  return (
    <section className="mt-12">
      <SectionTitle
        aside={
          run &&
          !live && (
            <button onClick={write} disabled={!connected} className="font-medium text-pen hover:underline disabled:text-ink-3">
              Write it again
            </button>
          )
        }
      >
        Debrief
      </SectionTitle>

      <div className="border-t-[1.5px] border-ink pt-5">
        {saved.isLoading ? (
          <Spinner label="Looking for your debrief" />
        ) : !run && !live ? (
          <div className="max-w-2xl">
            <p className="text-md leading-relaxed text-ink">
              The Coach reads {own ? 'your' : 'this'} marks topic by topic, pulls the lessons that cover the weakest ones, and
              writes what went wrong and what to reread, with each point cited to the lesson.
            </p>
            {connected ? (
              <Button className="mt-4" onClick={write}>
                Write {own ? 'my' : 'the'} debrief
              </Button>
            ) : (
              <p className="mt-3 text-base text-ink-2">No model is connected, so a debrief cannot be written yet.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">
              {byTopic && byTopic.length > 0 && (
                <div className="mb-8 max-w-xl">
                  <BarList
                    rows={byTopic.map((t) => ({ label: t.topic, value: t.percent, note: plural(t.questions, 'question') }))}
                    tone={(value) => (value < 40 ? 'red' : 'ink')}
                  />
                </div>
              )}
              {text ? (
                <Material onCite={setActive} activeCite={active} className="max-w-measure">
                  {text}
                </Material>
              ) : (
                busy && (
                  <p className="flex items-center gap-2 text-base text-ink-2">
                    <span className="size-2 animate-pulse-dot rounded-full bg-pen" aria-hidden />
                    {steps.at(-1)?.title ?? 'Starting the run'}
                  </p>
                )
              )}
              {live?.error && (
                <div className="mt-4 max-w-xl">
                  <ErrorNote message={live.error} onRetry={write} />
                </div>
              )}
              {busy && (
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => abort.current?.abort()}>
                  Stop
                </Button>
              )}
            </div>
            <aside className="space-y-8">
              {sources.length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-semibold text-ink">Lessons it drew on</h3>
                  <SourceNotes sources={sources} active={active} onSelect={setActive} />
                </div>
              )}
              {steps.length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-semibold text-ink">Run sheet</h3>
                  <AgentTrace steps={steps} />
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function GradeBox({ attemptId, question }: { attemptId: string; question: ResultQuestion }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(question.marksObtained?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/attempts/${attemptId}/grade`, { answerId: question.answerId, marks: Number(value) });
      await queryClient.invalidateQueries({ queryKey: ['result', attemptId] });
      toast.done('Marks saved');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={question.marks}
        step={0.5}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Marks awarded"
        className="w-24"
      />
      <span className="text-base text-ink-2">of {marks(question.marks)}</span>
      <Button size="sm" onClick={save} loading={busy} disabled={value === '' || Number(value) > question.marks}>
        Save marks
      </Button>
    </div>
  );
}

function Reviewed({ question, number, attemptId, canGrade }: { question: ResultQuestion; number: number; attemptId: string; canGrade: boolean }) {
  const blank = question.isCorrect === null && !question.options.some((o) => o.selected) && !question.answerJson;
  const awarded = question.marksObtained ?? 0;
  const written = typeof question.answerJson === 'string' ? question.answerJson : (question.answerJson as { text?: string } | null)?.text;

  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_4rem] gap-x-3 border-b border-rule py-6">
      {/* Question number in the left margin, marks in the right: an answer script. */}
      <span className="display nums text-xl text-ink-3">{number}</span>
      <div className="min-w-0">
        <Material small>{question.text}</Material>
        {question.options.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {question.options.map((option, i) => {
              const state = option.selected ? (option.isCorrect ? 'correct' : 'wrong') : option.isCorrect ? 'missed' : 'blank';
              return (
                <li key={option.id} className="flex items-start gap-3">
                  <Bubble letter={LETTERS[i]} state={state} />
                  <span
                    className={cn(
                      'pt-0.5 font-serif text-[0.9375rem] leading-relaxed',
                      state === 'wrong' ? 'text-red line-through decoration-red/50' : state === 'blank' ? 'text-ink-2' : 'text-ink',
                    )}
                  >
                    {option.text}
                    {state === 'missed' && <span className="ml-2 font-sans text-sm text-tick">correct answer</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 rounded-md bg-desk px-3.5 py-3">
            <div className="text-sm text-ink-3">Response</div>
            <p className="mt-1 whitespace-pre-wrap font-serif text-[0.9375rem] leading-relaxed text-pen-deep">{written || 'Left blank'}</p>
          </div>
        )}
        {question.explanation && (
          <p className="mt-3 border-l-[3px] border-mark pl-3 text-base leading-relaxed text-ink-2">{question.explanation}</p>
        )}
        {canGrade && question.requiresManualGrading && question.answerId && <GradeBox attemptId={attemptId} question={question} />}
      </div>
      <div className="nums text-right">
        <div className={cn('display text-xl', awarded < 0 ? 'text-red' : question.isCorrect ? 'text-tick' : 'text-ink-2')}>
          {awarded > 0 ? `+${marks(awarded)}` : marks(awarded)}
        </div>
        <div className="text-sm text-ink-3">
          {blank ? 'blank' : question.requiresManualGrading && question.marksObtained == null ? 'ungraded' : `of ${marks(question.marks)}`}
        </div>
      </div>
    </li>
  );
}

export function ResultDetail() {
  const { attemptId = '' } = useParams();
  const user = useAuth((state) => state.user)!;
  const staff = isStaffRole(user.role);
  const result = useQuery({
    queryKey: ['result', attemptId],
    queryFn: () => api.get<Detail>(`/results/${attemptId}`),
  });

  if (result.isLoading) return <Page><Spinner label="Opening the result" /></Page>;
  if (result.isError || !result.data) {
    return (
      <Page>
        <ErrorNote message={errorMessage(result.error)} onRetry={() => result.refetch()} />
      </Page>
    );
  }

  const { attempt, test, student, questions } = result.data;
  const correct = questions.filter((q) => q.isCorrect).length;
  const wrong = questions.filter((q) => q.isCorrect === false).length;
  const lost = questions.reduce((n, q) => n + Math.min(0, q.marksObtained ?? 0), 0);

  return (
    <Page>
      <PageHeader
        back={{ to: '/results', label: 'All results' }}
        title={test.title}
        description={[test.course?.name, staff ? (student.fullName ?? student.email) : null, `submitted ${formatDateTime(attempt.submittedAt)}`]
          .filter(Boolean)
          .join(', ')}
      />

      <FigureRow>
        <Figure
          label="Marks"
          value={
            <>
              {marks(attempt.score)}
              <span className="text-2xl font-normal text-ink-3"> / {marks(test.totalMarks)}</span>
            </>
          }
          note={`pass mark ${marks(test.passingMarks)}`}
          tone={attempt.passed === false ? 'red' : undefined}
        />
        <Figure
          label="Score"
          value={percent(attempt.percentage)}
          note={attempt.passed == null ? 'awaiting grading' : attempt.passed ? 'passed' : 'below the pass mark'}
          tone={attempt.passed ? 'tick' : attempt.passed === false ? 'red' : undefined}
        />
        <Figure label="Right and wrong" value={`${correct} / ${wrong}`} note={`${questions.length - correct - wrong} blank or ungraded`} />
        <Figure
          label="Time taken"
          value={formatDuration(attempt.timeTakenSeconds)}
          note={lost < 0 ? `${marks(-lost)} marks lost to negative marking` : 'no marks lost to penalties'}
        />
      </FigureRow>

      {staff && attempt.suspiciousEvents.length > 0 && (
        <p className="mt-6 text-base text-red">
          {plural(attempt.suspiciousEvents.length, 'proctoring event')} recorded during this attempt:{' '}
          {[...new Set(attempt.suspiciousEvents.map((e) => e.type.toLowerCase().replace(/_/g, ' ')))].join(', ')}.
        </p>
      )}

      <Debrief attemptId={attemptId} own={!staff} />

      <section className="mt-14">
        <SectionTitle aside={plural(questions.length, 'question')}>Answer review</SectionTitle>
        <ol className="border-t-[1.5px] border-ink">
          {questions.map((question, index) => (
            <Reviewed key={question.questionId} question={question} number={index + 1} attemptId={attemptId} canGrade={staff} />
          ))}
        </ol>
      </section>
    </Page>
  );
}
