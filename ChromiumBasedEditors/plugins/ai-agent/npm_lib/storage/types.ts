import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  Model,
  Profile,
  Prompt,
  PromptFolder,
  Thread,
  TProvider,
} from "../types";

export interface ThreadsStorage {
  /** Create a new thread and persist it to storage */
  create(
    threadId: string,
    title: string,
    provider?: TProvider,
    model?: Model,
    profileId?: string
  ): Promise<void>;

  /** Retrieve all threads sorted by lastEditDate descending (newest first) */
  getAll(): Promise<Thread[]>;

  /** Find a thread by its ID. Returns null if not found */
  getById(threadId: string): Promise<Thread | null>;

  /** Update thread title. Also bumps lastEditDate */
  update(threadId: string, title?: string): Promise<void>;

  /** Bump lastEditDate and optionally update provider/model/profileId. Called when a new message is sent */
  touch(
    threadId: string,
    updates?: {
      provider?: TProvider | null;
      model?: Model | null;
      profileId?: string | null;
    }
  ): Promise<void>;

  /** Delete a thread and all its messages (cascading delete) */
  delete(threadId: string): Promise<void>;
}

export interface MessagesStorage {
  /** Save a new message in a thread. Automatically sets timestamp to Date.now() */
  create(
    threadId: string,
    id: string,
    message: ThreadMessageLike
  ): Promise<void>;

  /** Get all messages for a thread sorted by timestamp ascending (oldest first). Optionally limit to last N messages */
  getByThread(threadId: string, limit?: number): Promise<ThreadMessageLike[]>;

  /** Find a specific message by ID within a thread. Returns null if not found */
  getById(
    threadId: string,
    messageId: string
  ): Promise<ThreadMessageLike | null>;

  /** Update message content (e.g. after receiving a tool result). Also updates the timestamp */
  update(messageId: string, message: ThreadMessageLike): Promise<void>;

  /** Delete a single message by ID */
  delete(messageId: string): Promise<void>;

  /** Delete all messages in a thread (used for clearing history or cascading thread delete) */
  deleteByThread(threadId: string): Promise<void>;

  /** Replace all messages in a thread with a new array. Used for bulk operations */
  replaceByThread(
    threadId: string,
    messages: ThreadMessageLike[]
  ): Promise<void>;

  /** Full-text case-insensitive search across all message content. Returns {threadId, message} pairs */
  search(
    query: string
  ): Promise<{ threadId: string; message: ThreadMessageLike }[]>;
}

export interface ProfilesStorage {
  /** Create a single AI provider profile */
  create(profile: Profile): Promise<void>;

  /** Create multiple profiles in a single transaction (used for migration or import) */
  createMany(profiles: Profile[]): Promise<void>;

  /** Retrieve all profiles */
  getAll(): Promise<Profile[]>;

  /** Find a profile by ID. Returns undefined if not found */
  getById(id: string): Promise<Profile | undefined>;

  /** Update a profile by replacing all fields */
  update(profile: Profile): Promise<void>;

  /** Delete a profile by ID */
  delete(id: string): Promise<void>;
}

export interface PromptsStorage {
  /** Create a new saved prompt */
  create(prompt: Prompt): Promise<void>;

  /** Retrieve all prompts sorted by createdAt descending (newest first) */
  getAll(): Promise<Prompt[]>;

  /** Find a prompt by ID. Returns null if not found */
  getById(id: string): Promise<Prompt | null>;

  /** Partially update a prompt: name, text, and/or folderId. Updates the updatedAt timestamp */
  update(
    id: string,
    updates: { name?: string; text?: string; folderId?: string | null }
  ): Promise<void>;

  /** Delete a single prompt by ID */
  delete(id: string): Promise<void>;

  /** Delete all prompts in a folder (cascading delete when a folder is removed) */
  deleteByFolder(folderId: string): Promise<void>;
}

export interface PromptFoldersStorage {
  /** Create a new prompt folder */
  create(folder: PromptFolder): Promise<void>;

  /** Retrieve all folders sorted by createdAt descending (newest first) */
  getAll(): Promise<PromptFolder[]>;

  /** Find a folder by ID. Returns null if not found */
  getById(id: string): Promise<PromptFolder | null>;

  /** Rename a folder. Updates the updatedAt timestamp */
  update(id: string, name: string): Promise<void>;

  /** Delete a folder and all prompts inside it (cascading delete) */
  delete(id: string): Promise<void>;
}

export interface StorageAdapter {
  /** Thread (chat session) storage */
  threads: ThreadsStorage;

  /** Message storage */
  messages: MessagesStorage;

  /** AI provider profile storage */
  profiles: ProfilesStorage;

  /** Saved prompt storage */
  prompts: PromptsStorage;

  /** Prompt folder storage */
  promptFolders: PromptFoldersStorage;

  /** Initialize the storage backend (create DB/tables, run migrations). Called once on startup */
  init(): Promise<void>;

  /** Close the storage connection. Called when AIChatProvider unmounts */
  close(): Promise<void>;
}
