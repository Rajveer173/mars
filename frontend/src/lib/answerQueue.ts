/** Serialises answer writes and retains failed answers until a successful retry. */
export class AnswerQueue<T> {
  private pending = new Map<string, T>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private chain: Promise<void> = Promise.resolve();

  constructor(private write: (id: string, value: T) => Promise<void>, private onError: (error: unknown) => void) {}

  get dirty() { return this.pending.size > 0; }

  set(id: string, value: T, delay = 0) {
    this.pending.set(id, value);
    clearTimeout(this.timers.get(id));
    if (delay) this.timers.set(id, setTimeout(() => { this.timers.delete(id); void this.save(id).catch(this.onError); }, delay));
    else void this.save(id).catch(this.onError);
  }

  private save(id: string): Promise<void> {
    const next = this.chain.catch(() => undefined).then(async () => {
      if (!this.pending.has(id)) return;
      const value = this.pending.get(id)!;
      await this.write(id, value);
      if (this.pending.get(id) === value) this.pending.delete(id);
    });
    this.chain = next;
    return next;
  }

  async flush() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    await this.chain.catch(() => undefined);
    for (const id of this.pending.keys()) await this.save(id);
  }

  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
