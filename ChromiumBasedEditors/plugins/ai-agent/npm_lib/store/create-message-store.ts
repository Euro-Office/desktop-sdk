import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import { getProviderInstance } from "../providers/provider-holder";
import { getStorageInstance } from "../storage/storage-holder";

export interface MessageStoreState {
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
}

export function createMessageStore(): UseBoundStore<
  StoreApi<MessageStoreState>
> {
  return create<MessageStoreState>((set, get) => ({
    messages: [],
    isStreamRunning: false,
    isRequestRunning: false,

    fetchPrevMessages: async (threadId: string) => {
      const storage = getStorageInstance();
      const messages = await storage.messages.getByThread(threadId);
      set({ messages });
      getProviderInstance().setCurrentProviderPrevMessages(messages);
    },

    setIsStreamRunning: (value) => set({ isStreamRunning: value }),
    setIsRequestRunning: (value) => set({ isRequestRunning: value }),

    addMessage: (message) => {
      const { messages } = get();
      if (
        messages.length &&
        messages[messages.length - 1].status?.type === "incomplete"
      ) {
        set({ messages: [...messages.slice(0, -1), { ...message }] });
        return;
      }
      set({ messages: [...messages, message] });
    },

    updateLastMessage: (message) => {
      const { messages } = get();
      set({ messages: [...messages.slice(0, -1), message] });
    },

    stopMessage: () => {
      get().setIsStreamRunning(false);
      getProviderInstance().stopMessage();
    },

    clearMessages: () => {
      set({ messages: [] });
      getProviderInstance().setCurrentProviderPrevMessages([]);
    },
  }));
}
