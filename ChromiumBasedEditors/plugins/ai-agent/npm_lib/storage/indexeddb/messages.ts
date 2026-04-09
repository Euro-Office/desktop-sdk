import type { ThreadMessageLike } from "@assistant-ui/react";
import type { MessagesStorage } from "../types";

interface Message {
  id: string;
  threadId: string;
  message: ThreadMessageLike;
  timestamp: number;
}

export class IndexedDBMessagesStorage implements MessagesStorage {
  constructor(private getDB: () => IDBDatabase) {}

  async create(
    threadId: string,
    id: string,
    message: ThreadMessageLike,
  ): Promise<void> {
    const db = this.getDB();
    const messageData: Message = {
      id,
      threadId,
      message,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const request = store.put(messageData);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getByThread(
    threadId: string,
    limit?: number,
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
          .sort((a: Message, b: Message) => a.timestamp - b.timestamp)
          .map((item: Message) => item.message);

        if (limit) {
          messages = messages.slice(-limit);
        }

        resolve(messages);
      };
    });
  }

  async getById(
    threadId: string,
    messageId: string,
  ): Promise<ThreadMessageLike | null> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const request = store.get(messageId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.threadId === threadId) {
          resolve(result.message);
        } else {
          resolve(null);
        }
      };
    });
  }

  async update(
    messageId: string,
    updatedMessage: ThreadMessageLike,
  ): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const getRequest = store.get(messageId);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const existingMessage = getRequest.result;
        if (!existingMessage) {
          reject(new Error("Message not found"));
          return;
        }

        const updatedData: Message = {
          ...existingMessage,
          message: updatedMessage,
          timestamp: Date.now(),
        };

        const putRequest = store.put(updatedData);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  async delete(messageId: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const request = store.delete(messageId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteByThread(threadId: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
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
  }

  async replaceByThread(
    threadId: string,
    messages: ThreadMessageLike[],
  ): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readwrite");
      const store = transaction.objectStore("messages");
      const index = store.index("threadId");

      const deleteRequest = index.openCursor(IDBKeyRange.only(threadId));
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          messages.forEach((message, idx) => {
            const messageData: Message = {
              id: `${threadId}-${Date.now()}-${idx}`,
              threadId,
              message,
              timestamp: Date.now() + idx,
            };
            store.put(messageData);
          });
        }
      };

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }

  async search(
    query: string,
  ): Promise<{ threadId: string; message: ThreadMessageLike }[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["messages"], "readonly");
      const store = transaction.objectStore("messages");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result.filter((item: Message) => {
          const content = Array.isArray(item.message.content)
            ? item.message.content
            : [{ type: "text", text: item.message.content }];

          return content.some(
            (part: { type: string; text: string }) =>
              part.type === "text" &&
              part.text.toLowerCase().includes(query.toLowerCase()),
          );
        });

        resolve(
          results.map((item: Message) => ({
            threadId: item.threadId,
            message: item.message,
          })),
        );
      };
    });
  }
}
