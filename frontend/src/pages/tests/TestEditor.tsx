import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { cn, marks, plural, titleCase } from '@/lib/format';
import type { Course, Difficulty, Paged } from '@/lib/types';
import { DIFFICULTIES, TYPE_LABEL, type Question, type QuestionBank } from '@/pages/questions/shared';
import { Button, Checkbox, ErrorNote, Field, Input, LinkButton, PageHeader, SectionTitle, Select, Spinner, Tabs, Textarea } from '@/ui/core';
import { toast } from '@/ui/overlay';

const MODES = ['QUIZ', 'MIDTERM', 'FINAL', 'PRACTICE', 'MOCK_TEST', 'CERTIFICATION'];
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function TestEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: () => api.get<Paged<Course>>('/courses', { limit: 100 }) });
  const banks = useQuery({ queryKey: ['banks'], queryFn: () => api.get<Paged<QuestionBank>>('/question-banks', { limit: 100 }) });
  const questions = useQuery({ queryKey: ['questions', 'picker'], queryFn: () => api.get<Paged<Question>>('/questions', { limit: 100 }) });

  const [form, setForm] = useState({
    title: '',
    description: '',
    courseId: '',
    examMode: 'QUIZ',
    durationMinutes: 30,
    passingMarks: 8,
    negativeMarks: 0,
    maxAttempts: 1,
    startAt: '',
    endAt: '',
    shuffleQuestions: false,
    randomOptionOrder: true,
    showResultImmediately: true,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const [source, setSource] = useState<'pick' | 'bank'>('pick');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [bankId, setBankId] = useState('');
  const [draw, setDraw] = useState<Record<Difficulty, number>>({ EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = questions.data?.items ?? [];
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? all.filter((q) => q.text.toLowerCase().includes(term) || q.topic?.toLowerCase().includes(term)) : all;
  }, [all, search]);
  const pickedMarks = all.filter((q) => picked.has(q.id)).reduce((n, q) => n + q.marks, 0);
  const drawn = Object.values(draw).reduce((n, v) => n + v, 0);
  const ready = form.title.trim() && (source === 'pick' ? picked.size > 0 : bankId && drawn > 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const timing = { startAt: toIso(form.startAt), endAt: toIso(form.endAt) };
      const base = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        courseId: form.courseId || undefined,
        durationMinutes: form.durationMinutes,
        passingMarks: form.passingMarks,
        negativeMarks: form.negativeMarks,
        maxAttempts: form.maxAttempts,
        shuffleQuestions: form.shuffleQuestions,
      };
      const rest = { ...timing, examMode: form.examMode, randomOptionOrder: form.randomOptionOrder, showResultImmediately: form.showResultImmediately };
      let id: string;
      if (source === 'pick') {
        const created = await api.post<{ test: { id: string } }>('/tests', { ...base, ...rest, questionIds: [...picked] });
        id = created.test.id;
      } else {
        const config = DIFFICULTIES.filter((d) => draw[d] > 0).map((difficulty) => ({ difficulty, count: draw[difficulty] }));
        const created = await api.post<{ test: { id: string } }>(`/question-banks/${bankId}/generate-test`, { ...base, config });
        id = created.test.id;
        // Drawing from a bank sets the paper; the window and display settings follow.
        await api.put(`/tests/${id}`, rest);
      }
      await queryClient.invalidateQueries({ queryKey: ['tests'] });
      toast.done('Test created as a draft');
      navigate(`/tests/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader back={{ to: '/tests', label: 'All tests' }} title="New test" description="It is saved as a draft. Nothing reaches students until you publish it and assign it." />
      <form onSubmit={submit} className="grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Paper</SectionTitle>
          <Field label="Title" htmlFor="t-title">
            <Input id="t-title" required value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
          </Field>
          <Field label="Instructions" htmlFor="t-description" hint="Shown to candidates before they start.">
            <Textarea id="t-description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Course" htmlFor="t-course">
              <Select id="t-course" value={form.courseId} onChange={(e) => set('courseId', e.target.value)}>
                <option value="">No course</option>
                {courses.data?.items.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kind" htmlFor="t-mode">
              <Select id="t-mode" value={form.examMode} onChange={(e) => set('examMode', e.target.value)}>
                {MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {titleCase(mode)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Minutes" htmlFor="t-duration">
              <Input id="t-duration" type="number" min={1} max={1440} value={form.durationMinutes} onChange={(e) => set('durationMinutes', Number(e.target.value))} />
            </Field>
            <Field label="Attempts allowed" htmlFor="t-attempts">
              <Input id="t-attempts" type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => set('maxAttempts', Number(e.target.value))} />
            </Field>
            <Field label="Pass mark" htmlFor="t-pass">
              <Input id="t-pass" type="number" min={0} step={0.5} value={form.passingMarks} onChange={(e) => set('passingMarks', Number(e.target.value))} />
            </Field>
            <Field label="Off per wrong answer" htmlFor="t-negative">
              <Input id="t-negative" type="number" min={0} step={0.25} value={form.negativeMarks} onChange={(e) => set('negativeMarks', Number(e.target.value))} />
            </Field>
            <Field label="Opens" htmlFor="t-start" hint="Blank opens on publish.">
              <Input id="t-start" type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
            </Field>
            <Field label="Closes" htmlFor="t-end" hint="Blank never closes.">
              <Input id="t-end" type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
            </Field>
          </div>
          <div className="space-y-2.5 pt-2">
            <Checkbox checked={form.shuffleQuestions} onChange={(v) => set('shuffleQuestions', v)} label="Give each candidate the questions in a different order" />
            <Checkbox checked={form.randomOptionOrder} onChange={(v) => set('randomOptionOrder', v)} label="Shuffle the options of each question" />
            <Checkbox checked={form.showResultImmediately} onChange={(v) => set('showResultImmediately', v)} label="Show the result as soon as the test is submitted" />
          </div>
        </div>

        <div className="min-w-0">
          <SectionTitle
            aside={
              source === 'pick'
                ? `${plural(picked.size, 'question')}, ${marks(pickedMarks)} marks`
                : `${plural(drawn, 'question')} to draw`
            }
          >
            Questions
          </SectionTitle>
          <Tabs
            value={source}
            onChange={setSource}
            items={[
              { value: 'pick', label: 'Pick questions' },
              { value: 'bank', label: 'Draw from a bank' },
            ]}
          />
          {source === 'pick' ? (
            <div className="pt-4">
              <Input type="search" placeholder="Filter by text or topic" aria-label="Filter questions" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />
              {questions.isLoading ? (
                <Spinner />
              ) : shown.length ? (
                <ul className="max-h-[32rem] overflow-y-auto border-y border-rule">
                  {shown.map((question) => {
                    const on = picked.has(question.id);
                    return (
                      <li key={question.id} className={cn('border-b border-rule-2 px-2 py-2.5 last:border-0', on && 'bg-pen-wash')}>
                        <Checkbox
                          checked={on}
                          onChange={() =>
                            setPicked((set) => {
                              const next = new Set(set);
                              if (!next.delete(question.id)) next.add(question.id);
                              return next;
                            })
                          }
                          label={
                            <span>
                              <span className="line-clamp-2 font-serif text-[0.9375rem] leading-snug text-ink">{question.text}</span>
                              <span className="nums mt-0.5 block text-sm text-ink-3">
                                {[question.topic, TYPE_LABEL[question.type], titleCase(question.difficulty), `${marks(question.marks)} marks`].filter(Boolean).join(', ')}
                              </span>
                            </span>
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-4 text-base text-ink-2">
                  No question matches. Write some in the <LinkButton to="/questions" variant="ghost" size="sm">question studio</LinkButton> first.
                </p>
              )}
            </div>
          ) : (
            <div className="max-w-md space-y-4 pt-4">
              <Field label="Bank" htmlFor="t-bank">
                <Select id="t-bank" value={bankId} onChange={(e) => setBankId(e.target.value)}>
                  <option value="">Choose a bank</option>
                  {banks.data?.items.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name} ({bank._count.questions})
                    </option>
                  ))}
                </Select>
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">How many to draw at each difficulty</legend>
                <div className="grid grid-cols-4 gap-3">
                  {DIFFICULTIES.map((difficulty) => (
                    <Field key={difficulty} label={titleCase(difficulty)} htmlFor={`draw-${difficulty}`}>
                      <Input
                        id={`draw-${difficulty}`}
                        type="number"
                        min={0}
                        max={100}
                        value={draw[difficulty]}
                        onChange={(e) => setDraw((d) => ({ ...d, [difficulty]: Number(e.target.value) }))}
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
              <p className="text-base text-ink-2">Questions are drawn at random when the test is created. Total marks are added up from the questions drawn.</p>
            </div>
          )}

          {error && (
            <div className="mt-6">
              <ErrorNote message={error} />
            </div>
          )}
          <div className="mt-8 flex gap-2">
            <Button type="submit" size="lg" loading={busy} disabled={!ready}>
              Create draft
            </Button>
            <LinkButton to="/tests" variant="ghost" size="lg">
              Cancel
            </LinkButton>
          </div>
        </div>
      </form>
    </Page>
  );
}
