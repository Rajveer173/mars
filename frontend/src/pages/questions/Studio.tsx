import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { marks, percent, plural, titleCase } from '@/lib/format';
import type { Course, Difficulty, Paged, QuestionType } from '@/lib/types';
import { Pager } from '@/pages/results/Results';
import {
  Button,
  Checkbox,
  DataTable,
  Empty,
  ErrorNote,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Tag,
  Textarea,
  type Column,
} from '@/ui/core';
import { ConfirmDialog, Dialog, Menu, MenuContent, MenuItem, MenuTrigger, toast } from '@/ui/overlay';
import { Draft } from './Draft';
import { DIFFICULTIES, QuestionPaper, TYPE_LABEL, type Question, type QuestionBank } from './shared';

const EDITABLE_TYPES: QuestionType[] = ['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'FILL_BLANK', 'SUBJECTIVE'];
const blankOptions = () => [0, 1, 2, 3].map(() => ({ text: '', isCorrect: false }));

function QuestionForm({ question, onDone }: { question?: Question; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<QuestionType>(question?.type ?? 'SINGLE');
  const [text, setText] = useState(question?.text ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'MEDIUM');
  const [topic, setTopic] = useState(question?.topic ?? '');
  const [score, setScore] = useState(question?.marks ?? 1);
  const [penalty, setPenalty] = useState(question?.negativeMarks ?? 0);
  const [explanation, setExplanation] = useState(question?.explanation ?? '');
  const [answer, setAnswer] = useState(
    Array.isArray(question?.correctAnswer) ? (question.correctAnswer as string[]).join(', ') : String(question?.correctAnswer ?? ''),
  );
  const [options, setOptions] = useState(
    question?.options.length
      ? [...question.options].sort((a, b) => a.orderIndex - b.orderIndex).map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
      : blankOptions(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOptions = type === 'SINGLE' || type === 'MULTIPLE' || type === 'TRUE_FALSE';
  const changeType = (next: QuestionType) => {
    setType(next);
    if (next === 'TRUE_FALSE') setOptions([{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }]);
    else if (type === 'TRUE_FALSE') setOptions(blankOptions());
  };
  const mark = (index: number, checked: boolean) =>
    setOptions((all) => all.map((o, i) => (type === 'MULTIPLE' ? (i === index ? { ...o, isCorrect: checked } : o) : { ...o, isCorrect: i === index })));

  const filled = options.filter((o) => o.text.trim());
  const correct = filled.filter((o) => o.isCorrect).length;
  const problem = !text.trim()
    ? 'Write the question.'
    : hasOptions && filled.length < 2
      ? 'Give at least two options.'
      : hasOptions && type !== 'MULTIPLE' && correct !== 1
        ? 'Mark exactly one option as correct.'
        : hasOptions && correct < 1
          ? 'Mark at least one option as correct.'
          : type === 'FILL_BLANK' && !answer.trim()
            ? 'Give the accepted answer.'
            : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const body = {
        text: text.trim(),
        type,
        difficulty,
        marks: score,
        negativeMarks: penalty,
        topic: topic.trim() || undefined,
        explanation: explanation.trim() || undefined,
        ...(hasOptions ? { options: filled.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })) } : {}),
        ...(type === 'FILL_BLANK' ? { correctAnswer: answer.split(',').map((a) => a.trim()).filter(Boolean) } : {}),
      };
      if (question) await api.put(`/questions/${question.id}`, body);
      else await api.post('/questions', body);
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.done(question ? 'Question saved' : 'Question added');
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
      <Field label="Question" htmlFor="q-text" hint="Markdown is supported, including code blocks.">
        <Textarea id="q-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} className="font-serif text-md" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" htmlFor="q-type">
          <Select id="q-type" value={type} onChange={(e) => changeType(e.target.value as QuestionType)} disabled={!!question}>
            {EDITABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Difficulty" htmlFor="q-difficulty">
          <Select id="q-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {titleCase(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Topic" htmlFor="q-topic">
          <Input id="q-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />
        </Field>
      </div>

      {hasOptions && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">Options, with the correct {type === 'MULTIPLE' ? 'ones' : 'one'} ticked</legend>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <Checkbox checked={option.isCorrect} onChange={(checked) => mark(index, checked)} label={<span className="sr-only">Correct</span>} />
                <Input
                  value={option.text}
                  onChange={(e) => setOptions((all) => all.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)))}
                  placeholder={`Option ${'ABCDEFGH'[index]}`}
                  aria-label={`Option ${'ABCDEFGH'[index]}`}
                  disabled={type === 'TRUE_FALSE'}
                  className="font-serif"
                />
                {type !== 'TRUE_FALSE' && options.length > 2 && (
                  <IconButton label="Remove option" onClick={() => setOptions((all) => all.filter((_, i) => i !== index))}>
                    <Trash2 className="size-4" />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
          {type !== 'TRUE_FALSE' && options.length < 6 && (
            <button type="button" onClick={() => setOptions((all) => [...all, { text: '', isCorrect: false }])} className="mt-2 inline-flex items-center gap-1 text-base font-medium text-pen hover:underline">
              <Plus className="size-3.5" aria-hidden /> Add an option
            </button>
          )}
        </fieldset>
      )}
      {type === 'FILL_BLANK' && (
        <Field label="Accepted answer" htmlFor="q-answer" hint="Separate alternatives with commas. Case and spacing are ignored.">
          <Input id="q-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </Field>
      )}
      {type === 'SUBJECTIVE' && <p className="text-base text-ink-2">Written answers are graded by hand from the Results page.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marks" htmlFor="q-marks">
          <Input id="q-marks" type="number" min={0} step={0.5} value={score} onChange={(e) => setScore(Number(e.target.value))} />
        </Field>
        <Field label="Marks off if wrong" htmlFor="q-penalty">
          <Input id="q-penalty" type="number" min={0} step={0.25} value={penalty} onChange={(e) => setPenalty(Number(e.target.value))} />
        </Field>
      </div>
      <Field label="Explanation" htmlFor="q-explanation" hint="Shown to candidates when they review their result.">
        <Textarea id="q-explanation" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {question ? 'Save question' : 'Add question'}
        </Button>
      </div>
    </form>
  );
}

function QuestionList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', type: '', difficulty: '' });
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [viewing, setViewing] = useState<Question | null>(null);
  const [removing, setRemoving] = useState<Question | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = useQuery({
    queryKey: ['questions', page, filters],
    queryFn: () =>
      api.get<Paged<Question>>('/questions', {
        page,
        limit: 20,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      }),
    placeholderData: keepPreviousData,
  });
  const banks = useQuery({ queryKey: ['banks'], queryFn: () => api.get<Paged<QuestionBank>>('/question-banks', { limit: 100 }) });
  const filter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/questions/${removing.id}`);
      await queryClient.invalidateQueries({ queryKey: ['questions'] });
      toast.done('Question deleted');
      setRemoving(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const file = async (question: Question, bank: QuestionBank) => {
    try {
      await api.post(`/question-banks/${bank.id}/questions`, { questionId: question.id });
      await queryClient.invalidateQueries({ queryKey: ['banks'] });
      toast.done(`Filed in ${bank.name}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const columns: Column<Question>[] = [
    {
      key: 'text',
      header: 'Question',
      className: 'max-w-xl',
      cell: (row) => (
        <div>
          <p className="line-clamp-2 font-serif text-[0.9375rem] leading-snug text-ink">{row.text}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {row.topic && <span>{row.topic}</span>}
            {row.tags.includes('agent-authored') && <Tag tone="mark">Agent-authored, reviewed</Tag>}
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', cell: (row) => <span className="text-ink-2">{TYPE_LABEL[row.type]}</span> },
    { key: 'difficulty', header: 'Difficulty', cell: (row) => <span className="text-ink-2">{titleCase(row.difficulty)}</span> },
    { key: 'marks', header: 'Marks', align: 'right', cell: (row) => marks(row.marks) },
    {
      key: 'accuracy',
      header: 'Answered right',
      align: 'right',
      cell: (row) =>
        row.analytics?.attemptCount ? (
          <span title={`${row.analytics.attemptCount} attempts`}>{percent(row.analytics.accuracy <= 1 ? row.analytics.accuracy * 100 : row.analytics.accuracy)}</span>
        ) : (
          <span className="text-ink-3">not used</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <Menu>
          <MenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()} className="rounded px-2 py-1 text-base font-medium text-pen hover:bg-pen-wash">
              Actions
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => setEditing(row)}>Edit</MenuItem>
            {banks.data?.items.map((bank) => (
              <MenuItem key={bank.id} onSelect={() => file(row, bank)}>
                File in {bank.name}
              </MenuItem>
            ))}
            <MenuItem danger onSelect={() => setRemoving(row)}>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      ),
    },
  ];

  return (
    <div className="pt-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input type="search" placeholder="Search questions and topics" aria-label="Search questions" value={filters.search} onChange={(e) => filter('search', e.target.value)} className="w-72" />
        <Select value={filters.type} onChange={(e) => filter('type', e.target.value)} aria-label="Type" className="w-48">
          <option value="">Every type</option>
          {EDITABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select value={filters.difficulty} onChange={(e) => filter('difficulty', e.target.value)} aria-label="Difficulty" className="w-44">
          <option value="">Every difficulty</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {titleCase(d)}
            </option>
          ))}
        </Select>
        <span className="nums ml-auto text-base text-ink-2">{questions.data ? plural(questions.data.meta.total, 'question') : ''}</span>
        <Button onClick={() => setEditing('new')}>Write a question</Button>
      </div>

      {questions.isLoading ? (
        <Spinner />
      ) : questions.isError ? (
        <ErrorNote message="Questions could not be loaded." onRetry={() => questions.refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={questions.data?.items ?? []}
            rowKey={(row) => row.id}
            onRowClick={setViewing}
            empty={
              <Empty title="No question matches">
                Change the filters, write a question yourself, or draft a set with the agents.
              </Empty>
            }
          />
          <Pager page={page} pages={questions.data?.meta.pages ?? 1} onPage={setPage} />
        </>
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)} title={editing === 'new' ? 'Write a question' : 'Edit question'} size="lg">
        {editing && <QuestionForm question={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Dialog>
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)} title="Question" size="lg">
        {viewing && <QuestionPaper question={viewing} />}
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={() => setRemoving(null)} title="Delete this question?" confirmLabel="Delete question" onConfirm={remove} busy={busy} danger>
        It is removed from every bank and from tests that have not been sat. Past results keep their record.
      </ConfirmDialog>
    </div>
  );
}

function Banks() {
  const queryClient = useQueryClient();
  const banks = useQuery({ queryKey: ['banks'], queryFn: () => api.get<Paged<QuestionBank>>('/question-banks', { limit: 100 }) });
  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: () => api.get<Paged<Course>>('/courses', { limit: 100 }) });
  const [open, setOpen] = useState<QuestionBank | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [busy, setBusy] = useState(false);

  const detail = useQuery({
    queryKey: ['banks', open?.id],
    queryFn: () => api.get<{ bank: { questions: { question: Question }[] } }>(`/question-banks/${open!.id}`),
    enabled: !!open,
  });
  const courseName = (id: string | null) => courses.data?.items.find((c) => c.id === id)?.code ?? 'Any course';

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/question-banks', { name: name.trim(), ...(courseId ? { courseId } : {}) });
      await queryClient.invalidateQueries({ queryKey: ['banks'] });
      toast.done('Bank created');
      setCreating(false);
      setName('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const take = async (questionId: string) => {
    try {
      await api.delete(`/question-banks/${open!.id}/questions/${questionId}`);
      await queryClient.invalidateQueries({ queryKey: ['banks'] });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="pt-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="max-w-xl text-base text-ink-2">A bank is a named set of questions. A test can be built from a bank by choosing how many questions of each difficulty to draw.</p>
        <Button onClick={() => setCreating(true)}>New bank</Button>
      </div>
      {banks.isLoading ? (
        <Spinner />
      ) : banks.data?.items.length ? (
        <ul className="border-t-[1.5px] border-ink">
          {banks.data.items.map((bank) => (
            <li key={bank.id}>
              <button onClick={() => setOpen(bank)} className="flex w-full items-baseline gap-6 border-b border-rule-2 py-4 text-left hover:bg-desk">
                <span className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">{bank.name}</span>
                <span className="text-base text-ink-2">{courseName(bank.courseId)}</span>
                <span className="nums w-32 text-right text-base text-ink-2">{plural(bank._count.questions, 'question')}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No banks yet" action={<Button onClick={() => setCreating(true)}>Create a bank</Button>}>
          Group questions into a bank to build tests from them.
        </Empty>
      )}

      <Dialog open={creating} onOpenChange={setCreating} title="New bank" size="sm">
        <form onSubmit={create} className="space-y-4">
          <Field label="Name" htmlFor="bank-name">
            <Input id="bank-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Course" htmlFor="bank-course">
            <Select id="bank-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Any course</option>
              {courses.data?.items.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} {course.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              Create bank
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!open} onOpenChange={() => setOpen(null)} title={open?.name ?? ''} description={open ? plural(detail.data?.bank.questions.length ?? open._count.questions, 'question') : undefined} size="lg">
        {detail.isLoading ? (
          <Spinner />
        ) : detail.data?.bank.questions.length ? (
          <ol>
            {detail.data.bank.questions.map(({ question }, index) => (
              <li key={question.id} className="border-b border-rule-2 py-4 last:border-0">
                <QuestionPaper question={question} number={index + 1} />
                <button onClick={() => take(question.id)} className="ml-10 mt-2 text-sm font-medium text-red hover:underline">
                  Take out of this bank
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-base text-ink-2">This bank is empty. File questions into it from the question list.</p>
        )}
      </Dialog>
    </div>
  );
}

type Tab = 'draft' | 'list' | 'banks';

export function QuestionStudio() {
  const [tab, setTab] = useState<Tab>('draft');
  return (
    <Page>
      <PageHeader
        title="Question studio"
        description="Draft questions from your course material with a second agent checking each one, or write them yourself."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'draft', label: 'Draft with agents' },
          { value: 'list', label: 'Question list' },
          { value: 'banks', label: 'Banks' },
        ]}
      />
      {tab === 'draft' ? <Draft /> : tab === 'list' ? <QuestionList /> : <Banks />}
    </Page>
  );
}
