import { prisma } from '../config/database.js';
import { isStaff } from '../middleware/authorize.js';
import type { Viewer } from '../services/access.service.js';
import { logger } from '../utils/logger.js';
import { embedConfigured, getProvider } from './provider.js';

/**
 * Hybrid retrieval: BM25 over the text and cosine similarity over embeddings,
 * each run once per query, then merged with reciprocal rank fusion.
 *
 * shortcut: both legs score the caller's scoped chunks in process (one SELECT,
 * then arithmetic). That is exact and fast up to roughly 20k chunks; past that,
 * move the keyword leg to a FULLTEXT index and the vector leg to a vector store.
 */

export interface Hit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceType: string;
  lessonId: string | null;
  course: { id: string; name: string; code: string } | null;
  heading: string | null;
  content: string;
  score: number;
  /** 1-based best rank in each leg across the queries; null when the leg missed it. */
  keywordRank: number | null;
  vectorRank: number | null;
}

export interface SearchResult {
  hits: Hit[];
  mode: 'hybrid' | 'keyword';
  scanned: number;
  queries: string[];
}

const STOPWORDS = new Set(
  'a an and are as at be by can do does for from how i in is it its me my of on or that the this to was what when where which who why will with you your explain describe define tell about'.split(
    ' ',
  ),
);

/** Lowercased word tokens with plural "s" folded, so "deadlocks" finds "deadlock". */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.toLowerCase().match(/[a-z0-9+#]+/g) ?? []) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    tokens.push(raw.length > 3 && raw.endsWith('s') && !raw.endsWith('ss') ? raw.slice(0, -1) : raw);
  }
  return tokens;
}

/** Okapi BM25 score of every document for one query. */
export function bm25(docs: string[][], query: string[], k1 = 1.5, b = 0.75): number[] {
  const terms = [...new Set(query)];
  if (!docs.length || !terms.length) return docs.map(() => 0);

  const avgLength = docs.reduce((n, d) => n + d.length, 0) / docs.length || 1;
  const frequencies = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const token of doc) tf.set(token, (tf.get(token) ?? 0) + 1);
    return tf;
  });
  const idf = new Map(
    terms.map((term) => {
      const containing = frequencies.reduce((n, tf) => n + (tf.has(term) ? 1 : 0), 0);
      return [term, Math.log(1 + (docs.length - containing + 0.5) / (containing + 0.5))];
    }),
  );

  return docs.map((doc, i) => {
    let score = 0;
    for (const term of terms) {
      const tf = frequencies[i].get(term);
      if (!tf) continue;
      score += (idf.get(term)! * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / avgLength));
    }
    return score;
  });
}

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

/** Reciprocal rank fusion: an id scores 1/(k + rank) in every ranking it appears in. */
export function rrf(rankings: string[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1)));
  }
  return scores;
}

export const toVector = (bytes: Uint8Array): Float32Array =>
  // Copy first: a driver buffer may sit at an offset that is not 4-byte aligned.
  new Float32Array(Uint8Array.from(bytes).buffer);

export const toBytes = (vector: number[]): Uint8Array<ArrayBuffer> =>
  new Uint8Array(new Float32Array(vector).buffer);

/** Courses whose material the viewer may retrieve; null means every course. */
export async function courseScope(viewer: Viewer): Promise<string[] | null> {
  if (isStaff(viewer.role) || viewer.role === 'PROCTOR') return null;
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: viewer.id, status: 'active' },
    select: { courseId: true },
  });
  return enrollments.map((e) => e.courseId);
}

const PER_LEG = 24;
const PER_DOCUMENT = 3;
// Below this similarity a vector match is noise, not evidence.
const MIN_SIMILARITY = 0.25;

export async function search(
  viewer: Viewer,
  queries: string[],
  opts: { courseId?: string; k?: number; signal?: AbortSignal } = {},
): Promise<SearchResult> {
  const cleaned = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, 4);
  const scope = await courseScope(viewer);
  const empty: SearchResult = { hits: [], mode: 'keyword', scanned: 0, queries: cleaned };
  if (!cleaned.length) return empty;
  // Asking for a course outside the viewer's scope returns nothing rather than leaking it.
  if (opts.courseId && scope && !scope.includes(opts.courseId)) return empty;

  const where = opts.courseId
    ? { courseId: opts.courseId }
    : scope
      ? { OR: [{ courseId: { in: scope } }, { courseId: null }] }
      : {};
  const rows = await prisma.knowledgeChunk.findMany({
    where,
    select: {
      id: true,
      heading: true,
      content: true,
      embedding: true,
      embeddingModel: true,
      document: {
        select: {
          id: true,
          title: true,
          sourceType: true,
          lessonId: true,
          course: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!rows.length) return empty;

  const tokenized = rows.map((row) => tokenize(`${row.document.title} ${row.heading ?? ''} ${row.content}`));
  const keywordRank = new Map<string, number>();
  const vectorRank = new Map<string, number>();
  const rankings: string[][] = [];
  const note = (ranks: Map<string, number>, ranking: string[]) =>
    ranking.forEach((id, i) => ranks.set(id, Math.min(ranks.get(id) ?? Infinity, i + 1)));

  for (const query of cleaned) {
    const scores = bm25(tokenized, tokenize(query));
    const ranking = scores
      .map((score, i) => ({ id: rows[i].id, score }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_LEG)
      .map((entry) => entry.id);
    note(keywordRank, ranking);
    rankings.push(ranking);
  }

  let mode: SearchResult['mode'] = 'keyword';
  const model = getProvider().embedModel;
  const embedded = rows.filter((row) => row.embedding && row.embeddingModel === model);
  if (embedConfigured() && embedded.length) {
    try {
      const vectors = embedded.map((row) => toVector(row.embedding!));
      const queryVectors = await getProvider().embed(cleaned, opts.signal);
      for (const queryVector of queryVectors) {
        const q = new Float32Array(queryVector);
        const ranking = vectors
          .map((vector, i) => ({ id: embedded[i].id, score: cosine(q, vector) }))
          .filter((entry) => entry.score >= MIN_SIMILARITY)
          .sort((a, b) => b.score - a.score)
          .slice(0, PER_LEG)
          .map((entry) => entry.id);
        note(vectorRank, ranking);
        rankings.push(ranking);
      }
      mode = 'hybrid';
    } catch (err) {
      // Retrieval must survive an embedding outage; the keyword leg still answers.
      logger.warn(`[ai] vector leg skipped: ${(err as Error).message}`);
    }
  }

  const fused = [...rrf(rankings).entries()].sort((a, b) => b[1] - a[1]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const perDocument = new Map<string, number>();
  const hits: Hit[] = [];
  for (const [id, score] of fused) {
    const row = byId.get(id)!;
    const taken = perDocument.get(row.document.id) ?? 0;
    // One long lesson must not crowd every other source out of the context.
    if (taken >= PER_DOCUMENT) continue;
    perDocument.set(row.document.id, taken + 1);
    hits.push({
      chunkId: row.id,
      documentId: row.document.id,
      documentTitle: row.document.title,
      sourceType: row.document.sourceType,
      lessonId: row.document.lessonId,
      course: row.document.course,
      heading: row.heading,
      content: row.content,
      score: Math.round(score * 10000) / 10000,
      keywordRank: keywordRank.get(id) ?? null,
      vectorRank: vectorRank.get(id) ?? null,
    });
    if (hits.length >= (opts.k ?? 6)) break;
  }
  return { hits, mode, scanned: rows.length, queries: cleaned };
}
