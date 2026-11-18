import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Flag, Loader2, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Mark } from '@/app/Brand';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AnswerQueue } from '@/lib/answerQueue';
import { clock, cn, marks, plural } from '@/lib/format';
import type { AssignedTest, QuestionType } from '@/lib/types';
import { Material } from '@/ui/Material';
import { Bubble, Button, ErrorNote, Field, Input, LinkButton, Spinner, Textarea } from '@/ui/core';
import { ConfirmDialog, toast } from '@/ui/overlay';

interface SitQuestion {
  id: string;
  text: string;
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  options: { id: string; text: string }[];
}

interface Sitting {
  attempt: {
    id: string;
    serverNow: string;
    deadline: string;
    test: {
      id: string;
      title: string;
      durationMinutes: number;
      totalMarks: number;
      negativeMarks: number;
      showResultImmediately: boolean;
      course?: { id: string; name: string };
    };
  };
  questions: { orderIndex: number; question: SitQuestion }[];
  answers: { questionId: string; optionId: string | null; answerJson: unknown }[];
}

/** One answer as the candidate holds it; empty fields mean "left blank". */
interface Answer {
  optionId?: string;
  optionIds?: string[];
  text?: string;
}

const LETTERS = 'ABCDEFGH';
const isAnswered = (a: Answer | undefined) => !!a && (!!a.optionId || !!a.optionIds?.length || !!a.text?.trim());

const fromSaved = (saved: Sitting['answers'][number]): Answer => {
  const json = saved.answerJson;
  if (saved.optionId) return { optionId: saved.optionId };
  if (typeof json === 'string') return { text: json };
  if (json && typeof json === 'object') {
    const value = json as { optionIds?: string[]; text?: string };
    if (Array.isArray(value.optionIds)) return { optionIds: value.optionIds };
    if (typeof value.text === 'string') return { text: value.text };
  }
  return {};
};

/** What the API stores for an answer. A blank answer sends neither field, which clears it. */
const toPayload = (questionId: string, type: QuestionType, answer: Answer) => ({
  questionId,
  ...(answer.optionId ? { optionId: answer.optionId } : {}),
  ...(type === 'MULTIPLE' && answer.optionIds?.length ? { answerJson: { optionIds: answer.optionIds } } : {}),
  ...(answer.text?.trim() ? { answerJson: answer.text } : {}),
});

function Briefing({ test, onStart, starting, error }: { test: AssignedTest; onStart: (password?: string) => void; starting: boolean; error: string | null }) {
  const [password, setPassword] = useState('');
  const rules = [
    `You have ${test.durationMinutes} minutes. The clock starts when you press Start and does not pause.`,
    `${plural(test.questionCount, 'question')} for ${marks(test.totalMarks)} marks. You pass at ${marks(test.passingMarks)}.`,
    test.negativeMarks > 0
      ? `Each wrong answer costs ${marks(test.negativeMarks)} marks. A blank answer costs nothing.`
      : 'There is no negative marking. Answer every question.',
    'Answers are saved as you fill the sheet. If you lose your connection, sign in again and continue.',
    'Leaving this tab, copying and pasting are recorded for the invigilator.',
  ];
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/tests" className="text-sm text-ink-2 hover:text-ink">
        Back to tests
      </Link>
      <p className="mt-8 text-base text-ink-2">{test.course ? `${test.course.code} ${test.course.name}` : 'Test'}</p>
      <h1 className="display mt-1 text-4xl text-ink sm:text-5xl">{test.title}</h1>
      {test.description && <p className="mt-4 text-md leading-relaxed text-ink-2">{test.description}</p>}
      <ol className="mt-10 border-t-[1.5px] border-ink">
        {rules.map((rule, index) => (
          <li key={rule} className="flex gap-4 border-b border-rule py-3.5 text-md text-ink">
            <span className="nums w-5 shrink-0 text-ink-3">{index + 1}</span>
            {rule}
          </li>
        ))}
      </ol>
      {error && (
        <div className="mt-6">
          <ErrorNote message={error} />
        </div>
      )}
      {test.requiresPassword && <Field className="mt-6" label="Test password" htmlFor="test-password"><Input id="test-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="off" /></Field>}
      <div className="mt-8 flex items-center gap-4">
        <Button size="lg" onClick={() => onStart(password)} loading={starting} disabled={!test.canAttempt}>
          Start the clock
        </Button>
        {!test.canAttempt && <span className="text-base text-ink-2">This test is not open to you right now.</span>}
      </div>
    </div>
  );
}

export function Exam() {
  const { testId } = useParams();
  const user = useAuth((state) => state.user);
  const ready = useAuth((state) => state.ready);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const assigned = useQuery({
    queryKey: ['tests', 'assigned'],
    queryFn: () => api.get<{ items: AssignedTest[] }>('/tests/assigned'),
    enabled: !!user,
  });
  const test = assigned.data?.items.find((t) => t.id === testId);

  const [sitting, setSitting] = useState<Sitting | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const clockOffset = useRef(0);
  const submitLock = useRef(false);
  const finished = useRef(false);

  const questions = useMemo(() => sitting?.questions.map((q) => q.question) ?? [], [sitting]);
  const current = questions[index];
  const attemptId = sitting?.attempt.id;

  const leave = useCallback(
    (id: string) => {
      finished.current = true;
      void queryClient.invalidateQueries({ queryKey: ['tests'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      navigate(`/results/${id}`, { replace: true });
    },
    [navigate, queryClient],
  );

  const start = async (password?: string) => {
    setStarting(true);
    setStartError(null);
    try {
      const data = await api.post<Sitting>(`/tests/${testId}/start`, { password });
      clockOffset.current = Date.parse(data.attempt.serverNow) - Date.now();
      setAnswers(Object.fromEntries(data.answers.map((a) => [a.questionId, fromSaved(a)])));
      setSitting(data);
    } catch (error) {
      setStartError(errorMessage(error));
    } finally {
      setStarting(false);
    }
  };

  const queue = useMemo(() => new AnswerQueue<ReturnType<typeof toPayload>>(
    async (_id, payload) => {
      await api.put(`/attempts/${attemptId}/answers`, payload);
    },
    error => {
      setSaveState('failed');
      if (error instanceof ApiError && error.status === 409 && attemptId) leave(attemptId);
    },
  ), [attemptId, leave]);

  useEffect(() => () => { queue.dispose(); }, [queue]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (queue.dirty) { event.preventDefault(); event.returnValue = ''; }
    };
    const retry = () => { void queue.flush().then(() => setSaveState('saved')).catch(() => setSaveState('failed')); };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('online', retry);
    const timer = setInterval(() => {
      if (!queue.dirty) setSaveState('saved');
    }, 500);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, [queue]);

  const submit = useCallback(async () => {
    if (!attemptId || finished.current || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await queue.flush();
      await api.post(`/attempts/${attemptId}/submit`);
      toast.done('Test submitted');
      leave(attemptId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return leave(attemptId);
      setSubmitting(false);
      setConfirming(false);
      toast.error(errorMessage(error));
    } finally {
      submitLock.current = false;
    }
  }, [attemptId, leave, queue]);

  const choose = (question: SitQuestion, answer: Answer, debounce = false) => {
    if (submitLock.current || finished.current || !attemptId) return;
    setAnswers(all => ({ ...all, [question.id]: answer }));
    setSaveState('saving');
    queue.set(question.id, toPayload(question.id, question.type, answer), debounce ? 700 : 0);
  };

  const pick = (question: SitQuestion, optionId: string) => {
    if (question.type === 'MULTIPLE') {
      const held = answers[question.id]?.optionIds ?? [];
      choose(question, { optionIds: held.includes(optionId) ? held.filter((id) => id !== optionId) : [...held, optionId] });
    } else {
      choose(question, { optionId });
    }
  };

  // The countdown follows the server's clock, so a wrong device clock cannot add time.
  useEffect(() => {
    if (!sitting) return;
    const deadline = Date.parse(sitting.attempt.deadline);
    const tick = () => {
      const left = Math.floor((deadline - (Date.now() + clockOffset.current)) / 1000);
      setRemaining(left);
      if (left <= 0) void submit();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sitting, submit]);

  // What the invigilator sees: leaving the tab, copying, pasting.
  useEffect(() => {
    if (!attemptId) return;
    const report = (type: string) => {
      if (finished.current) return;
      void api.post(`/attempts/${attemptId}/events`, { type }).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.hidden) {
        report('TAB_SWITCH');
        toast.error('You left the test tab. This has been recorded.');
      }
    };
    const onCopy = () => report('COPY');
    const onPaste = () => report('PASTE');
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [attemptId]);

  // Arrow keys move between questions; A to H fill a bubble.
  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(questions.length - 1, i + 1));
      else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else {
        const option = current.options[LETTERS.indexOf(event.key.toUpperCase())];
        if (option && event.key.length === 1) pick(current, option.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, questions.length, answers]);

  if (!ready) return <Spinner label="Restoring your session" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: `/tests/${testId}/sit` }} replace />;

  if (!sitting) {
    if (assigned.isLoading) return <div className="px-6"><Spinner label="Opening the test" /></div>;
    if (assigned.isError) return <div className="p-6"><ErrorNote message={errorMessage(assigned.error)} onRetry={() => void assigned.refetch()} /></div>;
    if (!test) {
      return (
        <div className="mx-auto max-w-md px-6 py-24">
          <h1 className="display text-3xl text-ink">This test is not assigned to you.</h1>
          <p className="mt-2 text-md text-ink-2">It may have been closed or unpublished.</p>
          <LinkButton to="/tests" className="mt-6">
            Back to tests
          </LinkButton>
        </div>
      );
    }
    return <Briefing test={test} onStart={start} starting={starting} error={startError} />;
  }

  const answered = questions.filter((q) => isAnswered(answers[q.id])).length;
  const held = answers[current.id];
  const low = remaining <= 300;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-rule bg-paper px-4 sm:px-6">
        <Mark />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-ink">{sitting.attempt.test.title}</div>
          <div className="truncate text-xs text-ink-3">{sitting.attempt.test.course?.name}</div>
        </div>
        <span className="hidden items-center gap-1.5 text-sm text-ink-2 sm:flex" aria-live="polite">
          {saveState === 'saving' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Saving
            </>
          ) : saveState === 'failed' ? (
            <>
              <TriangleAlert className="size-3.5 text-red" aria-hidden />
              <span className="text-red">Not saved. Check your connection.</span>
            </>
          ) : (
            <>
              <Check className="size-3.5 text-tick" strokeWidth={3} aria-hidden /> Saved
            </>
          )}
        </span>
        <div
          role="timer"
          aria-label="Time remaining"
          className={cn('display nums rounded-md px-3 py-1 text-2xl', low ? 'bg-red-wash text-red' : 'text-ink')}
        >
          {clock(remaining)}
        </div>
        <Button loading={submitting} onClick={() => setConfirming(true)}>Submit test</Button>
      </header>

      <div className="mx-auto grid w-full max-w-page flex-1 gap-x-12 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:px-10">
        <main>
          <div className="flex items-baseline justify-between gap-4 border-b-[1.5px] border-ink pb-2">
            <h1 className="display text-2xl text-ink">
              Question {index + 1} <span className="font-normal text-ink-3">of {questions.length}</span>
            </h1>
            <p className="nums text-base text-ink-2">
              {plural(current.marks, 'mark')}
              {current.negativeMarks > 0 && <span className="text-red">, {marks(current.negativeMarks)} off if wrong</span>}
            </p>
          </div>

          <div className="py-6">
            <Material className="max-w-measure">{current.text}</Material>
            {current.type === 'MULTIPLE' && <p className="mt-3 text-sm text-ink-2">More than one option may be correct.</p>}
          </div>

          {current.options.length > 0 ? (
            <ul className="max-w-measure space-y-2" role={current.type === 'MULTIPLE' ? 'group' : 'radiogroup'} aria-label="Options">
              {current.options.map((option, i) => {
                const chosen = current.type === 'MULTIPLE' ? !!held?.optionIds?.includes(option.id) : held?.optionId === option.id;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role={current.type === 'MULTIPLE' ? 'checkbox' : 'radio'}
                      aria-checked={chosen}
                      onClick={() => pick(current, option.id)}
                      className={cn(
                        'flex w-full items-start gap-3.5 rounded-lg border px-3.5 py-3 text-left transition-colors',
                        chosen ? 'border-pen bg-pen-wash' : 'border-rule hover:border-ink-3',
                      )}
                    >
                      <Bubble letter={LETTERS[i]} state={chosen ? 'filled' : 'blank'} />
                      <span className="pt-0.5 font-serif text-md leading-relaxed text-ink">{option.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Textarea
              rows={current.type === 'FILL_BLANK' ? 2 : 9}
              value={held?.text ?? ''}
              onChange={(event) => choose(current, { text: event.target.value }, true)}
              placeholder={current.type === 'FILL_BLANK' ? 'Type the missing word or value' : 'Write your answer'}
              aria-label="Your answer"
              className={cn('max-w-measure text-md', current.type === 'CODING' && 'font-mono text-base')}
            />
          )}

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setIndex(index - 1)} disabled={index === 0}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Button>
            <Button variant="ghost" onClick={() => choose(current, {})} disabled={!isAnswered(held)}>
              Clear answer
            </Button>
            <Button
              variant="ghost"
              aria-pressed={flagged.has(current.id)}
              onClick={() =>
                setFlagged((set) => {
                  const next = new Set(set);
                  if (!next.delete(current.id)) next.add(current.id);
                  return next;
                })
              }
            >
              <Flag className={cn('size-4', flagged.has(current.id) && 'fill-red text-red')} aria-hidden />
              {flagged.has(current.id) ? 'Marked for review' : 'Mark for review'}
            </Button>
            <Button className="ml-auto" onClick={() => setIndex(index + 1)} disabled={index === questions.length - 1}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </main>

        {/* The answer sheet: one bubble per question, filled once it is answered. */}
        <aside className="mt-10 lg:mt-0">
          <div className="lg:sticky lg:top-24">
            <div className="flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
              <h2 className="text-base font-semibold text-ink">Answer sheet</h2>
              <span className="nums text-sm text-ink-2">
                {answered} of {questions.length} filled
              </span>
            </div>
            <ol className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-2">
              {questions.map((question, i) => {
                const filled = isAnswered(answers[question.id]);
                return (
                  <li key={question.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Question ${i + 1}, ${filled ? 'answered' : 'blank'}${flagged.has(question.id) ? ', marked for review' : ''}`}
                      aria-current={i === index}
                      className={cn(
                        'nums flex size-9 items-center justify-center rounded-full border-[1.5px] text-sm font-semibold transition-colors',
                        filled ? 'border-pen bg-pen text-white' : 'border-ink-3 text-ink-2 hover:border-ink',
                        i === index && 'ring-2 ring-ink ring-offset-2',
                      )}
                    >
                      {i + 1}
                    </button>
                    {flagged.has(question.id) && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red ring-2 ring-paper" aria-hidden />}
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 text-sm leading-relaxed text-ink-3">
              Filled bubbles are answered. A red dot is a question you marked for review. Arrow keys move between
              questions, letters fill a bubble.
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Submit this test?"
        confirmLabel="Submit test"
        onConfirm={submit}
        busy={submitting}
      >
        You have answered {answered} of {questions.length} questions
        {questions.length - answered > 0 && `, and left ${questions.length - answered} blank`}
        {flagged.size > 0 && `. ${plural(flagged.size, 'question')} still marked for review`}. You cannot change your
        answers after submitting.
      </ConfirmDialog>
    </div>
  );
}
