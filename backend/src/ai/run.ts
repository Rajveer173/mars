import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { getProvider, type Usage } from './provider.js';

/**
 * One pipeline execution. Every agent works inside `run.step(...)`, which times
 * it, counts its tokens, stores it and tells the client, so the trace a user
 * sees is the trace that actually ran rather than a description of one.
 */

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

export interface StepView {
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
  | { type: 'step'; step: StepView }
  | { type: 'token'; text: string }
  /** The streamed answer was superseded (a revision after a failed grounding check). */
  | { type: 'replace'; text: string }
  | { type: 'done'; data: unknown }
  | { type: 'error'; message: string };

export type Emit = (event: RunEvent) => void;

export interface StepResult<T> {
  value: T;
  /** Shown in the trace: queries, ranked hits, verdicts. Must be JSON-serialisable. */
  detail?: unknown;
}

export class Run {
  private ordinal = 0;
  private readonly startedAt = Date.now();
  private readonly usage: Usage = { promptTokens: 0, completionTokens: 0 };

  private constructor(
    readonly id: string,
    readonly emit: Emit,
    readonly signal: AbortSignal | undefined,
  ) {}

  static async start(
    init: { userId: string; kind: 'ASK' | 'AUTHOR' | 'DEBRIEF'; input: string; refId?: string },
    emit: Emit,
    signal?: AbortSignal,
  ): Promise<Run> {
    const row = await prisma.agentRun.create({
      data: { ...init, input: init.input.slice(0, 10_000), model: getProvider().chatModel },
      select: { id: true },
    });
    emit({ type: 'run', runId: row.id, kind: init.kind });
    return new Run(row.id, emit, signal);
  }

  async step<T>(
    agent: AgentName,
    title: string,
    work: (spend: (usage: Usage) => void) => Promise<StepResult<T>>,
  ): Promise<T> {
    const ordinal = this.ordinal;
    this.ordinal += 1;
    const spent: Usage = { promptTokens: 0, completionTokens: 0 };
    const view = (status: StepView['status'], began: number, detail: unknown): StepView => ({
      ordinal,
      agent,
      title,
      status,
      latencyMs: Date.now() - began,
      promptTokens: spent.promptTokens,
      completionTokens: spent.completionTokens,
      detail,
    });

    const began = Date.now();
    this.emit({ type: 'step', step: view('RUNNING', began, null) });
    let final: StepView;
    try {
      const result = await work((usage) => {
        spent.promptTokens += usage.promptTokens;
        spent.completionTokens += usage.completionTokens;
      });
      final = view('DONE', began, result.detail ?? null);
      await this.record(final);
      return result.value;
    } catch (err) {
      final = view('FAILED', began, { error: (err as Error).message });
      await this.record(final);
      throw err;
    }
  }

  private async record(step: StepView): Promise<void> {
    this.usage.promptTokens += step.promptTokens;
    this.usage.completionTokens += step.completionTokens;
    this.emit({ type: 'step', step });
    const { detail, ...columns } = step;
    await prisma.agentStep.create({
      data: {
        ...columns,
        runId: this.id,
        detail: detail == null ? Prisma.JsonNull : (detail as Prisma.InputJsonValue),
      },
    });
  }

  private close(data: Prisma.AgentRunUpdateInput) {
    return prisma.agentRun.update({
      where: { id: this.id },
      data: {
        ...data,
        promptTokens: this.usage.promptTokens,
        completionTokens: this.usage.completionTokens,
        latencyMs: Date.now() - this.startedAt,
        finishedAt: new Date(),
      },
    });
  }

  async finish(fields: { output: string; route?: string; grounded?: string | null }): Promise<void> {
    await this.close({ status: 'DONE', ...fields });
  }

  async fail(message: string): Promise<void> {
    try {
      await this.close({ status: 'FAILED', error: message.slice(0, 190) });
    } catch (err) {
      logger.error('[ai] could not mark run as failed', err);
    }
  }
}
