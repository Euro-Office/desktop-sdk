import type { ThreadsStorage } from "@onlyoffice/ai-chat";
import type { Model, Thread, TProvider } from "@/shared/lib/types.ts";

export class IndexedDBThreadsStorage implements ThreadsStorage {
  constructor(private getDB: () => IDBDatabase) {}

  async create(
    threadId: string,
    title: string,
    provider?: TProvider,
    model?: Model,
    profileId?: string
  ): Promise<void> {
    const db = this.getDB();
    const threadData: Thread = {
      threadId,
      title,
      lastEditDate: Date.now(),
      provider,
      model,
      profileId,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readwrite");
      const store = transaction.objectStore("threads");
      const request = store.put(threadData);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAll(): Promise<Thread[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readonly");
      const store = transaction.objectStore("threads");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const threads = request.result.sort(
          (a: Thread, b: Thread) =>
            (b.lastEditDate ?? 0) - (a.lastEditDate ?? 0)
        );
        resolve(threads);
      };
    });
  }

  async getById(threadId: string): Promise<Thread | null> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readonly");
      const store = transaction.objectStore("threads");
      const request = store.get(threadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async update(threadId: string, title?: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readwrite");
      const store = transaction.objectStore("threads");
      const getRequest = store.get(threadId);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existingThread = getRequest.result;
        if (!existingThread) {
          reject(new Error("Thread not found"));
          return;
        }

        const updatedThread: Thread = {
          ...existingThread,
          ...(title && { title }),
          lastEditDate: Date.now(),
        };

        const putRequest = store.put(updatedThread);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async touch(
    threadId: string,
    updates?: {
      provider?: TProvider | null;
      model?: Model | null;
      profileId?: string | null;
    }
  ): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readwrite");
      const store = transaction.objectStore("threads");
      const getRequest = store.get(threadId);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existingThread = getRequest.result;
        if (!existingThread) {
          reject(new Error("Thread not found"));
          return;
        }

        const updatedThread: Thread = {
          ...existingThread,
          ...(updates && "provider" in updates
            ? { provider: updates.provider ?? undefined }
            : {}),
          ...(updates && "model" in updates
            ? { model: updates.model ?? undefined }
            : {}),
          ...(updates && "profileId" in updates
            ? { profileId: updates.profileId ?? undefined }
            : {}),
          lastEditDate: Date.now(),
        };

        const putRequest = store.put(updatedThread);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async delete(threadId: string): Promise<void> {
    // Cascading delete is handled by IndexedDBStorage.deleteThread
    // which calls messages.deleteByThread first, then this
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readwrite");
      const store = transaction.objectStore("threads");
      const request = store.delete(threadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
