import { create } from "zustand";
import { readMessages } from "@/database/messages";
import {
  createThread,
  deleteThread,
  readAllThreads,
  touchThread,
  updateThread,
} from "@/database/threads";
import type { Model, Thread, TProvider } from "@/lib/types";
import { convertMessagesToMd, removeSpecialCharacter } from "@/lib/utils";
import useModelsStore from "@/store/useModelsStore";
import useProviders from "@/store/useProviders";

type UseThreadsStoreProps = {
  threadId: string;
  threads: Thread[];

  initThreads: () => Promise<void>;
  insertThread: (
    title: string,
    opts?: { provider?: TProvider | null; model?: Model | null }
  ) => void;
  insertNewMessageToThread: (opts?: {
    provider?: TProvider | null;
    model?: Model | null;
  }) => void;
  onSwitchToNewThread: () => void;
  onSwitchToThread: (id: string) => void;
  onDownloadThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
};

const applyThreadContextFromThread = (thread?: Thread) => {
  const { setSessionProvider } = useProviders.getState();
  const { setSessionModel } = useModelsStore.getState();

  setSessionProvider(thread?.provider ?? null);
  setSessionModel(thread?.model ?? null);
};

const useThreadsStore = create<UseThreadsStoreProps>((set, get) => ({
  threadId: crypto.randomUUID(),
  threads: [],

  initThreads: async () => {
    const threads = await readAllThreads();

    set({ threads });
  },
  insertThread: (
    title: string,
    opts?: { provider?: TProvider | null; model?: Model | null }
  ) => {
    const thisStore = get();
    const provider = opts?.provider ?? null;
    const model = opts?.model ?? null;

    set({
      threads: [
        {
          threadId: thisStore.threadId,
          title,
          provider: provider ?? undefined,
          model: model ?? undefined,
          lastEditDate: Date.now(),
        },
        ...thisStore.threads,
      ],
    });

    createThread(
      thisStore.threadId,
      title,
      provider ?? undefined,
      model ?? undefined
    );
  },
  insertNewMessageToThread: (opts?: {
    provider?: TProvider | null;
    model?: Model | null;
  }) => {
    const thisStore = get();
    const provider = opts?.provider ?? null;
    const model = opts?.model ?? null;

    touchThread(thisStore.threadId, {
      ...(opts && "provider" in opts ? { provider } : {}),
      ...(opts && "model" in opts ? { model } : {}),
    });

    set({
      threads: thisStore.threads.map((thread) => {
        if (thread.threadId === thisStore.threadId) {
          return {
            ...thread,
            ...(opts && "provider" in opts
              ? { provider: provider ?? undefined }
              : {}),
            ...(opts && "model" in opts ? { model: model ?? undefined } : {}),
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
    const thisStore = get();
    const thread = thisStore.threads.find((t) => t.threadId === id);

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
