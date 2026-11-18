import { createHash } from 'node:crypto';
import { prisma } from '../config/database.js';
import { isStaff } from '../middleware/authorize.js';
import type { Viewer } from '../services/access.service.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { chunkText } from './chunker.js';
import { embedConfigured, getProvider } from './provider.js';
import { courseScope, toBytes } from './retrieval.js';

/**
 * The knowledge base: every lesson is mirrored as a document, and staff can add
 * their own material. Indexing is two separate steps so the system works before
 * an embedding model exists: chunking always happens, vectors are filled in
 * whenever a model is configured (at upload, on boot, or from the sync endpoint).
 */

const EMBED_BATCH = 48;
const MAX_DOCUMENT_CHARS = 400_000;

const hash = (text: string) => createHash('sha256').update(text).digest('hex');

export async function extractText(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<string> {
  const name = file.originalname.toLowerCase();
  if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    const { extractText: extractPdf } = await import('unpdf');
    const { text } = await extractPdf(new Uint8Array(file.buffer), { mergePages: true });
    return text;
  }
  if (file.mimetype.startsWith('text/') || /\.(md|markdown|txt)$/.test(name)) {
    return file.buffer.toString('utf8');
  }
  throw badRequest('Upload a PDF, Markdown or plain-text file.');
}

/** Embeds chunks that have no vector for the current model. Returns how many it filled. */
export async function embedPending(documentId?: string): Promise<number> {
  if (!embedConfigured()) return 0;
  const provider = getProvider();
  let filled = 0;
  for (;;) {
    const batch = await prisma.knowledgeChunk.findMany({
      where: {
        ...(documentId ? { documentId } : {}),
        OR: [{ embedding: null }, { embeddingModel: { not: provider.embedModel } }],
      },
      select: { id: true, heading: true, content: true, document: { select: { title: true } } },
      take: EMBED_BATCH,
    });
    if (!batch.length) return filled;
    const vectors = await provider.embed(
      // The title and heading are embedded with the text so a chunk carries its topic.
      batch.map((c) => [c.document.title, c.heading, c.content].filter(Boolean).join('\n')),
    );
    await prisma.$transaction(
      batch.map((chunk, i) =>
        prisma.knowledgeChunk.update({
          where: { id: chunk.id },
          data: { embedding: toBytes(vectors[i]), embeddingModel: provider.embedModel },
        }),
      ),
    );
    filled += batch.length;
  }
}

async function indexDocument(documentId: string, courseId: string | null, text: string): Promise<number> {
  const chunks = chunkText(text);
  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
    prisma.knowledgeChunk.createMany({
      data: chunks.map((chunk) => ({ documentId, courseId, ...chunk })),
    }),
    prisma.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        status: chunks.length ? 'INDEXED' : 'FAILED',
        error: chunks.length ? null : 'No readable text was found in this document.',
        charCount: text.length,
        contentHash: hash(text),
      },
    }),
  ]);
  try {
    await embedPending(documentId);
  } catch (err) {
    // The chunks are searchable by keyword already; vectors are retried on the next sync.
    logger.warn(`[ai] embedding deferred for document ${documentId}: ${(err as Error).message}`);
  }
  return chunks.length;
}

/** Mirrors lesson text into the knowledge base; unchanged lessons are skipped. */
export async function syncLessons(): Promise<{ indexed: number; unchanged: number; removed: number }> {
  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      title: true,
      content: true,
      module: { select: { courseId: true } },
      knowledgeDocument: { select: { id: true, contentHash: true, title: true } },
    },
  });
  let indexed = 0;
  let unchanged = 0;
  let removed = 0;
  for (const lesson of lessons) {
    const text = lesson.content?.trim() ?? '';
    const existing = lesson.knowledgeDocument;
    if (!text) {
      if (existing) {
        await prisma.knowledgeDocument.delete({ where: { id: existing.id } });
        removed += 1;
      }
      continue;
    }
    if (existing && existing.contentHash === hash(text) && existing.title === lesson.title) {
      unchanged += 1;
      continue;
    }
    const document = existing
      ? await prisma.knowledgeDocument.update({
          where: { id: existing.id },
          data: { title: lesson.title, courseId: lesson.module.courseId },
        })
      : await prisma.knowledgeDocument.create({
          data: {
            title: lesson.title,
            sourceType: 'LESSON',
            mimeType: 'text/markdown',
            lessonId: lesson.id,
            courseId: lesson.module.courseId,
          },
        });
    await indexDocument(document.id, lesson.module.courseId, text);
    indexed += 1;
  }
  return { indexed, unchanged, removed };
}

export async function addDocument(
  viewer: Viewer,
  input: { title: string; text: string; courseId?: string | null; mimeType?: string },
) {
  const text = input.text.trim();
  if (text.length < 40) throw badRequest('The document has too little text to index.');
  if (text.length > MAX_DOCUMENT_CHARS) throw badRequest('The document is too large. Split it and upload the parts.');
  const courseId = input.courseId || null;
  if (courseId && !(await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
    throw notFound('Course');
  }
  const document = await prisma.knowledgeDocument.create({
    data: {
      title: input.title.trim(),
      sourceType: 'UPLOAD',
      mimeType: input.mimeType ?? 'text/markdown',
      courseId,
      uploadedById: viewer.id,
    },
  });
  await indexDocument(document.id, courseId, text);
  return getDocument(viewer, document.id);
}

const documentSummary = {
  id: true,
  title: true,
  sourceType: true,
  mimeType: true,
  status: true,
  error: true,
  charCount: true,
  lessonId: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { id: true, name: true, code: true } },
  uploadedBy: { select: { id: true, fullName: true } },
  _count: { select: { chunks: true } },
} as const;

const scopeFilter = async (viewer: Viewer) => {
  const scope = await courseScope(viewer);
  return scope ? { OR: [{ courseId: { in: scope } }, { courseId: null }] } : {};
};

export async function listDocuments(viewer: Viewer, courseId?: string) {
  const [documents, embedded] = await Promise.all([
    prisma.knowledgeDocument.findMany({
      where: { ...(await scopeFilter(viewer)), ...(courseId ? { courseId } : {}) },
      select: documentSummary,
      orderBy: [{ courseId: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.knowledgeChunk.groupBy({
      by: ['documentId'],
      where: { embedding: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const embeddedBy = new Map(embedded.map((row) => [row.documentId, row._count._all]));
  return documents.map(({ _count, ...document }) => ({
    ...document,
    chunks: _count.chunks,
    embeddedChunks: embeddedBy.get(document.id) ?? 0,
  }));
}

export async function getDocument(viewer: Viewer, id: string) {
  const document = await prisma.knowledgeDocument.findFirst({
    where: { id, ...(await scopeFilter(viewer)) },
    select: {
      ...documentSummary,
      chunks: {
        select: { id: true, ordinal: true, heading: true, content: true, embeddingModel: true },
        orderBy: { ordinal: 'asc' },
      },
    },
  });
  // Out-of-scope reads answer 404 so document ids cannot be probed.
  if (!document) throw notFound('Document');
  const { _count, ...rest } = document;
  return { ...rest, chunkCount: _count.chunks };
}

export async function deleteDocument(viewer: Viewer, id: string): Promise<void> {
  if (!isStaff(viewer.role)) throw forbidden();
  const document = await prisma.knowledgeDocument.findUnique({ where: { id }, select: { sourceType: true } });
  if (!document) throw notFound('Document');
  if (document.sourceType === 'LESSON') {
    throw badRequest('This document mirrors a lesson. Edit or delete the lesson instead.');
  }
  await prisma.knowledgeDocument.delete({ where: { id } });
}

export async function knowledgeStats() {
  const [documents, chunks, embedded, courses] = await Promise.all([
    prisma.knowledgeDocument.count(),
    prisma.knowledgeChunk.count(),
    prisma.knowledgeChunk.count({ where: { embedding: { not: null } } }),
    prisma.knowledgeDocument.groupBy({ by: ['courseId'], _count: { _all: true } }),
  ]);
  return { documents, chunks, embeddedChunks: embedded, coursesCovered: courses.filter((c) => c.courseId).length };
}
