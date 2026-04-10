import type { Profile, Thread } from "../types";
import { getPlatformInstance } from "../platform/platform-holder";
import { getStorageInstance } from "../storage/storage-holder";
import { convertMessagesToMd, removeSpecialCharacter } from "../utils";

export class ThreadsService {
  async loadAll(): Promise<Thread[]> {
    const storage = getStorageInstance();
    return storage.threads.getAll();
  }

  createThread(
    threadId: string,
    title: string,
    profileId?: string
  ): Thread {
    const thread: Thread = {
      threadId,
      title,
      profileId,
      lastEditDate: Date.now(),
    };
    const storage = getStorageInstance();
    storage.threads.create(
      threadId,
      title,
      undefined,
      undefined,
      profileId
    );
    return thread;
  }

  touchThread(
    threadId: string,
    updates?: { profileId?: string }
  ): void {
    const storage = getStorageInstance();
    storage.threads.touch(threadId, {
      ...(updates && "profileId" in updates
        ? { profileId: updates.profileId }
        : {}),
    });
  }

  migrateThreadToProfile(
    thread: Thread,
    profiles: Profile[],
    chatProfile: Profile | null,
    defaultProfile: Profile | null
  ): Thread {
    const { provider, model, ...rest } = thread;

    const matched =
      profiles.find(
        (p) =>
          p.providerType === provider?.type &&
          p.baseUrl === provider?.baseUrl &&
          p.modelId === model?.id &&
          p.key === provider?.key
      ) ??
      profiles.find(
        (p) =>
          p.providerType === provider?.type &&
          p.baseUrl === provider?.baseUrl &&
          p.modelId === model?.id
      ) ??
      chatProfile ??
      defaultProfile;

    const migratedThread: Thread = { ...rest, profileId: matched?.id };

    const storage = getStorageInstance();
    storage.threads.touch(thread.threadId, {
      profileId: matched?.id ?? null,
      provider: null,
      model: null,
    });

    return migratedThread;
  }

  async downloadThread(
    threadId: string,
    threadTitle?: string
  ): Promise<void> {
    const storage = getStorageInstance();
    const messages = await storage.messages.getByThread(threadId);
    const title = removeSpecialCharacter(threadTitle || "Chat Export");
    const content = convertMessagesToMd(messages);
    const platform = getPlatformInstance();
    platform?.file?.saveAsFile(content, `${title}.docx`);
  }

  renameThread(id: string, title: string): void {
    const storage = getStorageInstance();
    storage.threads.update(id, title);
  }

  async deleteThread(id: string): Promise<void> {
    const storage = getStorageInstance();
    await storage.messages.deleteByThread(id);
    await storage.threads.delete(id);
  }

  async clearHistory(id: string): Promise<void> {
    const storage = getStorageInstance();
    await storage.messages.deleteByThread(id);
  }
}
