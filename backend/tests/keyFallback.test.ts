import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmError, parseKeys, postWithFallback } from '../src/ai/provider.js';

const reply = (status: number) => new Response(status === 200 ? '{}' : 'err', { status });

// Answers by key: the Authorization header decides which status comes back.
function stubFetch(byKey: Record<string, number>) {
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const key = String((init.headers as Record<string, string>).Authorization).replace('Bearer ', '');
      seen.push(key);
      return reply(byKey[key]);
    }),
  );
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API key fallback', () => {
  it('splits a comma-separated key list', () => {
    expect(parseKeys(' a, b ,,c ')).toEqual(['a', 'b', 'c']);
    expect(parseKeys('')).toEqual([]);
  });

  it('moves to the next key when one is out of credit or rejected', async () => {
    const seen = stubFetch({ k1: 402, k2: 401, k3: 200 });
    const res = await postWithFallback('https://llm.test/chat/completions', ['k1', 'k2', 'k3'], {});
    expect(res.status).toBe(200);
    expect(seen).toEqual(['k1', 'k2', 'k3']);
  });

  it('does not try other keys for a request error', async () => {
    const seen = stubFetch({ k1: 404, k2: 200 });
    await expect(postWithFallback('https://llm.test/chat/completions', ['k1', 'k2'], {})).rejects.toBeInstanceOf(LlmError);
    expect(seen).toEqual(['k1']);
  });

  it('throws the last error when every key fails', async () => {
    stubFetch({ k1: 401, k2: 402 });
    await expect(postWithFallback('https://llm.test/chat/completions', ['k1', 'k2'], {})).rejects.toMatchObject({ status: 402 });
  });
});
