import type { Attachment, AttachmentsStorage } from "@onlyoffice/ai-chat";

interface AttachmentRecord extends Attachment {}

export class IndexedDBAttachmentsStorage implements AttachmentsStorage {
  private getDB: () => IDBDatabase;

  constructor(getDB: () => IDBDatabase) {
    this.getDB = getDB;
  }

  async create(
    input: Omit<Attachment, "id" | "createdAt">
  ): Promise<Attachment> {
    const db = this.getDB();
    const record: AttachmentRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["attachments"], "readwrite");
      const store = tx.objectStore("attachments");
      const req = store.put(record);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(record);
    });
  }

  async readById(id: string): Promise<Attachment | null> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["attachments"], "readonly");
      const store = tx.objectStore("attachments");
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as Attachment) ?? null);
    });
  }

  async readManyByIds(ids: string[]): Promise<(Attachment | null)[]> {
    if (ids.length === 0) return [];
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["attachments"], "readonly");
      const store = tx.objectStore("attachments");
      const results: (Attachment | null)[] = new Array(ids.length).fill(null);
      let pending = ids.length;
      let aborted = false;

      ids.forEach((id, idx) => {
        const req = store.get(id);
        req.onsuccess = () => {
          if (aborted) return;
          results[idx] = (req.result as Attachment) ?? null;
          pending -= 1;
          if (pending === 0) resolve(results);
        };
        req.onerror = () => {
          if (aborted) return;
          aborted = true;
          reject(req.error);
        };
      });
    });
  }

  async update(id: string, patch: Partial<Attachment>): Promise<void> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["attachments"], "readwrite");
      const store = tx.objectStore("attachments");
      const getReq = store.get(id);
      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => {
        const existing = getReq.result as AttachmentRecord | undefined;
        if (!existing) {
          resolve();
          return;
        }
        const updated: AttachmentRecord = { ...existing, ...patch, id };
        const putReq = store.put(updated);
        putReq.onerror = () => reject(putReq.error);
        putReq.onsuccess = () => resolve();
      };
    });
  }

  async delete(id: string): Promise<void> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["attachments"], "readwrite");
      const store = tx.objectStore("attachments");
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["attachments"], "readwrite");
      const store = tx.objectStore("attachments");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      for (const id of ids) store.delete(id);
    });
  }

  async deleteByMessage(messageId: string): Promise<void> {
    return this.deleteByIndex("messageId", messageId);
  }

  async deleteByThread(threadId: string): Promise<void> {
    return this.deleteByIndex("threadId", threadId);
  }

  private deleteByIndex(indexName: string, value: string): Promise<void> {
    const db = this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["attachments"], "readwrite");
      const store = tx.objectStore("attachments");
      const index = store.index(indexName);
      const req = index.openCursor(IDBKeyRange.only(value));
      req.onerror = () => reject(req.error);
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue | null;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}
