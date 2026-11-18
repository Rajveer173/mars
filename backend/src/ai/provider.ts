import type { ZodType, ZodTypeDef } from 'zod/v3';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * The only place that talks to a model. Everything speaks the OpenAI wire format
 * (`/chat/completions`, `/embeddings`), which OpenAI, OpenRouter, Gemini, Mistral,
 * Together and most gateways accept, so switching provider is an env change.
 *
 * A failed call throws LlmError. Nothing here falls back to a canned answer: an
 * agent that cannot reach its model fails the run and says so.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask for a JSON object instead of prose. */
  json?: boolean;
  /** When set, the reply is streamed and each text delta is passed here. */
  onToken?: (text: string) => void;
  signal?: AbortSignal;
}

export interface ChatResult {
  text: string;
  usage: Usage;
}

export interface Provider {
  readonly chatModel: string;
  readonly embedModel: string | null;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

const RETRY_DELAY_MS = 1500;
const trimSlash = (url: string) => url.replace(/\/+$/, '');
// Providers that omit usage still need a number for the trace; ~4 chars per token.
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const messageFor = (status: number): string => {
  if (status === 401 || status === 403) return 'The model provider rejected the API key.';
  if (status === 402) return 'The model account is out of credit.';
  if (status === 404) return 'The configured model was not found at the provider.';
  if (status === 429) return 'The model is rate limited. Try again in a minute.';
  return `The model provider returned an error (${status}).`;
};

async function post(url: string, key: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(env.LLM_TIMEOUT_MS);
  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          // OpenRouter attributes traffic by these; other providers ignore them.
          'HTTP-Referer': env.FRONTEND_URL,
          'X-Title': 'Multi-Agentic RAG System',
        },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      });
    } catch (err) {
      if (signal?.aborted) throw new LlmError('The request was cancelled.');
      const timedOut = (err as Error).name === 'TimeoutError';
      throw new LlmError(timedOut ? 'The model did not answer in time.' : 'The model endpoint is unreachable.');
    }
    if (res.ok) return res;

    const detail = (await res.text()).slice(0, 300);
    // One retry covers a brief rate limit or a provider hiccup without stalling the run.
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
    logger.warn(`[ai] ${res.status} from ${new URL(url).host}: ${detail}`);
    throw new LlmError(messageFor(res.status), res.status);
  }
}

/** LLM_API_KEY / EMBED_API_KEY may hold several comma-separated keys, tried in order. */
export const parseKeys = (raw: string): string[] =>
  raw
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

// Errors tied to one key or account (bad key, no credit, rate limit, provider outage).
// A 400 or 404 is about the request or model, so another key would fail the same way.
const keyCanFallBack = (status?: number) =>
  status === 401 || status === 402 || status === 403 || status === 429 || (status !== undefined && status >= 500);

export async function postWithFallback(url: string, keys: string[], body: unknown, signal?: AbortSignal): Promise<Response> {
  if (keys.length === 0) return post(url, '', body, signal);
  for (let i = 0; ; i += 1) {
    try {
      return await post(url, keys[i], body, signal);
    } catch (err) {
      const last = i === keys.length - 1;
      if (last || !(err instanceof LlmError) || !keyCanFallBack(err.status)) throw err;
      logger.warn(`[ai] key ${i + 1}/${keys.length} failed (${err.status}); trying key ${i + 2}`);
    }
  }
}

interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

const toUsage = (wire: WireUsage | undefined, prompt: string, completion: string): Usage => ({
  promptTokens: wire?.prompt_tokens ?? estimateTokens(prompt),
  completionTokens: wire?.completion_tokens ?? estimateTokens(completion),
});

function httpProvider(): Provider {
  const chatBase = trimSlash(env.LLM_BASE_URL);
  const embedBase = trimSlash(env.EMBED_BASE_URL || env.LLM_BASE_URL);
  const chatKeys = parseKeys(env.LLM_API_KEY);
  const embedKeys = parseKeys(env.EMBED_API_KEY || env.LLM_API_KEY);
  const openRouter = /openrouter\.ai/.test(chatBase);

  return {
    chatModel: env.LLM_MODEL,
    embedModel: env.EMBED_MODEL || null,

    async chat(messages, opts = {}) {
      const prompt = messages.map((m) => m.content).join('\n');
      const body: Record<string, unknown> = {
        model: env.LLM_MODEL,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1200,
      };
      // Reasoning models would spend the token budget thinking before they answer.
      if (openRouter) body.reasoning = { enabled: false };
      if (opts.json) body.response_format = { type: 'json_object' };

      if (!opts.onToken) {
        const res = await postWithFallback(`${chatBase}/chat/completions`, chatKeys, body, opts.signal);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: WireUsage };
        const text = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (!text) throw new LlmError('The model returned an empty reply.');
        return { text, usage: toUsage(data.usage, prompt, text) };
      }

      body.stream = true;
      body.stream_options = { include_usage: true };
      const res = await postWithFallback(`${chatBase}/chat/completions`, chatKeys, body, opts.signal);
      if (!res.body) throw new LlmError('The model returned an empty reply.');

      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      let wire: WireUsage | undefined;
      for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(part, { stream: true });
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const event = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
              usage?: WireUsage;
            };
            const delta = event.choices?.[0]?.delta?.content;
            if (delta) {
              text += delta;
              opts.onToken(delta);
            }
            if (event.usage) wire = event.usage;
          } catch {
            // Keep-alive comments and provider notices are not JSON; skip them.
          }
        }
      }
      if (!text.trim()) throw new LlmError('The model returned an empty reply.');
      return { text: text.trim(), usage: toUsage(wire, prompt, text) };
    },

    async embed(texts, signal) {
      if (!env.EMBED_MODEL) throw new LlmError('No embedding model is configured.');
      const res = await postWithFallback(`${embedBase}/embeddings`, embedKeys, { model: env.EMBED_MODEL, input: texts }, signal);
      const data = (await res.json()) as { data?: { index: number; embedding: number[] }[] };
      const rows = [...(data.data ?? [])].sort((a, b) => a.index - b.index);
      if (rows.length !== texts.length) throw new LlmError('The embedding provider returned an incomplete batch.');
      return rows.map((row) => row.embedding);
    },
  };
}

let active: Provider | null = null;

export const getProvider = (): Provider => (active ??= httpProvider());

/** Test seam: swap in a scripted provider, or pass null to restore the real one. */
export const setProvider = (provider: Provider | null): void => {
  active = provider;
};

export const chatConfigured = (): boolean => env.LLM_ENABLED && parseKeys(env.LLM_API_KEY).length > 0;
export const embedConfigured = (): boolean =>
  env.LLM_ENABLED && Boolean(env.EMBED_MODEL) && parseKeys(env.EMBED_API_KEY || env.LLM_API_KEY).length > 0;

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

/** What the UI may know about the model setup. Never includes a key. */
export const providerInfo = () => ({
  chat: { connected: chatConfigured(), model: env.LLM_MODEL, host: hostOf(env.LLM_BASE_URL) },
  embeddings: {
    connected: embedConfigured(),
    model: env.EMBED_MODEL || null,
    host: hostOf(env.EMBED_BASE_URL || env.LLM_BASE_URL),
  },
  verify: env.AI_VERIFY,
});

const parseJsonObject = (raw: string): unknown => {
  // Models wrap JSON in a code fence or a sentence often enough to plan for it.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in the reply');
  return JSON.parse(raw.slice(start, end + 1));
};

/**
 * Chat that must come back as JSON matching `schema`. A reply that does not parse
 * or validate is sent back to the model once with the error; a second failure throws.
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  // Input is left open so a schema with defaults still infers T as its parsed output.
  schema: ZodType<T, ZodTypeDef, unknown>,
  opts: Omit<ChatOptions, 'json' | 'onToken'> = {},
): Promise<{ data: T; usage: Usage }> {
  const provider = getProvider();
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  let conversation = messages;

  for (let attempt = 0; ; attempt += 1) {
    const reply = await provider.chat(conversation, { ...opts, json: true });
    usage.promptTokens += reply.usage.promptTokens;
    usage.completionTokens += reply.usage.completionTokens;

    let problem: string;
    try {
      const parsed = schema.safeParse(parseJsonObject(reply.text));
      if (parsed.success) return { data: parsed.data, usage };
      problem = parsed.error.issues
        .slice(0, 4)
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
    } catch (err) {
      problem = (err as Error).message;
    }

    if (attempt > 0) throw new LlmError(`The model did not return usable JSON (${problem}).`);
    conversation = [
      ...messages,
      { role: 'assistant', content: reply.text },
      { role: 'user', content: `That reply was rejected: ${problem}. Return only the corrected JSON object.` },
    ];
  }
}
