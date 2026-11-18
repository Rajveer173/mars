import { afterEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { z } from 'zod/v3';
import { citedNumbers, judgeDrafts, type Draft, type Review } from '../src/ai/agents.js';
import { chunkText } from '../src/ai/chunker.js';
import { chatJson, setProvider, type Provider } from '../src/ai/provider.js';
import { bm25, cosine, rrf, toBytes, toVector, tokenize } from '../src/ai/retrieval.js';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('chunker', () => {
  const lesson = [
    '# Normalisation',
    'Intro paragraph about why tables are decomposed.',
    '## Third normal form',
    'A relation is in 3NF when no non-prime attribute depends transitively on a key.',
    '```sql',
    '# not a heading, a comment inside code',
    'SELECT 1;',
    '```',
    '## Boyce-Codd normal form',
    'Every determinant must be a candidate key.',
  ].join('\n\n');

  it('carries the heading path with each chunk and ignores "#" inside code fences', () => {
    const chunks = chunkText(lesson);
    expect(chunks.map((c) => c.heading)).toEqual([
      'Normalisation',
      'Normalisation › Third normal form',
      'Normalisation › Boyce-Codd normal form',
    ]);
    expect(chunks[1].content).toContain('# not a heading');
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1, 2]);
  });

  it('keeps chunks near the target size and repeats a short closing paragraph', () => {
    const paragraph = (n: number) => `Paragraph ${n}. ${'Deadlock needs four conditions to hold together. '.repeat(8)}`;
    const text = `## Deadlock\n\n${[1, 2, 3, 4, 5, 6].map(paragraph).join('\n\n')}\n\nShort closing rule.`;
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(1700);
    const long = `## One\n\n${'x'.repeat(5000)}`;
    expect(chunkText(long).every((c) => c.content.length <= 1100)).toBe(true);
  });

  it('returns nothing for empty text', () => {
    expect(chunkText('   \n\n ')).toEqual([]);
  });
});

describe('retrieval maths', () => {
  const docs = [
    'A deadlock needs mutual exclusion, hold and wait, no preemption and circular wait.',
    'Paging splits memory into frames; the TLB caches page table entries.',
    "Banker's algorithm avoids deadlocks by refusing unsafe resource allocations.",
  ].map(tokenize);

  it('folds plurals and drops stopwords', () => {
    expect(tokenize('What are the Deadlocks?')).toEqual(['deadlock']);
    expect(tokenize('class C++ access')).toEqual(['class', 'c++', 'access']);
  });

  it('ranks the documents that contain the query terms first', () => {
    const scores = bm25(docs, tokenize('conditions for deadlock circular wait'));
    expect(scores[0]).toBeGreaterThan(scores[2]);
    expect(scores[2]).toBeGreaterThan(0);
    expect(scores[1]).toBe(0);
  });

  it('fuses rankings so agreement between legs wins', () => {
    const fused = [...rrf([['a', 'b', 'c'], ['b', 'a', 'd']]).entries()].sort((x, y) => y[1] - x[1]);
    expect(fused.slice(0, 2).map(([id]) => id).sort()).toEqual(['a', 'b']);
    expect(fused.at(-1)![1]).toBeLessThan(fused[0][1]);
  });

  it('computes cosine similarity and round-trips vectors through bytes', () => {
    const a = new Float32Array([1, 0, 0]);
    expect(cosine(a, new Float32Array([1, 0, 0]))).toBeCloseTo(1);
    expect(cosine(a, new Float32Array([0, 1, 0]))).toBeCloseTo(0);
    expect(cosine(a, new Float32Array([1, 0]))).toBe(0);
    expect([...toVector(toBytes([0.5, -2, 3]))]).toEqual([0.5, -2, 3]);
  });
});

describe('question review', () => {
  const draft = (over: Partial<Draft> = {}): Draft => ({
    text: 'Which condition is required for a deadlock?',
    options: ['Circular wait', 'Preemption', 'Starvation', 'Aging'],
    correct: [0],
    explanation: 'Circular wait is one of the four necessary conditions.',
    source: 1,
    bloom: 'REMEMBER',
    ...over,
  });
  const review = (over: Partial<Review> = {}): Review => ({ index: 1, correct: [0], supported: true, issue: '', ...over });

  it('accepts a draft only when the reviewer independently reaches the same key', () => {
    expect(judgeDrafts([draft()], [review()], 'SINGLE', 3)[0].accepted).toBe(true);
    expect(judgeDrafts([draft()], [review({ correct: [1] })], 'SINGLE', 3)[0]).toMatchObject({
      accepted: false,
      reason: 'The Reviewer reached a different answer from the key.',
    });
    expect(judgeDrafts([draft()], [review({ supported: false, issue: 'Ambiguous.' })], 'SINGLE', 3)[0].reason).toBe('Ambiguous.');
    expect(judgeDrafts([draft()], [], 'SINGLE', 3)[0].accepted).toBe(false);
  });

  it('rejects malformed drafts before looking at the review', () => {
    const judge = (d: Draft, type: 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE' = 'SINGLE') => judgeDrafts([d], [review()], type, 2)[0];
    expect(judge(draft({ options: ['a', 'b', 'c'] })).accepted).toBe(false);
    expect(judge(draft({ options: ['Same', 'same', 'x', 'y'] })).accepted).toBe(false);
    expect(judge(draft({ correct: [0, 1] })).accepted).toBe(false);
    expect(judge(draft({ source: 3 })).accepted).toBe(false);
    expect(judge(draft({ correct: [0] }), 'MULTIPLE').accepted).toBe(false);
    expect(judgeDrafts([draft({ correct: [0, 2] })], [review({ correct: [2, 0] })], 'MULTIPLE', 2)[0].accepted).toBe(true);
  });

  it('reads citation numbers and ignores ones that were never retrieved', () => {
    expect([...citedNumbers('Paging uses frames [1]. The TLB caches entries [2, 3]. See [9] and arr[0].', 3)]).toEqual([1, 2, 3]);
  });
});

describe('chatJson', () => {
  afterEach(() => setProvider(null));

  const scripted = (replies: string[]): Provider & { calls: number } => {
    const provider = {
      chatModel: 'test-model',
      embedModel: null,
      calls: 0,
      async chat() {
        const text = replies[provider.calls] ?? replies.at(-1)!;
        provider.calls += 1;
        return { text, usage: { promptTokens: 10, completionTokens: 5 } };
      },
      async embed() {
        return [];
      },
    };
    return provider;
  };
  const schema = z.object({ route: z.enum(['knowledge', 'chat']), queries: z.array(z.string()).default([]) });

  it('parses JSON wrapped in a code fence and applies schema defaults', async () => {
    const provider = scripted(['```json\n{"route":"chat"}\n```']);
    setProvider(provider);
    const { data, usage } = await chatJson([{ role: 'user', content: 'hi' }], schema);
    expect(data).toEqual({ route: 'chat', queries: [] });
    expect(usage).toEqual({ promptTokens: 10, completionTokens: 5 });
  });

  it('sends a rejected reply back once, then gives up', async () => {
    const repaired = scripted(['not json at all', '{"route":"knowledge","queries":["deadlock"]}']);
    setProvider(repaired);
    const { data, usage } = await chatJson([{ role: 'user', content: 'q' }], schema);
    expect(data.queries).toEqual(['deadlock']);
    expect(repaired.calls).toBe(2);
    expect(usage.promptTokens).toBe(20);

    const hopeless = scripted(['{"route":"nope"}']);
    setProvider(hopeless);
    await expect(chatJson([{ role: 'user', content: 'q' }], schema)).rejects.toThrow(/usable JSON/);
    expect(hopeless.calls).toBe(2);
  });
});

describe('AI route access', () => {
  const app = createApp();
  const token = (role: string) =>
    jwt.sign({ sub: 'user_1', role, type: 'access', jti: 'test' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });

  it('requires a signed-in user', async () => {
    expect((await request(app).get('/api/ai/status')).status).toBe(401);
    expect((await request(app).post('/api/ai/knowledge/search').send({ query: 'deadlock' })).status).toBe(401);
  });

  it('keeps knowledge writes and question authoring to staff', async () => {
    const student = { Authorization: `Bearer ${token('STUDENT')}` };
    expect((await request(app).post('/api/ai/knowledge/sync').set(student).send({})).status).toBe(403);
    expect((await request(app).delete('/api/ai/knowledge/documents/abc').set(student)).status).toBe(403);
    expect((await request(app).post('/api/ai/knowledge/documents').set(student).send({ title: 'x', text: 'y' })).status).toBe(403);
    expect(
      (await request(app).post('/api/ai/questions/generate').set(student).send({ courseId: 'c', topic: 'deadlock', count: 2 })).status,
    ).toBe(403);
  });

  it('validates pipeline input before opening a stream', async () => {
    const teacher = { Authorization: `Bearer ${token('TEACHER')}` };
    const res = await request(app).post('/api/ai/questions/generate').set(teacher).send({ courseId: 'c', topic: 'd', count: 99 });
    expect(res.status).toBe(400);
  });
});
