import type { ThreadMessageLike } from "@assistant-ui/react";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AppContext } from "../app-context";

export interface MessageStoreState {
  messages: ThreadMessageLike[];
  isStreamRunning: boolean;
  isRequestRunning: boolean;
  _currentThreadId: string;
  setIsStreamRunning: (value: boolean) => void;
  setIsRequestRunning: (value: boolean) => void;
  addMessage: (message: ThreadMessageLike) => void;
  updateLastMessage: (message: ThreadMessageLike) => void;
  fetchPrevMessages: (threadId: string) => Promise<void>;
  stopMessage: () => void;
  clearMessages: () => void;
}

export function createMessageStore(
  ctx: AppContext
): UseBoundStore<StoreApi<MessageStoreState>> {
  return create<MessageStoreState>((set, get) => ({
    messages: [],
    isStreamRunning: false,
    isRequestRunning: false,
    _currentThreadId: "",

    fetchPrevMessages: async (threadId: string) => {
      set({ _currentThreadId: threadId });
      const storage = ctx.storage;
      const fetchedMessages = await storage.messages.getByThread(threadId);
      // Guard: if thread changed while awaiting, discard stale results
      const current = get();
      if (current._currentThreadId !== threadId) return;
      set({ messages: fetchedMessages });
      ctx.provider.setCurrentProviderPrevMessages(fetchedMessages);
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
      ctx.provider.stopMessage();
    },

    clearMessages: () => {
      set({ messages: [] });
      ctx.provider.setCurrentProviderPrevMessages([]);
    },
  }));
}
