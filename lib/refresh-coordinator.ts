// One refresh at a time; mutations and unmounts invalidate outstanding snapshots.
export function createRefreshCoordinator<T>(options: {
  load: (signal: AbortSignal) => Promise<T>;
  onData: (value: T) => void;
  onError: (error: unknown) => void;
}) {
  let flight: { controller: AbortController; promise: Promise<void> } | undefined;
  let mutations = 0;
  let queued = false;

  function invalidate() {
    const previous = flight;
    flight = undefined;
    previous?.controller.abort();
  }

  function refresh(): Promise<void> {
    if (mutations) { queued = true; return Promise.resolve(); }
    if (flight) return flight.promise;
    const next = { controller: new AbortController(), promise: Promise.resolve() };
    flight = next;
    next.promise = Promise.resolve().then(() => options.load(next.controller.signal))
      .then(value => { if (flight === next) options.onData(value); })
      .catch(error => { if (flight === next && !next.controller.signal.aborted) options.onError(error); })
      .finally(() => { if (flight === next) flight = undefined; });
    return next.promise;
  }

  async function mutate<R>(operation: () => Promise<R>): Promise<R> {
    mutations++;
    invalidate();
    try { return await operation(); }
    finally {
      mutations--;
      if (!mutations && queued) { queued = false; void refresh(); }
    }
  }

  return { refresh, mutate, dispose() { queued = false; invalidate(); } };
}
