import { describe, expect, it, vi } from 'vitest';
import { AnswerQueue } from '../src/lib/answerQueue';

describe('answer saving', () => {
  it('flushes the last keystroke before submission, including different questions', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const queue = new AnswerQueue(write, vi.fn());
    queue.set('q1', 'draft', 700);
    queue.set('q1', 'final answer', 700);
    queue.set('q2', 'another answer', 700);
    await queue.flush();
    expect(write.mock.calls).toEqual([['q1', 'final answer'], ['q2', 'another answer']]);
    expect(queue.dirty).toBe(false);
  });
  it('serialises in-flight requests so an older answer cannot overwrite a newer one', async () => {
    let release!: () => void;
    const write = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
    const queue = new AnswerQueue(write, vi.fn());
    queue.set('q1', 'old');
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    queue.set('q1', 'new');
    expect(write).toHaveBeenCalledTimes(1);
    release();
    await queue.flush();
    expect(write.mock.calls).toEqual([['q1', 'old'], ['q1', 'new']]);
  });
  it('retains offline answers and retries them when flushing', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const failed = vi.fn();
    const queue = new AnswerQueue(write, failed);
    queue.set('q1', 'keep this');
    await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce());
    expect(queue.dirty).toBe(true);
    await queue.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(queue.dirty).toBe(false);
  });
  it('rejects submission flushing if an answer still cannot be saved', async () => {
    const queue = new AnswerQueue(vi.fn().mockRejectedValue(new Error('offline')), vi.fn());
    queue.set('q1', 'keep this', 700);
    await expect(queue.flush()).rejects.toThrow('offline');
    expect(queue.dirty).toBe(true);
  });
});
