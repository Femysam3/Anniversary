export type SavedMedia = {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  caption: string;
  date: string;
  description: string;
  blob: Blob;
  createdAt: number;
};

const DB_NAME = 'one-year-together';
const STORE = 'media';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local media storage.'));
  });
}

export async function saveMedia(media: SavedMedia): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(media);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save this media.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Saving this media was cancelled.'));
  });
  db.close();
}

export async function getMedia(): Promise<SavedMedia[]> {
  const db = await openDatabase();
  const records = await new Promise<SavedMedia[]>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as SavedMedia[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error ?? new Error('Could not load your saved media.'));
  });
  db.close();
  return records;
}

export async function removeMedia(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove this media.'));
  });
  db.close();
}
