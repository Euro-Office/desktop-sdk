import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { ThreadsService } from "../services/threads";
import type { Profile, Thread } from "../types";
import type { MessageStoreState } from "./create-message-store";
import type { ProfilesStoreState } from "./create-profiles-store";

export interface ThreadsStoreState {
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
  onClearThreadHistory: (id: string) => void;
}

export function createThreadsStore(deps: {
  threadsService: ThreadsService;
  useProfilesStore: UseBoundStore<StoreApi<ProfilesStoreState>>;
  useMessageStore: UseBoundStore<StoreApi<MessageStoreState>>;
}): UseBoundStore<StoreApi<ThreadsStoreState>> {
  const { threadsService, useProfilesStore, useMessageStore } = deps;

  const needsMigrationToProfile = (
    thread: Thread | undefined
  ): thread is Thread => !!(thread?.provider || thread?.model);

  const applyThreadContextFromThread = (thread?: Thread) => {
    const { getProfileById, setSessionChatProfile } =
      useProfilesStore.getState();
    const profile = thread?.profileId ? getProfileById(thread.profileId) : null;
    setSessionChatProfile(profile);
  };

  return create<ThreadsStoreState>((set, get) => ({
    threadId: crypto.randomUUID(),
    threads: [],

    initThreads: async () => {
      const threads = await threadsService.loadAll();
      set({ threads });
    },

    insertThread: (title, opts) => {
      const { threadId, threads } = get();
      const thread = threadsService.createThread(
        threadId,
        title,
        opts?.profileId
      );
      set({ threads: [thread, ...threads] });
    },

    insertNewMessageToThread: (opts) => {
      const { threadId, threads } = get();
      threadsService.touchThread(threadId, opts);
      set({
        threads: threads.map((thread) => {
          if (thread.threadId === threadId) {
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

    migrateThreadFromProviderModelToProfile: (thread) => {
      const { profiles, chatProfile, defaultProfile } =
        useProfilesStore.getState();
      const migratedThread = threadsService.migrateThreadToProfile(
        thread,
        profiles,
        chatProfile as Profile | null,
        defaultProfile as Profile | null
      );
      set((state) => ({
        threads: state.threads.map((t) =>
          t.threadId === thread.threadId ? migratedThread : t
        ),
      }));
      return migratedThread;
    },

    onSwitchToNewThread: () => {
      applyThreadContextFromThread(undefined);
      set({ threadId: crypto.randomUUID() });
    },

    onSwitchToThread: (id) => {
      const { threads, migrateThreadFromProviderModelToProfile } = get();
      let thread = threads.find((t) => t.threadId === id);
      if (needsMigrationToProfile(thread)) {
        thread = migrateThreadFromProviderModelToProfile(thread);
      }
      applyThreadContextFromThread(thread);
      set({ threadId: id });
    },

    onDownloadThread: async (id) => {
      const thread = get().threads.find((t) => t.threadId === id);
      await threadsService.downloadThread(id, thread?.title);
    },

    onRenameThread: (id, title) => {
      set({
        threads: get().threads.map((thread) => {
          if (thread.threadId === id) return { ...thread, title };
          return thread;
        }),
      });
      threadsService.renameThread(id, title);
    },

    onDeleteThread: (id) => {
      const thisStore = get();
      if (thisStore.threadId === id) {
        thisStore.onSwitchToNewThread();
      }
      set({
        threads: thisStore.threads.filter((t) => t.threadId !== id),
      });
      threadsService.deleteThread(id);
    },

    onClearThreadHistory: async (id) => {
      await threadsService.clearHistory(id);
      if (get().threadId === id) {
        useMessageStore.getState().clearMessages();
      }
    },
  }));
}
