import type { MessagesStorage, ThreadsStorage } from "@onlyoffice/ai-chat";
import type { Thread } from "@/shared/lib/types.ts";

export class IndexedDBThreadsStorage implements ThreadsStorage {
  private getDB: () => IDBDatabase;
  private messages: MessagesStorage;

  constructor(getDB: () => IDBDatabase, messages: MessagesStorage) {
    this.getDB = getDB;
    this.messages = messages;
  }

  async create(title: string, profileId?: string): Promise<Thread> {
    const db = this.getDB();
    const threadData: Thread = {
      threadId: crypto.randomUUID(),
      title,
      lastEditDate: Date.now(),
      profileId,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readwrite");
      const store = transaction.objectStore("threads");
      const request = store.put(threadData);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(threadData);
    });
  }

  async readAll(): Promise<Thread[]> {
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

  async readById(threadId: string): Promise<Thread | null> {
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
    lastEditDate: number,
    updates?: {
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
          ...(updates && "profileId" in updates
            ? { profileId: updates.profileId ?? undefined }
            : {}),
          lastEditDate,
        };

        const putRequest = store.put(updatedThread);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async delete(threadId: string): Promise<void> {
    const db = this.getDB();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["threads"], "readwrite");
      const store = transaction.objectStore("threads");
      const request = store.delete(threadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    await this.messages.deleteByThread(threadId);
  }
}
