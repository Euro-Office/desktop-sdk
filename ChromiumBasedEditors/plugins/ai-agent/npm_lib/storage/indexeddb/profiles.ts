import type { Profile } from "../../types";
import type { ProfilesStorage } from "../types";

export class IndexedDBProfilesStorage implements ProfilesStorage {
  constructor(private getDB: () => IDBDatabase) {}

  async create(profile: Profile): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readwrite");
      const store = transaction.objectStore("profiles");
      const request = store.put(profile);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async createMany(profiles: Profile[]): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readwrite");
      const store = transaction.objectStore("profiles");

      for (const profile of profiles) {
        store.put(profile);
      }

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }

  async getAll(): Promise<Profile[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readonly");
      const store = transaction.objectStore("profiles");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getById(id: string): Promise<Profile | undefined> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readonly");
      const store = transaction.objectStore("profiles");
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async update(profile: Profile): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readwrite");
      const store = transaction.objectStore("profiles");
      const request = store.put(profile);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(id: string): Promise<void> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readwrite");
      const store = transaction.objectStore("profiles");
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}
