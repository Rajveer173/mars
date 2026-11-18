import { Check, ChevronRight, CircleAlert, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn, formatMs, formatNumber } from '@/lib/format';
import type { AgentName, Step } from '@/lib/stream';

export interface Source {
  n: number;
  chunkId: string;
  documentId: string;
  title: string;
  heading: string | null;
  sourceType: string;
  lessonId: string | null;
  course: { id: string; name: string; code: string } | null;
  excerpt: string;
  score: number;
  keywordRank: number | null;
  vectorRank: number | null;
  cited: boolean;
}

export const AGENT_LABEL: Record<AgentName, string> = {
  supervisor: 'Supervisor',
  retriever: 'Retriever',
  records: 'Records',
  tutor: 'Tutor',
  verifier: 'Verifier',
  examiner: 'Examiner',
  reviewer: 'Reviewer',
  coach: 'Coach',
  librarian: 'Librarian',
};

export const AGENT_JOB: Record<AgentName, string> = {
  supervisor: 'Reads the request, picks the route and writes the search queries.',
  retriever: 'Searches the knowledge base by keyword and by meaning, then merges the two rankings.',
  records: 'Reads live figures from the platform database, scoped to the person asking.',
  tutor: 'Writes the answer from the retrieved passages and cites each one.',
  verifier: 'Re-reads the answer against the sources and rejects unsupported claims.',
  examiner: 'Drafts exam questions strictly from the retrieved passages.',
  reviewer: 'Sits each drafted question without the key. A question is kept only if both agents agree.',
  coach: 'Turns a finished test into a debrief and a revision plan, cited to the lessons.',
  librarian: 'Files the questions that passed review into the question bank.',
};

/* ------------------------------------------------------------------ trace */

const rank = (value: number | null) => (value == null ? 'missed' : `#${value}`);

function StepDetail({ step }: { step: Step }) {
  const detail = (step.detail ?? {}) as Record<string, unknown>;
  const line = (label: string, value: unknown) =>
    value == null || value === '' ? null : (
      <div className="flex gap-2">
        <dt className="w-20 shrink-0 text-ink-3">{label}</dt>
        <dd className="min-w-0 text-ink">{String(value)}</dd>
      </div>
    );

  if (step.status === 'FAILED') return <p className="text-red">{String(detail.error ?? 'This step failed.')}</p>;

  if (step.agent === 'supervisor') {
    const queries = (detail.queries as string[] | undefined) ?? [];
    return (
      <dl className="space-y-1">
        {line('Route', detail.route)}
        {line('Why', detail.reason)}
        {queries.length > 0 && line('Queries', queries.join('  /  '))}
      </dl>
    );
  }

  if (step.agent === 'retriever') {
    const hits = (detail.hits as Source[] | undefined) ?? [];
    return (
      <div className="space-y-2">
        <dl className="space-y-1">
          {line('Mode', detail.mode === 'hybrid' ? 'Keyword and meaning, fused' : 'Keyword only (no embedding model)')}
          {line('Scanned', `${formatNumber(Number(detail.scanned ?? 0))} passages`)}
          {line('Queries', ((detail.queries as string[] | undefined) ?? []).join('  /  '))}
        </dl>
        {hits.length > 0 ? (
          <table className="w-full text-left">
            <thead className="text-ink-3">
              <tr>
                <th className="w-6 font-normal">#</th>
                <th className="font-normal">Passage</th>
                <th className="w-16 text-right font-normal">Keyword</th>
                <th className="w-16 text-right font-normal">Meaning</th>
              </tr>
            </thead>
            <tbody className="nums">
              {hits.map((hit) => (
                <tr key={hit.n} className="border-t border-rule-2 align-top">
                  <td className="py-1 text-ink-3">{hit.n}</td>
                  <td className="py-1 pr-2 text-ink">
                    {hit.title}
                    {hit.heading && <span className="text-ink-3"> / {hit.heading}</span>}
                  </td>
                  <td className="py-1 text-right text-ink-2">{rank(hit.keywordRank)}</td>
                  <td className="py-1 text-right text-ink-2">{rank(hit.vectorRank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-2">No passage matched.</p>
        )}
      </div>
    );
  }

  if (step.agent === 'verifier') {
    const unsupported = (detail.unsupported as string[] | undefined) ?? [];
    return (
      <div className="space-y-1.5">
        <dl className="space-y-1">
          {line('Verdict', detail.verdict)}
          {line('Note', detail.note)}
        </dl>
        {unsupported.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4 text-ink">
            {unsupported.map((claim) => (
              <li key={claim}>{claim}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (step.agent === 'reviewer') {
    const answers = (detail.answers as { index: number; supported: boolean; issue: string }[] | undefined) ?? [];
    return (
      <ul className="space-y-0.5">
        {answers.map((answer) => (
          <li key={answer.index} className="flex gap-2">
            <span className="nums w-8 shrink-0 text-ink-3">Q{answer.index}</span>
            <span className={answer.supported ? 'text-ink' : 'text-red'}>
              {answer.supported ? 'Settled from the sources' : answer.issue || 'Could not be settled from the sources'}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (step.agent === 'librarian') {
    const rejected = (detail.rejected as { question: string; reason: string }[] | undefined) ?? [];
    return (
      <div className="space-y-1.5">
        <dl>{line('Saved', detail.saved)}</dl>
        {rejected.map((item) => (
          <p key={item.question} className="text-ink-2">
            <span className="text-red">Rejected.</span> {item.reason}
          </p>
        ))}
      </div>
    );
  }

  if (step.agent === 'records') {
    const topics = detail.byTopic as { topic: string; percent: number }[] | undefined;
    if (topics) {
      return (
        <ul className="space-y-0.5">
          {topics.map((topic) => (
            <li key={topic.topic} className="flex justify-between gap-3">
              <span className="text-ink">{topic.topic}</span>
              <span className="nums text-ink-2">{topic.percent}%</span>
            </li>
          ))}
        </ul>
      );
    }
    return <dl>{line('Read', ((detail.sections as string[] | undefined) ?? []).join(', '))}</dl>;
  }

  if (step.agent === 'examiner') return <dl>{line('Drafted', detail.drafted)}</dl>;
  if (typeof detail.reason === 'string') return <dl>{line('Why', detail.reason)}</dl>;
  return null;
}

function StepGlyph({ status }: { status: Step['status'] }) {
  if (status === 'RUNNING') {
    return <span className="size-2 animate-pulse-dot rounded-full bg-pen" aria-label="Running" />;
  }
  return status === 'DONE' ? (
    <Check className="size-3.5 text-tick" strokeWidth={3} aria-label="Done" />
  ) : (
    <X className="size-3.5 text-red" strokeWidth={3} aria-label="Failed" />
  );
}

/**
 * The run sheet: every agent that touched this request, in order, with what it
 * did, how long it took and what it cost. Steps open to show their evidence.
 */
export function AgentTrace({ steps, className }: { steps: Step[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!steps.length) return null;
  const tokens = steps.reduce((n, s) => n + s.promptTokens + s.completionTokens, 0);
  const time = steps.reduce((n, s) => n + s.latencyMs, 0);
  const running = steps.some((s) => s.status === 'RUNNING');

  return (
    <div className={cn('text-sm', className)}>
      <ol className="relative">
        {steps.map((step, index) => {
          const expanded = open === step.ordinal;
          const hasDetail = step.status !== 'RUNNING' && step.detail != null;
          return (
            <li key={step.ordinal} className="relative pb-3 pl-6 last:pb-0">
              {/* The line between agents is the hand-off. */}
              {index < steps.length - 1 && <span className="absolute left-[6px] top-4 h-full w-px bg-rule" aria-hidden />}
              <span className="absolute left-0 top-[3px] flex size-[13px] items-center justify-center bg-paper">
                <StepGlyph status={step.status} />
              </span>
              <button
                type="button"
                disabled={!hasDetail}
                onClick={() => setOpen(expanded ? null : step.ordinal)}
                aria-expanded={hasDetail ? expanded : undefined}
                className="group flex w-full items-baseline gap-2 text-left disabled:cursor-default"
              >
                <span className="font-semibold text-ink">{AGENT_LABEL[step.agent]}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{step.title}</span>
                {step.status !== 'RUNNING' && step.latencyMs > 0 && (
                  <span className="nums shrink-0 text-ink-3">{formatMs(step.latencyMs)}</span>
                )}
                {hasDetail && (
                  <ChevronRight
                    className={cn('size-3.5 shrink-0 self-center text-ink-3 transition-transform group-hover:text-ink', expanded && 'rotate-90')}
                    aria-hidden
                  />
                )}
              </button>
              {expanded && (
                <div className="mt-1.5 animate-rise rounded-md bg-desk px-3 py-2.5 text-sm leading-relaxed">
                  <StepDetail step={step} />
                  {step.promptTokens + step.completionTokens > 0 && (
                    <p className="nums mt-2 text-ink-3">
                      {formatNumber(step.promptTokens)} tokens in, {formatNumber(step.completionTokens)} out
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!running && (
        <p className="nums mt-3 border-t border-rule pt-2 text-ink-3">
          {steps.length} steps, {formatMs(time)}
          {tokens > 0 && `, ${formatNumber(tokens)} tokens`}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- grounding */

const GROUNDING: Record<string, { tone: string; icon: typeof ShieldCheck; text: string }> = {
  grounded: { tone: 'text-tick', icon: ShieldCheck, text: 'Verified: every claim is in the cited sources.' },
  partial: { tone: 'text-ink-2', icon: CircleAlert, text: 'Mostly verified: a side claim is not in the sources.' },
  revised: { tone: 'text-ink-2', icon: ShieldCheck, text: 'Rewritten: the Verifier rejected the first draft.' },
  ungrounded: { tone: 'text-red', icon: CircleAlert, text: 'Not verified against the sources. Check before relying on it.' },
};

export function GroundingNote({ verdict }: { verdict: string | null | undefined }) {
  const entry = verdict ? GROUNDING[verdict] : null;
  if (!entry) return null;
  const Icon = entry.icon;
  return (
    <p className={cn('flex items-center gap-1.5 text-sm', entry.tone)}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {entry.text}
    </p>
  );
}

/* ---------------------------------------------------------------- sources */

/**
 * Side notes: the passages an answer was written from. Cited ones come first
 * and carry the highlighter; a retrieved passage the answer did not use stays
 * listed, dimmed, because what was left out is part of the evidence too.
 */
export function SourceNotes({
  sources,
  active,
  onSelect,
  className,
}: {
  sources: Source[];
  active?: number | null;
  onSelect?: (n: number | null) => void;
  className?: string;
}) {
  const refs = useRef(new Map<number, HTMLLIElement>());
  useEffect(() => {
    if (active != null) refs.current.get(active)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  if (!sources.length) return null;
  const ordered = [...sources].sort((a, b) => Number(b.cited) - Number(a.cited) || a.n - b.n);

  return (
    <ol className={cn('space-y-4', className)}>
      {ordered.map((source) => {
        const isActive = active === source.n;
        return (
          <li
            key={source.n}
            ref={(node) => {
              if (node) refs.current.set(source.n, node);
              else refs.current.delete(source.n);
            }}
            className={cn('scroll-mt-24 border-l-2 pl-3 transition-colors', isActive ? 'border-ink' : 'border-transparent', !source.cited && 'opacity-60')}
          >
            <button type="button" onClick={() => onSelect?.(isActive ? null : source.n)} className="block w-full text-left">
              <div className="flex items-baseline gap-2">
                <span className={cn('cite !m-0 shrink-0', !source.cited && '!bg-rule')}>{source.n}</span>
                <span className="min-w-0 text-sm font-semibold leading-snug text-ink">{source.title}</span>
              </div>
              <div className="mt-0.5 text-sm text-ink-2">
                {[source.course?.code, source.heading].filter(Boolean).join(', ') || 'Institute document'}
              </div>
              <p className={cn('mt-1.5 font-serif text-sm leading-relaxed text-ink', !isActive && 'line-clamp-3')}>
                {isActive ? <span className="hl">{source.excerpt}</span> : source.excerpt}
              </p>
            </button>
            <div className="nums mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-3">
              <span>
                keyword {rank(source.keywordRank)}, meaning {rank(source.vectorRank)}
              </span>
              {!source.cited && <span>retrieved, not cited</span>}
              {source.lessonId && (
                <Link to={`/lessons/${source.lessonId}`} className="font-medium text-pen hover:underline">
                  Open lesson
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
