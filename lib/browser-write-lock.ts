export async function withBrowserWriteLock<T>(operation: () => T | Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return Promise.reject(new Error('Для локального сохранения нужен современный браузер и HTTPS или localhost.'));
  }
  return navigator.locks.request('motors-local-data', { mode: 'exclusive' }, operation);
}
