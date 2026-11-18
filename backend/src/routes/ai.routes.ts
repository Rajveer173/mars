import { Difficulty } from '@prisma/client';
import { Router, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod/v3';
import { QUESTION_TYPES } from '../ai/agents.js';
import * as knowledge from '../ai/knowledge.service.js';
import * as pipelines from '../ai/pipelines.js';
import { chatConfigured, providerInfo } from '../ai/provider.js';
import { search } from '../ai/retrieval.js';
import type { Emit } from '../ai/run.js';
import { prisma } from '../config/database.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { STAFF_ROLES, requireRole } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, badRequest, notFound } from '../utils/errors.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

const staffOnly = requireRole(...STAFF_ROLES);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

/**
 * Opens a server-sent event stream for a pipeline. Validation and access errors
 * are thrown before this is called, so they still reach the client as ordinary
 * JSON errors with a status code; only the run itself is streamed.
 */
function openStream(res: Response): { emit: Emit; signal: AbortSignal; end: () => void } {
  if (!chatConfigured()) {
    throw new AppError(503, 'No model is connected. Set LLM_API_KEY to turn the agents on.', undefined, 'AI_NOT_CONNECTED');
  }
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform also stops the compression middleware from buffering the stream.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // A closed tab aborts the model call instead of paying for an unread answer.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return {
    emit: (event) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
    signal: controller.signal,
    end: () => res.end(),
  };
}

/* ---------------------------------------------------------------- status */

aiRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { ...providerInfo(), knowledge: await knowledge.knowledgeStats() } });
  }),
);

/* --------------------------------------------------------- conversations */

const messageView = {
  id: true,
  role: true,
  content: true,
  sources: true,
  runId: true,
  createdAt: true,
  run: { select: { grounded: true, route: true, latencyMs: true, promptTokens: true, completionTokens: true } },
} as const;

aiRouter.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const conversations = await prisma.aIConversation.findMany({
      where: { userId: currentUser(req).id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, courseId: true, updatedAt: true, _count: { select: { messages: true } } },
    });
    res.json({ success: true, data: { conversations } });
  }),
);

aiRouter.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const input = z.object({ courseId: z.string().max(64).nullish() }).parse(req.body ?? {});
    const conversation = await prisma.aIConversation.create({
      data: { userId: currentUser(req).id, courseId: input.courseId || null },
      select: { id: true, title: true, courseId: true, updatedAt: true },
    });
    res.status(201).json({ success: true, data: { conversation } });
  }),
);

aiRouter.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const conversation = await prisma.aIConversation.findFirst({
      where: { id: req.params.id, userId: currentUser(req).id },
      select: {
        id: true,
        title: true,
        courseId: true,
        updatedAt: true,
        messages: { orderBy: { createdAt: 'asc' }, select: messageView },
      },
    });
    if (!conversation) throw notFound('Conversation');
    res.json({ success: true, data: { conversation } });
  }),
);

aiRouter.delete(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.aIConversation.deleteMany({
      where: { id: req.params.id, userId: currentUser(req).id },
    });
    if (!count) throw notFound('Conversation');
    res.json({ success: true, data: null });
  }),
);

aiRouter.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const { content } = z.object({ content: z.string().trim().min(1).max(4000) }).parse(req.body);
    const owned = await prisma.aIConversation.count({ where: { id: req.params.id, userId: currentUser(req).id } });
    if (!owned) throw notFound('Conversation');
    const stream = openStream(res);
    await pipelines.runAsk(currentUser(req), req.params.id, content, stream.emit, stream.signal);
    stream.end();
  }),
);

/* ------------------------------------------------------------- knowledge */

aiRouter.get(
  '/knowledge/documents',
  asyncHandler(async (req, res) => {
    const { courseId } = z.object({ courseId: z.string().max(64).optional() }).parse(req.query);
    res.json({ success: true, data: { documents: await knowledge.listDocuments(currentUser(req), courseId) } });
  }),
);

aiRouter.get(
  '/knowledge/documents/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { document: await knowledge.getDocument(currentUser(req), req.params.id) } });
  }),
);

aiRouter.post(
  '/knowledge/documents',
  staffOnly,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        title: z.string().trim().min(2).max(180),
        courseId: z.string().max(64).optional(),
        text: z.string().max(400_000).optional(),
      })
      .parse(req.body);
    if (!req.file && !input.text) throw badRequest('Attach a file or paste the text to index.');
    const text = req.file ? await knowledge.extractText(req.file) : input.text!;
    const document = await knowledge.addDocument(currentUser(req), {
      title: input.title,
      courseId: input.courseId,
      text,
      mimeType: req.file?.mimetype,
    });
    res.status(201).json({ success: true, data: { document } });
  }),
);

aiRouter.delete(
  '/knowledge/documents/:id',
  staffOnly,
  asyncHandler(async (req, res) => {
    await knowledge.deleteDocument(currentUser(req), req.params.id);
    res.json({ success: true, data: null });
  }),
);

/** Re-mirrors lessons and fills in missing embeddings. Safe to run repeatedly. */
aiRouter.post(
  '/knowledge/sync',
  staffOnly,
  asyncHandler(async (_req, res) => {
    const lessons = await knowledge.syncLessons();
    const embedded = await knowledge.embedPending();
    res.json({ success: true, data: { lessons, embedded, knowledge: await knowledge.knowledgeStats() } });
  }),
);

/** Retrieval on its own, with each leg's rank exposed: no model call. */
aiRouter.post(
  '/knowledge/search',
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        query: z.string().trim().min(2).max(300),
        courseId: z.string().max(64).optional(),
        k: z.coerce.number().int().min(1).max(12).default(6),
      })
      .parse(req.body);
    const result = await search(currentUser(req), [input.query], { courseId: input.courseId, k: input.k });
    res.json({ success: true, data: result });
  }),
);

/* -------------------------------------------------------------- pipelines */

aiRouter.post(
  '/questions/generate',
  staffOnly,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        courseId: z.string().min(1).max(64),
        topic: z.string().trim().min(2).max(160),
        count: z.coerce.number().int().min(1).max(10),
        type: z.enum(QUESTION_TYPES).default('SINGLE'),
        difficulty: z.nativeEnum(Difficulty).default('MEDIUM'),
        marks: z.coerce.number().min(0.5).max(20).default(1),
        bankId: z.string().max(64).optional(),
      })
      .parse(req.body);
    // Checked here so a wrong course or bank is a 4xx, not an error inside the stream.
    const course = await prisma.course.count({ where: { id: input.courseId } });
    if (!course) throw notFound('Course');
    const stream = openStream(res);
    await pipelines.runAuthor(currentUser(req), input, stream.emit, stream.signal);
    stream.end();
  }),
);

aiRouter.get(
  '/debrief/:attemptId',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { run: await pipelines.latestDebrief(currentUser(req), req.params.attemptId) } });
  }),
);

aiRouter.post(
  '/debrief/:attemptId',
  asyncHandler(async (req, res) => {
    // Access is settled before the stream opens; runDebrief repeats it as its own guard.
    await pipelines.latestDebrief(currentUser(req), req.params.attemptId);
    const stream = openStream(res);
    await pipelines.runDebrief(currentUser(req), req.params.attemptId, stream.emit, stream.signal);
    stream.end();
  }),
);

/* ------------------------------------------------------------------- runs */

aiRouter.get(
  '/runs',
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(40),
        kind: z.enum(['ASK', 'AUTHOR', 'DEBRIEF']).optional(),
      })
      .parse(req.query);
    res.json({ success: true, data: await pipelines.listRuns(currentUser(req), query) });
  }),
);

aiRouter.get(
  '/runs/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { run: await pipelines.getRun(currentUser(req), req.params.id) } });
  }),
);
