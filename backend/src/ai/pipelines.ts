import { Difficulty, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { isAdmin, isStaff } from '../middleware/authorize.js';
import { assertAttemptReadable, assertCourseStaffAccess, type Viewer } from '../services/access.service.js';
import { serializeQuestion } from '../services/question.service.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as agents from './agents.js';
import { LlmError, type ChatMessage } from './provider.js';
import { attemptBreakdown, peopleDirectory, staffSnapshot, studentWorkload } from './records.js';
import { courseScope, search, type Hit } from './retrieval.js';
import { Run, type Emit } from './run.js';

/**
 * The three agent pipelines. Each is a fixed graph rather than a free-running
 * loop: the order of agents is decided in code, the Supervisor only chooses the
 * branch. That keeps cost bounded (at most four model calls per answer) and
 * makes every run reproducible from its trace.
 *
 *   ask      Supervisor → Retriever / Records → Tutor → Verifier (→ Tutor rewrite)
 *   author   Retriever → Examiner → Reviewer → Librarian
 *   debrief  Records → Retriever → Coach
 */

export interface SourceView {
  n: number;
  chunkId: string;
  documentId: string;
  title: string;
  heading: string | null;
  sourceType: string;
  lessonId: string | null;
  course: Hit['course'];
  excerpt: string;
  score: number;
  keywordRank: number | null;
  vectorRank: number | null;
  cited: boolean;
}

const toSources = (hits: Hit[], cited: Set<number> = new Set()): SourceView[] =>
  hits.map((hit, i) => ({
    n: i + 1,
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    title: hit.documentTitle,
    heading: hit.heading,
    sourceType: hit.sourceType,
    lessonId: hit.lessonId,
    course: hit.course,
    excerpt: hit.content,
    score: hit.score,
    keywordRank: hit.keywordRank,
    vectorRank: hit.vectorRank,
    cited: cited.has(i + 1),
  }));

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const retrieve = (run: Run, viewer: Viewer, queries: string[], opts: { courseId?: string; k?: number }) =>
  run.step('retriever', 'Search the knowledge base', async () => {
    const result = await search(viewer, queries, { ...opts, signal: run.signal });
    return {
      value: result,
      detail: { queries: result.queries, mode: result.mode, scanned: result.scanned, hits: toSources(result.hits) },
    };
  });

interface Outcome {
  output: string;
  route?: string;
  grounded?: string | null;
  data: unknown;
}

/** Runs a pipeline body and turns its result or failure into the run's final state. */
async function execute(run: Run, body: () => Promise<Outcome>): Promise<void> {
  try {
    const { data, ...fields } = await body();
    await run.finish(fields);
    run.emit({ type: 'done', data });
  } catch (err) {
    const expected = err instanceof LlmError || err instanceof AppError;
    if (!expected) logger.error('[ai] run failed', err);
    const message = expected ? (err as Error).message : 'The run failed unexpectedly.';
    await run.fail(message);
    run.emit({ type: 'error', message });
  }
}

/* ------------------------------------------------------------------- ask */

const NOTHING_FOUND =
  'Nothing in the knowledge base you can access covers this. Try naming the topic the way your course does, or ask your teacher to add the material.';

export async function runAsk(
  viewer: Viewer,
  conversationId: string,
  question: string,
  emit: Emit,
  signal?: AbortSignal,
): Promise<void> {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId: viewer.id },
    select: {
      title: true,
      courseId: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 8, select: { role: true, content: true } },
    },
  });
  if (!conversation) throw notFound('Conversation');

  const history: ChatMessage[] = conversation.messages
    .reverse()
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
  await prisma.aIMessage.create({ data: { conversationId, role: 'user', content: question } });
  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: { title: conversation.title ?? clip(question.replace(/\s+/g, ' '), 70) },
  });

  const run = await Run.start({ userId: viewer.id, kind: 'ASK', input: question, refId: conversationId }, emit, signal);
  const stream = { onToken: (text: string) => emit({ type: 'token', text }), signal };

  await execute(run, async () => {
    const scope = await courseScope(viewer);
    const courses = await prisma.course.findMany({
      where: scope ? { id: { in: scope } } : {},
      select: { code: true, name: true },
      take: 30,
    });

    const plan = await run.step('supervisor', 'Plan the answer', async (spend) => {
      const value = await agents.supervise(
        { question, history, role: viewer.role, courses: courses.map((c) => `${c.code} ${c.name}`) },
        spend,
        signal,
      );
      return { value, detail: value };
    });

    const hits = plan.queries.length
      ? (await retrieve(run, viewer, plan.queries, { courseId: conversation.courseId ?? undefined })).hits
      : [];

    const records =
      plan.route === 'records' || plan.route === 'both'
        ? await run.step('records', 'Read live platform records', async () => {
            // peopleDirectory enforces who may be seen: admin all, teacher students, others self.
            const people = await peopleDirectory(viewer);
            const value =
              viewer.role === 'STUDENT'
                ? { ...(await studentWorkload(viewer.id)), people }
                : isStaff(viewer.role)
                  ? { ...(await staffSnapshot({ id: viewer.id, admin: isAdmin(viewer.role) })), people }
                  : { people };
            return { value, detail: { sections: value ? Object.keys(value) : [], scope: viewer.role } };
          })
        : null;

    let text: string;
    if (plan.route === 'chat') {
      text = await run.step('tutor', 'Reply', async (spend) => ({
        value: await agents.smallTalk({ question, history, role: viewer.role }, spend, stream),
      }));
    } else if (!hits.length && !records) {
      // No evidence means no model call: an answer here could only be a guess.
      text = NOTHING_FOUND;
      emit({ type: 'token', text });
    } else {
      text = await run.step('tutor', 'Write the answer from the sources', async (spend) => ({
        value: await agents.answer({ question, history, role: viewer.role, hits, records }, spend, stream),
      }));
    }

    let grounded: string | null = null;
    if (env.AI_VERIFY && plan.route !== 'chat' && text !== NOTHING_FOUND) {
      try {
        const verdict = await run.step('verifier', 'Check every claim against the sources', async (spend) => {
          const value = await agents.verify({ answer: text, hits, records }, spend, signal);
          return { value, detail: value };
        });
        grounded = verdict.verdict;
        if (verdict.verdict === 'ungrounded') {
          const previous = text;
          text = await run.step('tutor', 'Rewrite using only the sources', async (spend) => ({
            value: await agents.answer(
              { question, history, role: viewer.role, hits, records, unsupported: verdict.unsupported, previous },
              spend,
              { signal },
            ),
            detail: { reason: verdict.note },
          }));
          emit({ type: 'replace', text });
          grounded = 'revised';
        }
      } catch (err) {
        // A verifier outage must not discard an answer the user has already read.
        if (!(err instanceof LlmError)) throw err;
      }
    }

    const sources = toSources(hits, agents.citedNumbers(text, hits.length));
    const message = await prisma.aIMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: text,
        sources: sources as unknown as Prisma.InputJsonValue,
        runId: run.id,
      },
      select: { id: true, role: true, content: true, sources: true, runId: true, createdAt: true },
    });
    return { output: text, route: plan.route, grounded, data: { message: { ...message, grounded } } };
  });
}

/* ---------------------------------------------------------------- author */

export interface AuthorInput {
  courseId: string;
  topic: string;
  count: number;
  type: agents.AuthoredType;
  difficulty: Difficulty;
  marks: number;
  bankId?: string;
}

export async function runAuthor(viewer: Viewer, input: AuthorInput, emit: Emit, signal?: AbortSignal): Promise<void> {
  await assertCourseStaffAccess(input.courseId, viewer);
  if (input.bankId) {
    const bank = await prisma.questionBank.findUnique({ where: { id: input.bankId }, select: { createdById: true } });
    if (!bank) throw notFound('Question bank');
    if (!isAdmin(viewer.role) && bank.createdById !== viewer.id) throw forbidden('You do not own this question bank');
  }

  const run = await Run.start(
    {
      userId: viewer.id,
      kind: 'AUTHOR',
      input: `${input.count} ${input.difficulty} ${input.type} questions on "${input.topic}"`,
      refId: input.courseId,
    },
    emit,
    signal,
  );

  await execute(run, async () => {
    const found = await retrieve(run, viewer, [input.topic], { courseId: input.courseId, k: 8 });
    if (!found.hits.length) {
      throw badRequest('No indexed material in this course matches the topic. Add a lesson or upload a document first.');
    }

    const drafts = await run.step('examiner', `Draft ${input.count} questions from the sources`, async (spend) => {
      const value = await agents.draftQuestions({ ...input, hits: found.hits }, spend, signal);
      return { value, detail: { drafted: value.length } };
    });

    const reviews = await run.step('reviewer', 'Sit each question without the answer key', async (spend) => {
      const value = await agents.reviewQuestions({ drafts, hits: found.hits }, spend, signal);
      return { value, detail: { answers: value } };
    });

    const judged = agents.judgeDrafts(drafts, reviews, input.type, found.hits.length);
    const accepted = judged.filter((j) => j.accepted).map((j) => j.draft);
    const rejected = judged
      .filter((j) => !j.accepted)
      .map((j) => ({ text: j.draft.text, options: j.draft.options, correct: j.draft.correct, reason: j.reason }));

    const saved = await run.step('librarian', 'File the questions that passed review', async () => {
      const rows = [];
      for (const draft of accepted) {
        const hit = found.hits[draft.source - 1];
        rows.push(
          await prisma.question.create({
            data: {
              text: draft.text,
              type: input.type,
              difficulty: input.difficulty,
              bloomLevel: draft.bloom,
              marks: new Prisma.Decimal(input.marks),
              explanation: draft.explanation,
              topic: clip(input.topic, 190),
              // Where the question came from, so a teacher can check it against the lesson.
              reference: clip([hit.documentTitle, hit.heading].filter(Boolean).join(' — '), 190),
              estimatedTime: 60,
              createdById: viewer.id,
              options: {
                create: draft.options.map((text, i) => ({ text, isCorrect: draft.correct.includes(i), orderIndex: i })),
              },
              tags: { create: [{ tag: 'agent-authored' }] },
              ...(input.bankId ? { bankMemberships: { create: { bankId: input.bankId } } } : {}),
            },
            include: { options: true, tags: true },
          }),
        );
      }
      return {
        value: rows,
        detail: {
          saved: rows.length,
          rejected: rejected.map((r) => ({ question: clip(r.text, 140), reason: r.reason })),
        },
      };
    });

    return {
      output: `${saved.length} of ${drafts.length} drafted questions passed review.`,
      data: {
        accepted: saved.map(serializeQuestion),
        rejected,
        sources: toSources(found.hits, new Set(accepted.map((d) => d.source))),
      },
    };
  });
}

/* --------------------------------------------------------------- debrief */

// A topic under this share of its marks is treated as a weakness worth revising.
const WEAK_TOPIC_PERCENT = 70;

export async function runDebrief(viewer: Viewer, attemptId: string, emit: Emit, signal?: AbortSignal): Promise<void> {
  await assertAttemptReadable(attemptId, viewer);
  const breakdown = await attemptBreakdown(attemptId);
  if (breakdown.status === 'IN_PROGRESS') throw badRequest('This attempt has not been submitted yet.');

  const run = await Run.start(
    { userId: viewer.id, kind: 'DEBRIEF', input: `Debrief: ${breakdown.result.test}`, refId: attemptId },
    emit,
    signal,
  );

  await execute(run, async () => {
    const { result } = breakdown;
    await run.step('records', 'Break the result down by topic', async () => ({
      value: null,
      detail: { score: `${result.score}/${result.totalMarks}`, byTopic: result.byTopic, missed: result.missed.length },
    }));

    const weak = result.byTopic.filter((t) => t.percent < WEAK_TOPIC_PERCENT).slice(0, 3);
    // A clean paper still gets a debrief, built around its two lowest topics.
    const queries = (weak.length ? weak : result.byTopic.slice(0, 2)).map((t) => t.topic);
    const found = await retrieve(run, viewer, queries, { courseId: breakdown.courseId ?? undefined, k: 6 });

    const text = await run.step('coach', 'Write the debrief and revision plan', async (spend) => ({
      value: await agents.coach({ result, hits: found.hits }, spend, {
        onToken: (delta) => emit({ type: 'token', text: delta }),
        signal,
      }),
    }));

    return {
      output: text,
      data: { runId: run.id, output: text, sources: toSources(found.hits, agents.citedNumbers(text, found.hits.length)) },
    };
  });
}

/* ------------------------------------------------------------ run access */

const runView = {
  id: true,
  kind: true,
  refId: true,
  input: true,
  output: true,
  status: true,
  route: true,
  model: true,
  grounded: true,
  promptTokens: true,
  completionTokens: true,
  latencyMs: true,
  error: true,
  createdAt: true,
  finishedAt: true,
  userId: true,
  user: { select: { fullName: true, role: true } },
  steps: {
    orderBy: { ordinal: 'asc' },
    select: {
      ordinal: true,
      agent: true,
      title: true,
      status: true,
      detail: true,
      latencyMs: true,
      promptTokens: true,
      completionTokens: true,
    },
  },
} satisfies Prisma.AgentRunSelect;

type RunRow = Prisma.AgentRunGetPayload<{ select: typeof runView }>;

/** The sources a run retrieved, with `cited` set from what its output references. */
const withSources = (run: RunRow) => {
  const detail = run.steps.find((s) => s.agent === 'retriever')?.detail as { hits?: SourceView[] } | null | undefined;
  const hits = detail?.hits ?? [];
  const cited = agents.citedNumbers(run.output ?? '', hits.length);
  return { ...run, sources: hits.map((hit) => ({ ...hit, cited: cited.has(hit.n) })) };
};

export async function getRun(viewer: Viewer, id: string) {
  const run = await prisma.agentRun.findUnique({ where: { id }, select: runView });
  // Another user's run answers 404 so run ids cannot be probed.
  if (!run || (run.userId !== viewer.id && !isAdmin(viewer.role))) throw notFound('Run');
  return withSources(run);
}

/** The viewer's most recent finished debrief of an attempt, if they have one. */
export async function latestDebrief(viewer: Viewer, attemptId: string) {
  await assertAttemptReadable(attemptId, viewer);
  const run = await prisma.agentRun.findFirst({
    where: { kind: 'DEBRIEF', refId: attemptId, userId: viewer.id, status: 'DONE' },
    orderBy: { createdAt: 'desc' },
    select: runView,
  });
  return run ? withSources(run) : null;
}

export async function listRuns(viewer: Viewer, query: { limit: number; kind?: string }) {
  const where = { ...(isAdmin(viewer.role) ? {} : { userId: viewer.id }), ...(query.kind ? { kind: query.kind } : {}) };
  const [runs, totals, byStatus, byGrounding, byKind] = await Promise.all([
    prisma.agentRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        kind: true,
        input: true,
        status: true,
        route: true,
        grounded: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        latencyMs: true,
        error: true,
        createdAt: true,
        user: { select: { fullName: true, role: true } },
        _count: { select: { steps: true } },
      },
    }),
    prisma.agentRun.aggregate({
      where,
      _count: { _all: true },
      _avg: { latencyMs: true },
      _sum: { promptTokens: true, completionTokens: true },
    }),
    prisma.agentRun.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.agentRun.groupBy({ by: ['grounded'], where: { ...where, grounded: { not: null } }, _count: { _all: true } }),
    prisma.agentRun.groupBy({ by: ['kind'], where, _count: { _all: true } }),
  ]);
  const tally = <T extends { _count: { _all: number } }>(rows: T[], key: (row: T) => string | null) =>
    Object.fromEntries(rows.map((row) => [String(key(row)), row._count._all]));
  return {
    runs: runs.map(({ _count, ...run }) => ({ ...run, steps: _count.steps })),
    summary: {
      total: totals._count._all,
      averageLatencyMs: totals._avg.latencyMs ? Math.round(totals._avg.latencyMs) : null,
      promptTokens: totals._sum.promptTokens ?? 0,
      completionTokens: totals._sum.completionTokens ?? 0,
      byStatus: tally(byStatus, (row) => row.status),
      byGrounding: tally(byGrounding, (row) => row.grounded),
      byKind: tally(byKind, (row) => row.kind),
    },
  };
}
