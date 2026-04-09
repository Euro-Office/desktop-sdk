import type { Profile } from "@/lib/types";
import { chatDB } from "./index";

export const createProfiles = async (profiles: Profile[]): Promise<void> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles"], "readwrite");
    const store = transaction.objectStore("profiles");

    for (const profile of profiles) {
      store.put(profile);
    }

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
};

export const createProfile = async (profile: Profile): Promise<void> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles"], "readwrite");
    const store = transaction.objectStore("profiles");
    const request = store.put(profile);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const readProfile = async (id: string): Promise<Profile | undefined> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles"], "readonly");
    const store = transaction.objectStore("profiles");
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const readAllProfiles = async (): Promise<Profile[]> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles"], "readonly");
    const store = transaction.objectStore("profiles");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const updateProfile = async (profile: Profile): Promise<void> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles"], "readwrite");
    const store = transaction.objectStore("profiles");
    const request = store.put(profile);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const deleteProfile = async (id: string): Promise<void> => {
  const db = chatDB.getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["profiles"], "readwrite");
    const store = transaction.objectStore("profiles");
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
