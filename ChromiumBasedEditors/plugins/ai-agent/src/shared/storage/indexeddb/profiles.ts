import type { ProfilesStorage } from "@onlyoffice/ai-chat";
import type { Profile } from "@/shared/lib/types.ts";

export class IndexedDBProfilesStorage implements ProfilesStorage {
  private getDB: () => IDBDatabase;

  constructor(getDB: () => IDBDatabase) {
    this.getDB = getDB;
  }

  async create(profile: Omit<Profile, "id" | "createdAt">): Promise<Profile> {
    const db = this.getDB();
    const full: Profile = {
      ...profile,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readwrite");
      const store = transaction.objectStore("profiles");
      const request = store.put(full);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(full);
    });
  }

  async createMany(
    profiles: Omit<Profile, "id" | "createdAt">[]
  ): Promise<Profile[]> {
    const db = this.getDB();
    const now = Date.now();
    const created: Profile[] = profiles.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      createdAt: now,
    }));

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readwrite");
      const store = transaction.objectStore("profiles");

      for (const profile of created) {
        store.put(profile);
      }

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(created);
    });
  }

  async readAll(): Promise<Profile[]> {
    const db = this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["profiles"], "readonly");
      const store = transaction.objectStore("profiles");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async readById(id: string): Promise<Profile | undefined> {
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
