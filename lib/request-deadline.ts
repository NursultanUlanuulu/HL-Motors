export const serverRequestTimeoutMs = 20_000;
export const clientRequestTimeoutMs = 25_000;
export const mediaUploadTimeoutMs = 120_000;
export const timeoutMessage = 'Превышено время ожидания. Обновите страницу и проверьте результат перед повторной попыткой.';

export type DeadlineOptions = { signal?: AbortSignal; timeoutMs?: number };

// The timer covers the entire operation, including response bodies and multiple requests.
export async function withDeadline<T>(operation: (signal: AbortSignal) => PromiseLike<T>, options: DeadlineOptions = {}): Promise<T> {
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  signal.throwIfAborted();
  const timer = setTimeout(() => controller.abort(new DOMException(timeoutMessage, 'TimeoutError')), options.timeoutMs ?? serverRequestTimeoutMs);
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const result = await Promise.race([operation(signal), aborted]);
    signal.throwIfAborted();
    return result;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
