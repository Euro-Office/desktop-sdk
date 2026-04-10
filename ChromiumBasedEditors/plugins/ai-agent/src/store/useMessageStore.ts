import type { ThreadMessageLike } from "@assistant-ui/react";
import { create } from "zustand";
import { getProviderInstance } from "../../npm_lib/providers/provider-holder";
import { getStorageInstance } from "../../npm_lib/storage/storage-holder";

type UseMessageStoreProps = {
  messages: ThreadMessageLike[];
  isStreamRunning: boolean;
  isRequestRunning: boolean;

  setIsStreamRunning: (value: boolean) => void;
  setIsRequestRunning: (value: boolean) => void;
  addMessage: (message: ThreadMessageLike) => void;
  updateLastMessage: (message: ThreadMessageLike) => void;
  fetchPrevMessages: (threadId: string) => Promise<void>;
  stopMessage: () => void;
  clearMessages: () => void;
};

const useMessageStore = create<UseMessageStoreProps>((set, get) => ({
  messages: [],
  isStreamRunning: false,
  isRequestRunning: false,
  fetchPrevMessages: async (threadId: string) => {
    const storage = getStorageInstance();
    const messages = await storage.messages.getByThread(threadId);

    set({ messages });

    getProviderInstance().setCurrentProviderPrevMessages(messages);
  },
  setIsStreamRunning: (value) => {
    set({ isStreamRunning: value });
  },
  setIsRequestRunning: (value) => {
    set({ isRequestRunning: value });
  },
  addMessage: (message) => {
    const thisStore = get();

    if (
      thisStore.messages.length &&
      thisStore.messages[thisStore.messages.length - 1].status?.type ===
        "incomplete"
    ) {
      set({
        messages: [...thisStore.messages.slice(0, -1), { ...message }],
      });

      return;
    }

    set({ messages: [...thisStore.messages, message] });
  },
  updateLastMessage: (message) => {
    const thisStore = get();
    set({ messages: [...thisStore.messages.slice(0, -1), message] });
  },

  stopMessage: () => {
    const thisStore = get();

    thisStore.setIsStreamRunning(false);
    getProviderInstance().stopMessage();
  },
  clearMessages: () => {
    set({ messages: [] });
    getProviderInstance().setCurrentProviderPrevMessages([]);
  },
}));

export default useMessageStore;
