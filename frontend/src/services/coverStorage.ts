const DATABASE_NAME = 'conext-covers';
const STORE_NAME = 'reviewer-covers';
let databasePromise: Promise<IDBDatabase> | null = null;

const openDatabase = () => {
  if (!('indexedDB' in window)) return Promise.reject(new Error('Cover storage is unavailable in this browser.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open cover storage.'));
    });
  }
  return databasePromise;
};

export const getReviewerCover = async (documentId: number): Promise<Blob | null> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(documentId);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Could not load this cover.'));
  });
};

export const saveReviewerCover = async (documentId: number, cover: Blob): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(cover, documentId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save this cover.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save this cover.'));
  });
};

export const removeReviewerCover = async (documentId: number): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(documentId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove this cover.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not remove this cover.'));
  });
};
