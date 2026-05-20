import type { StorageAdapter } from "@onlyoffice/ai-chat";
import {
  LocalStorageAssignmentsStorage,
  LocalStorageMcpServersStorage,
  LocalStoragePreferencesStorage,
  LocalStorageToolPrefsStorage,
  LocalStorageWebSearchStorage,
} from "../localstorage/index.ts";
import { IndexedDBAttachmentsStorage } from "./attachments.ts";
import { IndexedDBCustomProvidersStorage } from "./customProviders.ts";
import { IndexedDBMessagesStorage } from "./messages.ts";
import { IndexedDBProfilesStorage } from "./profiles.ts";
import {
  IndexedDBPromptFoldersStorage,
  IndexedDBPromptsStorage,
} from "./prompts.ts";
import { IndexedDBThreadsStorage } from "./threads.ts";

export class IndexedDBStorage implements StorageAdapter {
  private dbName = "ChatHistory";
  private version = 5;
  private db: IDBDatabase | null = null;

  threads: IndexedDBThreadsStorage;
  messages: IndexedDBMessagesStorage;
  profiles: IndexedDBProfilesStorage;
  prompts: IndexedDBPromptsStorage;
  promptFolders: IndexedDBPromptFoldersStorage;
  attachments: IndexedDBAttachmentsStorage;
  customProviders: IndexedDBCustomProvidersStorage;
  assignments: LocalStorageAssignmentsStorage;
  preferences: LocalStoragePreferencesStorage;
  mcpServers: LocalStorageMcpServersStorage;
  toolPrefs: LocalStorageToolPrefsStorage;
  webSearch: LocalStorageWebSearchStorage;

  constructor() {
    const getDB = () => {
      if (!this.db) throw new Error("Database not initialized");
      return this.db;
    };

    this.attachments = new IndexedDBAttachmentsStorage(getDB);
    this.messages = new IndexedDBMessagesStorage(getDB, this.attachments);
    this.threads = new IndexedDBThreadsStorage(getDB, this.messages);
    this.profiles = new IndexedDBProfilesStorage(getDB);
    this.prompts = new IndexedDBPromptsStorage(getDB);
    this.promptFolders = new IndexedDBPromptFoldersStorage(getDB, this.prompts);
    this.customProviders = new IndexedDBCustomProvidersStorage(getDB);
    this.assignments = new LocalStorageAssignmentsStorage();
    this.preferences = new LocalStoragePreferencesStorage();
    this.mcpServers = new LocalStorageMcpServersStorage();
    this.toolPrefs = new LocalStorageToolPrefsStorage();
    this.webSearch = new LocalStorageWebSearchStorage();
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn(
          `[IndexedDBStorage] open(${this.dbName}, ${this.version}) blocked — another connection holds an older version. Close other tabs/windows of the plugin.`
        );
      };
      request.onsuccess = () => {
        this.db = request.result;
        // Allow other tabs/windows to upgrade by releasing this connection.
        // Without this, a future open(v+1) from another context hangs in
        // `onblocked` indefinitely.
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
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

        if (!db.objectStoreNames.contains("attachments")) {
          const attachmentsStore = db.createObjectStore("attachments", {
            keyPath: "id",
          });
          attachmentsStore.createIndex("messageId", "messageId", {
            unique: false,
          });
          attachmentsStore.createIndex("threadId", "threadId", {
            unique: false,
          });
          attachmentsStore.createIndex("createdAt", "createdAt", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("customProviders")) {
          db.createObjectStore("customProviders", { keyPath: "name" });
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
