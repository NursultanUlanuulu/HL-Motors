const prefix = 'hl-media:';

export const isLocalMedia = (source: string) => source.startsWith(prefix);

function openMedia(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hl-motors-media', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Закройте другие вкладки админки и повторите.'));
  });
}

export async function storeMedia(files: File[]): Promise<string[]> {
  const database = await openMedia();
  const ids = files.map(() => `${prefix}${crypto.randomUUID()}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('files', 'readwrite');
      files.forEach((file, index) => transaction.objectStore('files').put(file, ids[index]));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Не удалось сохранить файлы.'));
      transaction.onerror = () => reject(transaction.error);
    });
    return ids;
  } finally { database.close(); }
}

export async function readMedia(source: string): Promise<Blob | undefined> {
  const database = await openMedia();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const request = database.transaction('files').objectStore('files').get(source);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

export async function removeMedia(sources: string[]): Promise<void> {
  const local = sources.filter(isLocalMedia);
  if (!local.length) return;
  const database = await openMedia();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('files', 'readwrite');
      local.forEach((source) => transaction.objectStore('files').delete(source));
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}
