import type { Page } from '@playwright/test';

/**
 * Clear all storage (localStorage, sessionStorage, IndexedDB)
 */
export async function clearAllStorage(page: Page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('ChatHistory');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Resolve even on error
      request.onblocked = () => resolve();
    });
  });
}

/**
 * Set providers in localStorage
 */
export async function setProviders(page: Page, providers: any[]) {
  await page.evaluate((provs) => {
    localStorage.setItem('providers', JSON.stringify(provs));
  }, providers);
}

/**
 * Set current model in localStorage
 */
export async function setCurrentModel(page: Page, model: any) {
  await page.evaluate((m) => {
    localStorage.setItem('currentModel', JSON.stringify(m));
  }, model);
}

interface TestThread {
  threadId: string;
  title: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Setup threads (with optional messages) in IndexedDB
 * Uses addInitScript to run before app loads, then waits for completion after reload
 */
export async function setupThreads(page: Page, threads: TestThread[]) {
  // Register init script that will run on next page load
  await page.addInitScript((threadsList: TestThread[]) => {
    // Set flag to indicate setup is in progress
    (window as any).__testDataReady = false;

    const request = indexedDB.open('ChatHistory', 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('threads')) {
        const store = db.createObjectStore('threads', { keyPath: 'threadId' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', { keyPath: 'id' });
        store.createIndex('threadId', 'threadId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['threads', 'messages'], 'readwrite');
      const threadsStore = transaction.objectStore('threads');
      const messagesStore = transaction.objectStore('messages');

      threadsList.forEach((thread) => {
        // Add thread
        threadsStore.put({
          threadId: thread.threadId,
          title: thread.title,
          lastEditDate: Date.now(),
        });

        // Add messages if provided
        if (thread.messages) {
          thread.messages.forEach((msg, index) => {
            messagesStore.put({
              id: `${thread.threadId}-msg-${index}`,
              threadId: thread.threadId,
              message: {
                id: `${thread.threadId}-msg-${index}`,
                role: msg.role,
                content: [{ type: 'text', text: msg.content }],
              },
              timestamp: Date.now() + index,
            });
          });
        }
      });

      transaction.oncomplete = () => {
        db.close();
        (window as any).__testDataReady = true;
      };
    };
  }, threads);
}

/**
 * Wait for test data to be ready after page reload
 */
export async function waitForTestData(page: Page, timeout = 5000) {
  await page.waitForFunction(
    () => (window as any).__testDataReady === true,
    { timeout }
  );
}
