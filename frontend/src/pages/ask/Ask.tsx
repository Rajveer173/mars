import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Plus, Square, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAiStatus } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, relative } from '@/lib/format';
import { streamRun, upsertStep, type Step } from '@/lib/stream';
import { Material } from '@/ui/Material';
import { ErrorNote, IconButton, Spinner, Tabs } from '@/ui/core';
import { toast } from '@/ui/overlay';
import { AgentTrace, GroundingNote, SourceNotes, type Source } from '@/ui/trace';

interface Message {
  id: string;
  role: string;
  content: string;
  sources: Source[] | null;
  runId: string | null;
  createdAt: string;
  run?: { grounded: string | null } | null;
  grounded?: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  courseId: string | null;
  updatedAt: string;
  messages: Message[];
}

interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
}

/** The answer being written right now, before it is saved as a message. */
interface Live {
  question: string;
  text: string;
  steps: Step[];
  error: string | null;
}

const STARTERS: Record<string, string[]> = {
  STUDENT: [
    'Which four conditions must hold for a deadlock, and how does prevention break each one?',
    'Explain third normal form with a worked decomposition.',
    'What should I revise before my next test?',
    'How many attempts do I get on a test, and how does negative marking work?',
  ],
  STAFF: [
    'How many students have attempted my tests, and what is the pass rate?',
    'Summarise what the lessons say about TCP congestion control.',
    'What does the examination policy say about re-evaluation?',
    'Which assignments are still waiting to be graded?',
  ],
};

function Evidence({
  sources,
  steps,
  runId,
  active,
  onSelect,
}: {
  sources: Source[];
  steps: Step[] | null;
  runId: string | null;
  active: number | null;
  onSelect: (n: number | null) => void;
}) {
  const [tab, setTab] = useState<'sources' | 'run'>('sources');
  // A saved answer keeps only its sources; its run sheet is fetched when opened.
  const stored = useQuery({
    queryKey: ['ai', 'run', runId],
    queryFn: () => api.get<{ run: { steps: Step[] } }>(`/ai/runs/${runId}`),
    enabled: tab === 'run' && !steps && !!runId,
    staleTime: Infinity,
  });
  const shown = steps ?? stored.data?.run.steps ?? [];
  useEffect(() => {
    if (active != null) setTab('sources');
  }, [active]);

  return (
    <div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'sources', label: 'Sources', count: sources.length },
          { value: 'run', label: 'Run sheet', count: shown.length || undefined },
        ]}
      />
      <div className="pt-4">
        {tab === 'sources' ? (
          sources.length ? (
            <SourceNotes sources={sources} active={active} onSelect={onSelect} />
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">
              No passages were retrieved for this answer. It came from your platform records, or it was a greeting.
            </p>
          )
        ) : stored.isLoading ? (
          <Spinner label="Loading the run sheet" />
        ) : shown.length ? (
          <AgentTrace steps={shown} />
        ) : (
          <p className="text-sm text-ink-2">No run was recorded for this answer.</p>
        )}
      </div>
    </div>
  );
}

function Composer({
  onSend,
  onStop,
  busy,
  disabled,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  }, [text]);

  const send = () => {
    const value = text.trim();
    if (!value || busy || disabled) return;
    onSend(value);
    setText('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="flex items-end gap-2 rounded-lg border border-rule bg-paper p-2 transition-[border-color,box-shadow] focus-within:border-pen focus-within:ring-[3px] focus-within:ring-pen-wash">
      <textarea
        ref={field}
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={disabled ? 'Connect a model to ask questions' : 'Ask about your course material or your own results'}
        aria-label="Your question"
        className="min-h-8 flex-1 resize-none bg-transparent px-2 py-1 text-md leading-relaxed text-pen-deep placeholder:text-ink-3 focus:outline-none disabled:cursor-not-allowed"
      />
      {busy ? (
        <button
          onClick={onStop}
          aria-label="Stop"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-ink text-white hover:bg-red"
        >
          <Square className="size-3.5" fill="currentColor" />
        </button>
      ) : (
        <button
          onClick={send}
          disabled={disabled || !text.trim()}
          aria-label="Send question"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-ink text-white transition-colors hover:bg-pen disabled:bg-rule disabled:text-ink-3"
        >
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

export function Ask() {
  const { conversationId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuth((state) => state.user)!;
  const status = useAiStatus();
  const connected = status.data?.chat.connected ?? true;

  const list = useQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: () => api.get<{ conversations: ConversationSummary[] }>('/ai/conversations'),
  });
  const conversation = useQuery({
    queryKey: ['ai', 'conversation', conversationId],
    queryFn: () => api.get<{ conversation: Conversation }>(`/ai/conversations/${conversationId}`),
    enabled: !!conversationId,
  });

  const [live, setLive] = useState<Live | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => conversation.data?.conversation.messages ?? [], [conversation.data]);
  const answers = messages.filter((m) => m.role === 'assistant');
  const shown = live ? null : (answers.find((m) => m.id === selected) ?? answers.at(-1) ?? null);

  useEffect(() => {
    setSelected(null);
    setActiveCite(null);
  }, [conversationId]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, live?.text, live?.steps.length]);
  useEffect(() => () => abort.current?.abort(), []);

  const ask = async (question: string) => {
    setLive({ question, text: '', steps: [], error: null });
    setActiveCite(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      let id = conversationId;
      if (!id) {
        const created = await api.post<{ conversation: { id: string } }>('/ai/conversations', {
          courseId: params.get('course'),
        });
        id = created.conversation.id;
        navigate(`/ask/${id}`, { replace: true });
      }
      let saved: Message | null = null;
      let failure: string | null = null;
      await streamRun(
        `/ai/conversations/${id}/messages`,
        { content: question },
        (event) => {
          if (event.type === 'step') setLive((s) => s && { ...s, steps: upsertStep(s.steps, event.step) });
          else if (event.type === 'token') setLive((s) => s && { ...s, text: s.text + event.text });
          else if (event.type === 'replace') setLive((s) => s && { ...s, text: event.text });
          else if (event.type === 'done') saved = (event.data as { message: Message }).message;
          else if (event.type === 'error') failure = event.message;
        },
        controller.signal,
      );
      if (failure) {
        setLive((s) => s && { ...s, error: failure });
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ai', 'conversation', id] }),
        queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] }),
      ]);
      if (saved) setSelected((saved as Message).id);
      setLive(null);
    } catch (error) {
      if (controller.signal.aborted) {
        setLive(null);
        void queryClient.invalidateQueries({ queryKey: ['ai', 'conversation', conversationId] });
        return;
      }
      setLive((s) => s && { ...s, error: errorMessage(error) });
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/ai/conversations/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] });
      if (id === conversationId) navigate('/ask');
      toast.done('Conversation deleted');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const liveSources = useMemo(() => {
    const hits = (live?.steps.find((s) => s.agent === 'retriever')?.detail as { hits?: Source[] } | null)?.hits ?? [];
    const cited = new Set([...(live?.text ?? '').matchAll(/\[(\d+)/g)].map((m) => Number(m[1])));
    return hits.map((hit) => ({ ...hit, cited: cited.has(hit.n) }));
  }, [live]);

  const evidence = live
    ? { sources: liveSources, steps: live.steps, runId: null }
    : shown
      ? { sources: shown.sources ?? [], steps: null, runId: shown.runId }
      : null;
  const busy = !!live && !live.error;
  const isEmpty = !conversationId && !live;
  const starters = STARTERS[user.role === 'STUDENT' ? 'STUDENT' : 'STAFF'];

  return (
    <div className="grid h-[calc(100dvh-3.5rem)] grid-cols-1 xl:grid-cols-[15rem_minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Past questions */}
      <aside className="hidden flex-col border-r border-rule xl:flex">
        <div className="p-3">
          <Link
            to="/ask"
            className="flex h-9 items-center justify-center gap-2 rounded-md border border-rule text-base font-medium text-ink hover:border-ink"
          >
            <Plus className="size-4" aria-hidden /> New question
          </Link>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-3">
          {list.data?.conversations.map((item) => (
            <li key={item.id} className="group relative">
              <Link
                to={`/ask/${item.id}`}
                className={cn(
                  'block rounded-md py-1.5 pl-2 pr-8 text-base leading-snug',
                  item.id === conversationId ? 'bg-desk font-medium text-ink' : 'text-ink-2 hover:bg-desk hover:text-ink',
                )}
              >
                <span className="line-clamp-2">{item.title ?? 'New question'}</span>
                <span className="mt-0.5 block text-xs font-normal text-ink-3">{relative(item.updatedAt)}</span>
              </Link>
              <IconButton
                label="Delete conversation"
                onClick={() => remove(item.id)}
                className="absolute right-1 top-1.5 size-6 opacity-0 focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </li>
          ))}
          {list.data && !list.data.conversations.length && (
            <li className="px-2 py-2 text-sm text-ink-3">Your questions are kept here.</li>
          )}
        </ul>
      </aside>

      {/* The thread */}
      <section className="flex min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[46rem] px-4 pb-6 pt-8 sm:px-8">
            {isEmpty ? (
              <div className="pt-[8vh]">
                <h1 className="display text-4xl text-ink sm:text-5xl">Ask your course material.</h1>
                <p className="mt-4 max-w-xl text-md leading-relaxed text-ink-2">
                  Answers are written only from the lessons and documents you can open, with each sentence pinned to
                  its passage. Questions about your own tests and results are answered from live records.
                </p>
                {!connected && (
                  <div className="mt-6 rounded-md border border-rule bg-desk px-4 py-3 text-base leading-relaxed text-ink">
                    <strong className="font-semibold">No model is connected.</strong> Add <code className="font-mono text-sm">LLM_API_KEY</code> to{' '}
                    <code className="font-mono text-sm">backend/.env</code> and restart the API. Retrieval works without
                    it: try a search in the{' '}
                    <Link to="/knowledge" className="font-medium text-pen underline underline-offset-2">
                      knowledge base
                    </Link>
                    .
                  </div>
                )}
                <div className="mt-10 border-t-[1.5px] border-ink">
                  {starters.map((starter) => (
                    <button
                      key={starter}
                      disabled={!connected}
                      onClick={() => ask(starter)}
                      className="block w-full border-b border-rule py-3 text-left font-serif text-md text-ink transition-colors hover:text-pen disabled:cursor-not-allowed disabled:text-ink-3"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : conversation.isLoading && !live ? (
              <Spinner label="Opening the conversation" />
            ) : (
              <div className="space-y-10">
                {messages.map((message, index) =>
                  message.role === 'user' ? (
                    <h2 key={message.id} className={cn('text-lg font-semibold leading-snug text-pen-deep', index > 0 && 'border-t border-rule pt-10')}>
                      {message.content}
                    </h2>
                  ) : (
                    <article
                      key={message.id}
                      onClick={() => setSelected(message.id)}
                      className={cn('-mt-6 cursor-default', shown?.id === message.id ? '' : 'lg:opacity-80')}
                    >
                      <Material
                        onCite={(n) => {
                          setSelected(message.id);
                          setActiveCite(n);
                        }}
                        activeCite={shown?.id === message.id ? activeCite : null}
                      >
                        {message.content}
                      </Material>
                      <div className="mt-3">
                        <GroundingNote verdict={message.run?.grounded ?? message.grounded} />
                      </div>
                      {/* Below the wide breakpoint the evidence sits under its answer. */}
                      <details className="mt-3 lg:hidden">
                        <summary className="cursor-pointer text-sm font-medium text-pen">
                          Sources and run sheet
                        </summary>
                        <div className="mt-3">
                          <Evidence
                            sources={message.sources ?? []}
                            steps={null}
                            runId={message.runId}
                            active={shown?.id === message.id ? activeCite : null}
                            onSelect={setActiveCite}
                          />
                        </div>
                      </details>
                    </article>
                  ),
                )}

                {live && (
                  <>
                    <h2 className={cn('text-lg font-semibold leading-snug text-pen-deep', messages.length > 0 && 'border-t border-rule pt-10')}>
                      {live.question}
                    </h2>
                    <article className="-mt-6" aria-live="polite" aria-busy={busy}>
                      {live.text ? (
                        <Material onCite={setActiveCite} activeCite={activeCite}>
                          {live.text}
                        </Material>
                      ) : (
                        !live.error && (
                          <p className="flex items-center gap-2 text-base text-ink-2">
                            <span className="size-2 animate-pulse-dot rounded-full bg-pen" aria-hidden />
                            {live.steps.at(-1)?.title ?? 'Starting the run'}
                          </p>
                        )
                      )}
                      {live.error && (
                        <div className="mt-4">
                          <ErrorNote message={live.error} onRetry={() => ask(live.question)} />
                        </div>
                      )}
                      <div className="mt-4 lg:hidden">
                        <AgentTrace steps={live.steps} />
                      </div>
                    </article>
                  </>
                )}
                <div ref={bottom} />
              </div>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[46rem] px-4 pb-4 sm:px-8">
          <Composer onSend={ask} onStop={() => abort.current?.abort()} busy={busy} disabled={!connected} />
          <p className="mt-1.5 text-center text-xs text-ink-3">
            Answers come from your course material. Open a source to check a claim before you rely on it.
          </p>
        </div>
      </section>

      {/* The margin: evidence for the answer in view */}
      <aside className="hidden min-h-0 overflow-y-auto border-l border-rule px-5 py-5 lg:block">
        {evidence ? (
          <Evidence
            key={shown?.id ?? 'live'}
            sources={evidence.sources}
            steps={evidence.steps}
            runId={evidence.runId}
            active={activeCite}
            onSelect={setActiveCite}
          />
        ) : (
          <div className="text-sm leading-relaxed text-ink-2">
            <h2 className="text-base font-semibold text-ink">Evidence</h2>
            <p className="mt-2">
              The passages an answer was written from appear here, each with the sentence it supports. The run sheet
              lists every agent that worked on the answer.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
