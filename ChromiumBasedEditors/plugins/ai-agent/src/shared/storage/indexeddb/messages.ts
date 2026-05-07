import type { ThreadMessageLike } from "@assistant-ui/react";
import type { AttachmentsStorage, MessagesStorage } from "@onlyoffice/ai-chat";

interface Message {
  id: string;
  threadId: string;
  message: ThreadMessageLike;
  timestamp: number;
}

// Monotonic counter for tie-breaking when multiple messages are
// created within the same millisecond (e.g. user message + immediate
// tool result). Date.now() resolution is too coarse on its own.
let createSeq = 0;

export class IndexedDBMessagesStorage implements MessagesStorage {
  private getDB: () => IDBDatabase;
  private attachments: AttachmentsStorage;

  constructor(getDB: () => IDBDatabase, attachments: AttachmentsStorage) {
    this.getDB = getDB;
    this.attachments = attachments;
  }

  async create(
    threadId: string,
    message: Omit<ThreadMessageLike, "id" | "createdAt">
  ): Promise<ThreadMessageLike> {
    const db = this.getDB();
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const fullMessage: ThreadMessageLike = {
      ...message,
      id,
      createdAt,
    } as ThreadMessageLike;

    const messageData: Message = {
      id,
      threadId,
      message: fullMessage,
      timestamp: Date.now() * 1000 + (createSeq++ % 1000),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const request = store.put(messageData);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(fullMessage);
    });
  }

  async readByThread(
    threadId: string,
    limit?: number,
    startIndex?: number
  ): Promise<ThreadMessageLike[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const index = store.index("threadId");
      const request = index.getAll(IDBKeyRange.only(threadId));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let messages = request.result
          .sort(
            (a: Message, b: Message) =>
              a.timestamp - b.timestamp || a.id.localeCompare(b.id)
          )
          .map((item: Message) => item.message);

        if (startIndex !== undefined) {
          messages = messages.slice(startIndex);
        }

        if (limit) {
          messages = messages.slice(0, limit);
        }

        resolve(messages);
      };
    });
  }

  async readById(messageId: string): Promise<ThreadMessageLike | null> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const request = store.get(messageId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.message : null);
      };
    });
  }

  async update(
    messageId: string,
    updatedMessage: ThreadMessageLike
  ): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const getRequest = store.get(messageId);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existingMessage = getRequest.result as Message | undefined;
        if (!existingMessage) {
          reject(new Error("Message not found"));
          return;
        }

        // Preserve identity fields (id, createdAt) on the inner message
        // — the engine sends a bare message on streaming updates without
        // them. Losing id makes assistant-ui fall back to index-based
        // tracking and mis-group messages on re-render.
        const updatedData: Message = {
          ...existingMessage,
          message: {
            ...updatedMessage,
            id: existingMessage.id,
            createdAt: existingMessage.message?.createdAt,
          } as ThreadMessageLike,
        };

        const putRequest = store.put(updatedData);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async delete(messageId: string): Promise<void> {
    const db = this.getDB();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const request = store.delete(messageId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    await this.attachments.deleteByMessage(messageId);
  }

  async deleteByThread(threadId: string): Promise<void> {
    const db = this.getDB();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const index = store.index("threadId");
      const request = index.openCursor(IDBKeyRange.only(threadId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });

    await this.attachments.deleteByThread(threadId);
  }
}
