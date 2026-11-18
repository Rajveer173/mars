import { ApiError, refreshSession } from './api';
import { useAuth } from './auth';

/** Mirrors the backend's RunEvent union (backend/src/ai/run.ts). */
export type AgentName =
  | 'supervisor'
  | 'retriever'
  | 'records'
  | 'tutor'
  | 'verifier'
  | 'examiner'
  | 'reviewer'
  | 'coach'
  | 'librarian';

export interface Step {
  ordinal: number;
  agent: AgentName;
  title: string;
  status: 'RUNNING' | 'DONE' | 'FAILED';
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  detail: unknown;
}

export type RunEvent =
  | { type: 'run'; runId: string; kind: string }
  | { type: 'step'; step: Step }
  | { type: 'token'; text: string }
  | { type: 'replace'; text: string }
  | { type: 'done'; data: unknown }
  | { type: 'error'; message: string };

const post = (url: string, body: unknown, signal?: AbortSignal) =>
  fetch(`/api${url}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${useAuth.getState().accessToken ?? ''}`,
    },
    body: JSON.stringify(body ?? {}),
    signal,
  });

/**
 * POSTs to a pipeline endpoint and feeds its server-sent events to `onEvent`.
 * EventSource cannot POST or send an Authorization header, so the stream is
 * read by hand. A rejected request (bad input, no model connected) arrives as a
 * normal JSON error before any event and is thrown as ApiError.
 */
export async function streamRun(
  url: string,
  body: unknown,
  onEvent: (event: RunEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let response = await post(url, body, signal);
  if (response.status === 401) {
    await refreshSession();
    response = await post(url, body, signal);
  }
  if (!response.ok || !response.body) {
    const failure = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new ApiError(failure?.message ?? 'The request failed.', response.status, failure?.code ?? null);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      if (frame.startsWith('data: ')) onEvent(JSON.parse(frame.slice(6)) as RunEvent);
    }
  }
}

/** Folds a step event into the list, replacing the RUNNING entry with its final state. */
export const upsertStep = (steps: Step[], step: Step): Step[] => {
  const index = steps.findIndex((s) => s.ordinal === step.ordinal);
  return index < 0 ? [...steps, step] : steps.map((s, i) => (i === index ? step : s));
};
