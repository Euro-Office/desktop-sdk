import type { StorageAdapter } from "../../../npm_lib/storage/types";
import { IndexedDBMessagesStorage } from "./messages";
import { IndexedDBProfilesStorage } from "./profiles";
import {
  IndexedDBPromptFoldersStorage,
  IndexedDBPromptsStorage,
} from "./prompts";
import { IndexedDBThreadsStorage } from "./threads";

export class IndexedDBStorage implements StorageAdapter {
  private dbName = "ChatHistory";
  private version = 3;
  private db: IDBDatabase | null = null;

  threads: IndexedDBThreadsStorage;
  messages: IndexedDBMessagesStorage;
  profiles: IndexedDBProfilesStorage;
  prompts: IndexedDBPromptsStorage;
  promptFolders: IndexedDBPromptFoldersStorage;

  constructor() {
    const getDB = () => {
      if (!this.db) throw new Error("Database not initialized");
      return this.db;
    };

    this.messages = new IndexedDBMessagesStorage(getDB);
    this.threads = new IndexedDBThreadsStorage(getDB);
    this.profiles = new IndexedDBProfilesStorage(getDB);
    this.prompts = new IndexedDBPromptsStorage(getDB);
    this.promptFolders = new IndexedDBPromptFoldersStorage(getDB, this.prompts);
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("threads")) {
          const threadsStore = db.createObjectStore("threads", {
            keyPath: "threadId",
          });
          threadsStore.createIndex("updatedAt", "updatedAt", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("messages")) {
          const messagesStore = db.createObjectStore("messages", {
            keyPath: "id",
          });
          messagesStore.createIndex("threadId", "threadId", { unique: false });
          messagesStore.createIndex("timestamp", "timestamp", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("prompts")) {
          const promptsStore = db.createObjectStore("prompts", {
            keyPath: "id",
          });
          promptsStore.createIndex("createdAt", "createdAt", {
            unique: false,
          });
          promptsStore.createIndex("folderId", "folderId", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("promptFolders")) {
          const foldersStore = db.createObjectStore("promptFolders", {
            keyPath: "id",
          });
          foldersStore.createIndex("createdAt", "createdAt", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("profiles")) {
          db.createObjectStore("profiles", { keyPath: "id" });
        }
      };
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
