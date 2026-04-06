import { create } from "zustand";
import { readMessages } from "@/database/messages";
import {
  createThread,
  deleteThread,
  readAllThreads,
  touchThread,
  updateThread,
} from "@/database/threads";
import type { Thread } from "@/lib/types";
import { convertMessagesToMd, removeSpecialCharacter } from "@/lib/utils";
import useProfilesStore from "@/store/useProfilesStore";

type UseThreadsStoreProps = {
  threadId: string;
  threads: Thread[];

  initThreads: () => Promise<void>;
  insertThread: (title: string, opts?: { profileId?: string }) => void;
  insertNewMessageToThread: (opts?: { profileId?: string }) => void;
  migrateThreadFromProviderModelToProfile: (thread: Thread) => Thread;
  onSwitchToNewThread: () => void;
  onSwitchToThread: (id: string) => void;
  onDownloadThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
};

const applyThreadContextFromThread = (thread?: Thread) => {
  const { getProfileById, setSessionChatProfile } = useProfilesStore.getState();
  const profile = thread?.profileId ? getProfileById(thread.profileId) : null;

  setSessionChatProfile(profile);
};

const needsMigrationToProfile = (
  thread: Thread | undefined
): thread is Thread => !!(thread?.provider || thread?.model);

const useThreadsStore = create<UseThreadsStoreProps>((set, get) => ({
  threadId: crypto.randomUUID(),
  threads: [],

  initThreads: async () => {
    const threads = await readAllThreads();

    set({ threads });
  },
  insertThread: (title: string, opts?: { profileId?: string }) => {
    const thisStore = get();

    set({
      threads: [
        {
          threadId: thisStore.threadId,
          title,
          profileId: opts?.profileId,
          lastEditDate: Date.now(),
        },
        ...thisStore.threads,
      ],
    });

    createThread(
      thisStore.threadId,
      title,
      undefined,
      undefined,
      opts?.profileId
    );
  },
  migrateThreadFromProviderModelToProfile: (thread) => {
    const { provider, model, ...rest } = thread;
    const { profiles, chatProfile, defaultProfile } =
      useProfilesStore.getState();

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

    set((state) => ({
      threads: state.threads.map((t) =>
        t.threadId === thread.threadId ? migratedThread : t
      ),
    }));

    touchThread(thread.threadId, {
      profileId: matched?.id ?? null,
      provider: null,
      model: null,
    });

    return migratedThread;
  },
  insertNewMessageToThread: (opts?: { profileId?: string }) => {
    const thisStore = get();

    touchThread(thisStore.threadId, {
      ...(opts && "profileId" in opts ? { profileId: opts.profileId } : {}),
    });

    set({
      threads: thisStore.threads.map((thread) => {
        if (thread.threadId === thisStore.threadId) {
          return {
            ...thread,
            ...(opts && "profileId" in opts
              ? { profileId: opts.profileId }
              : {}),
            lastEditDate: Date.now(),
          };
        }
        return thread;
      }),
    });
  },
  onSwitchToNewThread: () => {
    applyThreadContextFromThread(undefined);
    set({ threadId: crypto.randomUUID() });
  },
  onSwitchToThread: (id: string) => {
    const { threads, migrateThreadFromProviderModelToProfile } = get();
    let thread = threads.find((t) => t.threadId === id);

    if (needsMigrationToProfile(thread)) {
      thread = migrateThreadFromProviderModelToProfile(thread);
    }

    applyThreadContextFromThread(thread);
    set({ threadId: id });
  },
  onDownloadThread: async (id: string) => {
    const thisStore = get();
    const thread = thisStore.threads.find((t) => t.threadId === id);
    const messages = await readMessages(id);

    const title = removeSpecialCharacter(thread?.title || "Chat Export");

    const content = convertMessagesToMd(messages);

    window.AscDesktopEditor.SaveFilenameDialog(`${title}.docx`, (path) => {
      if (!path) return;

      window.AscDesktopEditor.saveAndOpen(content, 0x5c, path, 0x41, (code) => {
        if (!code) console.log("Conversion error");
      });
    });
  },
  onRenameThread: (id: string, title: string) => {
    const thisStore = get();

    set({
      threads: thisStore.threads.map((thread) => {
        if (thread.threadId === id) {
          return {
            ...thread,
            title,
          };
        }
        return thread;
      }),
    });

    updateThread(id, title);
  },
  onDeleteThread: (id: string) => {
    const thisStore = get();

    if (thisStore.threadId === id) {
      thisStore.onSwitchToNewThread();
    }
    set({ threads: thisStore.threads.filter((t) => t.threadId !== id) });
    deleteThread(id);
  },
}));

export default useThreadsStore;
