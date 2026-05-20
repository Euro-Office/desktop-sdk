import type { CustomProviderRecord } from "@/shared/custom-providers/types.ts";

export class IndexedDBCustomProvidersStorage {
  private getDB: () => IDBDatabase;

  constructor(getDB: () => IDBDatabase) {
    this.getDB = getDB;
  }

  async getAll(): Promise<CustomProviderRecord[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["customProviders"], "readonly");
      const store = transaction.objectStore("customProviders");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async findByName(name: string): Promise<CustomProviderRecord | undefined> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["customProviders"], "readonly");
      const store = transaction.objectStore("customProviders");
      const request = store.get(name);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async upsert(record: CustomProviderRecord): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["customProviders"], "readwrite");
      const store = transaction.objectStore("customProviders");
      const request = store.put(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(name: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["customProviders"], "readwrite");
      const store = transaction.objectStore("customProviders");
      const request = store.delete(name);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
