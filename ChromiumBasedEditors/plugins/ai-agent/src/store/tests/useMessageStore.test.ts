import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useMessageStore from "../useMessageStore";

// --- Mocks ---

const mockStorage = {
  messages: {
    getByThread: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteByThread: vi.fn(),
    replaceByThread: vi.fn(),
    search: vi.fn(),
    getById: vi.fn(),
  },
};

const mockProvider = {
  setCurrentProviderPrevMessages: vi.fn(),
  stopMessage: vi.fn(),
};

vi.mock("../../../npm_lib/storage/storage-holder", () => ({
  getStorageInstance: () => mockStorage,
}));

vi.mock("../../../npm_lib/providers/provider-holder", () => ({
  getProviderInstance: () => mockProvider,
}));

// --- Helpers ---

const resetStore = () => {
  useMessageStore.setState({
    messages: [],
    isStreamRunning: false,
    isRequestRunning: false,
  });
};

const textMsg = (
  role: "user" | "assistant",
  text: string
): ThreadMessageLike => ({
  role,
  content: [{ type: "text", text }],
});

const incompleteMsg = (): ThreadMessageLike => ({
  role: "assistant",
  content: [{ type: "text", text: "partial" }],
  status: { type: "incomplete", reason: "error", error: new Error("fail") },
});

// --- Tests ---

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useMessageStore", () => {
  describe("fetchPrevMessages", () => {
    it("loads messages from storage and syncs with provider", async () => {
      const msgs = [textMsg("user", "hi"), textMsg("assistant", "hello")];
      mockStorage.messages.getByThread.mockResolvedValue(msgs);

      await useMessageStore.getState().fetchPrevMessages("thread-1");

      expect(mockStorage.messages.getByThread).toHaveBeenCalledWith("thread-1");
      expect(useMessageStore.getState().messages).toEqual(msgs);
      expect(mockProvider.setCurrentProviderPrevMessages).toHaveBeenCalledWith(
        msgs
      );
    });

    it("sets empty messages for unknown thread", async () => {
      mockStorage.messages.getByThread.mockResolvedValue([]);

      await useMessageStore.getState().fetchPrevMessages("empty-thread");

      expect(useMessageStore.getState().messages).toEqual([]);
    });
  });

  describe("addMessage", () => {
    it("appends message to empty list", () => {
      const msg = textMsg("user", "hello");
      useMessageStore.getState().addMessage(msg);

      expect(useMessageStore.getState().messages).toHaveLength(1);
      expect(useMessageStore.getState().messages[0]).toEqual(msg);
    });

    it("appends message to existing list", () => {
      const first = textMsg("user", "first");
      const second = textMsg("assistant", "second");

      useMessageStore.getState().addMessage(first);
      useMessageStore.getState().addMessage(second);

      expect(useMessageStore.getState().messages).toHaveLength(2);
    });

    it("replaces last message if it has incomplete status", () => {
      const incomplete = incompleteMsg();
      const replacement = textMsg("assistant", "full response");

      useMessageStore.getState().addMessage(incomplete);
      expect(useMessageStore.getState().messages).toHaveLength(1);

      useMessageStore.getState().addMessage(replacement);
      expect(useMessageStore.getState().messages).toHaveLength(1);
      expect(useMessageStore.getState().messages[0]).toEqual(replacement);
    });

    it("does not replace last message if it is complete", () => {
      const complete = textMsg("assistant", "done");
      const next = textMsg("user", "more");

      useMessageStore.getState().addMessage(complete);
      useMessageStore.getState().addMessage(next);

      expect(useMessageStore.getState().messages).toHaveLength(2);
    });
  });

  describe("updateLastMessage", () => {
    it("replaces the last message", () => {
      const msg1 = textMsg("user", "hello");
      const msg2 = textMsg("assistant", "partial");
      const updated = textMsg("assistant", "full");

      useMessageStore.setState({ messages: [msg1, msg2] });
      useMessageStore.getState().updateLastMessage(updated);

      const msgs = useMessageStore.getState().messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1]).toEqual(updated);
    });
  });

  describe("setIsStreamRunning / setIsRequestRunning", () => {
    it("updates streaming flag", () => {
      useMessageStore.getState().setIsStreamRunning(true);
      expect(useMessageStore.getState().isStreamRunning).toBe(true);

      useMessageStore.getState().setIsStreamRunning(false);
      expect(useMessageStore.getState().isStreamRunning).toBe(false);
    });

    it("updates request flag", () => {
      useMessageStore.getState().setIsRequestRunning(true);
      expect(useMessageStore.getState().isRequestRunning).toBe(true);
    });
  });

  describe("stopMessage", () => {
    it("resets isStreamRunning and calls provider.stopMessage", () => {
      useMessageStore.setState({ isStreamRunning: true });
      useMessageStore.getState().stopMessage();

      expect(useMessageStore.getState().isStreamRunning).toBe(false);
      expect(mockProvider.stopMessage).toHaveBeenCalledOnce();
    });
  });

  describe("clearMessages", () => {
    it("clears messages and resets provider prev messages", () => {
      useMessageStore.setState({
        messages: [textMsg("user", "hello")],
      });
      useMessageStore.getState().clearMessages();

      expect(useMessageStore.getState().messages).toEqual([]);
      expect(mockProvider.setCurrentProviderPrevMessages).toHaveBeenCalledWith(
        []
      );
    });
  });
});
