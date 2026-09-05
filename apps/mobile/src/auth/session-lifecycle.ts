export class SessionLifecycle {
  generation = 0;
  controller = new AbortController();
  private tail: Promise<unknown> = Promise.resolve();

  invalidate() {
    this.generation++;
    this.controller.abort();
    this.controller = new AbortController();
    return this.generation;
  }

  current(generation: number) { return generation === this.generation; }

  enqueue<T>(generation: number, operation: () => Promise<T>): Promise<T | undefined> {
    const next = this.tail.then(async () => {
      if (this.current(generation)) return operation();
    });
    // Uma falha de armazenamento nao impede a limpeza posterior.
    this.tail = next.catch(() => {});
    return next;
  }
}
