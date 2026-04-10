import { create } from "zustand";
import type { Thread } from "@/lib/types";
import useMessageStore from "@/store/useMessageStore";
import useProfilesStore from "@/store/useProfilesStore";
import { ThreadsService } from "../../npm_lib/services/threads";

const service = new ThreadsService();

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
  onClearThreadHistory: (id: string) => void;
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
    const threads = await service.loadAll();
    set({ threads });
  },

  insertThread: (title: string, opts?: { profileId?: string }) => {
    const { threadId, threads } = get();
    const thread = service.createThread(threadId, title, opts?.profileId);
    set({ threads: [thread, ...threads] });
  },

  insertNewMessageToThread: (opts?: { profileId?: string }) => {
    const { threadId, threads } = get();
    service.touchThread(threadId, opts);

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

    const migratedThread = service.migrateThreadToProfile(
      thread,
      profiles,
      chatProfile,
      defaultProfile
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
    const thread = get().threads.find((t) => t.threadId === id);
    await service.downloadThread(id, thread?.title);
  },

  onRenameThread: (id: string, title: string) => {
    set({
      threads: get().threads.map((thread) => {
        if (thread.threadId === id) return { ...thread, title };
        return thread;
      }),
    });
    service.renameThread(id, title);
  },

  onDeleteThread: (id: string) => {
    const thisStore = get();
    if (thisStore.threadId === id) {
      thisStore.onSwitchToNewThread();
    }
    set({ threads: thisStore.threads.filter((t) => t.threadId !== id) });
    service.deleteThread(id);
  },

  onClearThreadHistory: async (id: string) => {
    await service.clearHistory(id);

    if (get().threadId === id) {
      useMessageStore.getState().clearMessages();
    }
  },
}));

export default useThreadsStore;
