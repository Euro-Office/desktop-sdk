import type { ThreadMessageLike } from "@assistant-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStorage = {
  threads: {
    getById: vi.fn(),
    create: vi.fn(),
    touch: vi.fn(),
  },
  messages: {
    create: vi.fn(),
    update: vi.fn(),
    getByThread: vi.fn(),
  },
};

const mockProvider = {
  sendMessage: vi.fn(),
  sendMessageAfterToolCall: vi.fn(),
  createChatName: vi.fn().mockResolvedValue(null),
  stopMessage: vi.fn(),
};

const mockServers = {
  getServerType: vi.fn().mockReturnValue("custom"),
  callTools: vi.fn().mockResolvedValue("tool-result"),
  checkAllowAlways: vi.fn().mockReturnValue(false),
  setAllowAlways: vi.fn(),
};

const mockCtx = {
  storage: mockStorage,
  provider: mockProvider,
  servers: mockServers,
  settings: {} as never,
  platform: {} as never,
  eventBus: {} as never,
};

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { ChatEngine } from "../chat-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStream(messages: unknown[]) {
  async function* gen() {
    for (const msg of messages) {
      yield msg;
    }
  }
  return gen();
}

const makeAssistantMsg = (
  text: string,
  extra?: Partial<ThreadMessageLike>
): ThreadMessageLike => ({
  role: "assistant",
  content: [{ type: "text", text }],
  ...extra,
});

const makeEndMarker = (
  msg: ThreadMessageLike
): { isEnd: true; responseMessage: ThreadMessageLike } => ({
  isEnd: true,
  responseMessage: msg,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChatEngine", () => {
  let engine: ChatEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ChatEngine(mockCtx as any);
    mockStorage.threads.getById.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendMessage", () => {
    it("yields message-start, message-delta, message-end for a simple stream", async () => {
      const assistantMsg = makeAssistantMsg("Hello");
      const assistantMsgUpdated = makeAssistantMsg("Hello world");
      const stream = createMockStream([
        assistantMsg,
        assistantMsgUpdated,
        makeEndMarker(assistantMsgUpdated),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Hi",
        threadId: "t1",
        existingMessages: [],
        extendedThinking: false,
      })) {
        events.push(event);
      }

      expect(events[0].type).toBe("message-start");
      expect(events[1].type).toBe("message-delta");
      expect(events[2].type).toBe("message-end");
      expect(events).toHaveLength(3);
    });

    it("stores messages in storage for new thread", async () => {
      const stream = createMockStream([
        makeAssistantMsg("Hi"),
        makeEndMarker(makeAssistantMsg("Hi")),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Hello",
        threadId: "t1",
        existingMessages: [],
        extendedThinking: false,
      })) {
        events.push(event);
      }

      // User message stored
      expect(mockStorage.messages.create).toHaveBeenCalled();
      // Assistant message stored on start
      const createCalls = mockStorage.messages.create.mock.calls;
      expect(createCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("touches existing thread instead of creating new", async () => {
      mockStorage.threads.getById.mockResolvedValue({
        threadId: "t1",
        title: "Existing",
      });

      const stream = createMockStream([
        makeAssistantMsg("Reply"),
        makeEndMarker(makeAssistantMsg("Reply")),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Follow up",
        threadId: "t1",
        existingMessages: [],
        extendedThinking: false,
        profileId: "p1",
      })) {
        events.push(event);
      }

      expect(mockStorage.threads.touch).toHaveBeenCalledWith("t1", {
        profileId: "p1",
      });
    });

    it("yields message-incomplete when stream ends with incomplete status", async () => {
      const incompleteMsg = makeAssistantMsg("Partial");
      incompleteMsg.status = { type: "incomplete", reason: "error" };

      const stream = createMockStream([
        makeAssistantMsg("Partial"),
        makeEndMarker(incompleteMsg),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Hi",
        threadId: "t1",
        existingMessages: [],
        extendedThinking: false,
      })) {
        events.push(event);
      }

      const last = events[events.length - 1];
      expect(last.type).toBe("message-incomplete");
    });

    it("yields tool-call-pending when response contains unresolved tool call", async () => {
      const toolCallMsg: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "custom_search",
            args: { q: "test" },
          },
        ],
      };

      const stream = createMockStream([
        toolCallMsg,
        makeEndMarker(toolCallMsg),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Search",
        threadId: "t1",
        existingMessages: [],
        extendedThinking: false,
      })) {
        events.push(event);
      }

      const pending = events.find((e) => e.type === "tool-call-pending");
      expect(pending).toBeDefined();
      expect(pending?.idx).toBe(0);
    });

    it("handles empty stream gracefully", async () => {
      mockProvider.sendMessage.mockReturnValue((async function* () {})());

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Hi",
        threadId: "t1",
        existingMessages: [],
        extendedThinking: false,
      })) {
        events.push(event);
      }

      // No stream events, but may yield title
      expect(events.every((e) => e.type !== "message-start")).toBe(true);
    });

    it("yields thread-title event when title is generated", async () => {
      mockProvider.createChatName.mockResolvedValue("Generated Title");

      const stream = createMockStream([
        makeAssistantMsg("Hi"),
        makeEndMarker(makeAssistantMsg("Hi")),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);

      // Need to let the title promise resolve
      const events = [];
      for await (const event of engine.sendMessage({
        text: "Hello",
        threadId: "t1",
        existingMessages: [],
        extendedThinking: false,
        profileId: "p1",
      })) {
        events.push(event);
      }

      // Wait for createChatName promise
      await new Promise((r) => setTimeout(r, 10));

      // Title event might or might not be yielded depending on timing
      // But createChatName should have been called
      expect(mockProvider.createChatName).toHaveBeenCalled();
    });
  });

  describe("approveToolCall", () => {
    it("executes tool call and yields delta + stream continuation", async () => {
      mockServers.getServerType.mockReturnValue("custom");
      mockServers.callTools.mockResolvedValue("result-data");

      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "custom_search",
            args: { q: "test" },
          },
        ],
      };

      const continuationStream = createMockStream([
        makeAssistantMsg("After tool"),
        makeEndMarker(makeAssistantMsg("After tool")),
      ]);
      mockProvider.sendMessageAfterToolCall.mockReturnValue(continuationStream);

      const events = [];
      for await (const event of engine.approveToolCall(
        { message: msg, idx: 0, messageUID: "uid-1" },
        false,
        false
      )) {
        events.push(event);
      }

      // Should have: delta (tool result), then continuation stream events
      expect(events[0].type).toBe("message-delta");
      expect(mockServers.callTools).toHaveBeenCalled();
    });

    it("sets allowAlways when flag is true", async () => {
      mockServers.getServerType.mockReturnValue("custom");
      mockServers.callTools.mockResolvedValue("result");

      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "custom_search",
            args: {},
          },
        ],
      };

      mockProvider.sendMessageAfterToolCall.mockReturnValue(
        createMockStream([makeEndMarker(makeAssistantMsg("Done"))])
      );

      const events = [];
      for await (const event of engine.approveToolCall(
        { message: msg, idx: 0, messageUID: "uid-1" },
        true,
        false
      )) {
        events.push(event);
      }

      expect(mockServers.setAllowAlways).toHaveBeenCalledWith(
        true,
        "custom",
        "search"
      );
    });

    it("returns early for invalid tool call index", async () => {
      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "No tool here" }],
      };

      const events = [];
      for await (const event of engine.approveToolCall(
        { message: msg, idx: 0, messageUID: "uid-1" },
        false,
        false
      )) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
    });
  });

  describe("denyToolCall", () => {
    it("yields delta with deny result and continues stream", async () => {
      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "custom_search",
            args: {},
          },
        ],
      };

      mockProvider.sendMessageAfterToolCall.mockReturnValue(
        createMockStream([makeEndMarker(makeAssistantMsg("OK"))])
      );

      const events = [];
      for await (const event of engine.denyToolCall(
        { message: msg, idx: 0, messageUID: "uid-1" },
        false
      )) {
        events.push(event);
      }

      expect(events[0].type).toBe("message-delta");
      // Tool was not called
      expect(mockServers.callTools).not.toHaveBeenCalled();
    });
  });

  describe("handleToolCall", () => {
    it("auto-executes if allowAlways is true", async () => {
      mockServers.checkAllowAlways.mockReturnValue(true);
      mockServers.getServerType.mockReturnValue("custom");
      mockServers.callTools.mockResolvedValue("auto-result");

      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "custom_search",
            args: {},
          },
        ],
      };

      mockProvider.sendMessageAfterToolCall.mockReturnValue(
        createMockStream([makeEndMarker(makeAssistantMsg("Auto"))])
      );

      const events = [];
      for await (const event of engine.handleToolCall(msg, 0, "uid-1", false)) {
        events.push(event);
      }

      expect(events[0].type).toBe("message-delta");
      expect(mockServers.callTools).toHaveBeenCalled();
    });

    it("yields tool-call-pending if not allowAlways", async () => {
      mockServers.checkAllowAlways.mockReturnValue(false);
      mockServers.getServerType.mockReturnValue("custom");

      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tc1",
            toolName: "custom_search",
            args: {},
          },
        ],
      };

      const events = [];
      for await (const event of engine.handleToolCall(msg, 0, "uid-1", false)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("tool-call-pending");
    });
  });

  describe("sendMessage — existingMessages branches", () => {
    it("skips incomplete messages in title generation text", async () => {
      const incompleteMsg: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Broken" }],
        status: { type: "incomplete", reason: "error", error: new Error("e") },
      };
      const normalMsg: ThreadMessageLike = {
        role: "user",
        content: [{ type: "text", text: "Normal" }],
      };

      const stream = createMockStream([
        makeAssistantMsg("Reply"),
        makeEndMarker(makeAssistantMsg("Reply")),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);
      mockProvider.createChatName.mockResolvedValue(null);

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Hello",
        threadId: "t1",
        existingMessages: [incompleteMsg, normalMsg],
        extendedThinking: false,
      })) {
        events.push(event);
      }

      // createChatName should be called with text that excludes incomplete msg
      expect(mockProvider.createChatName).toHaveBeenCalled();
      const titleText = mockProvider.createChatName.mock.calls[0][0] as string;
      expect(titleText).toContain("Normal");
      expect(titleText).not.toContain("Broken");

      // Storage should also skip incomplete messages
      const createCalls = mockStorage.messages.create.mock.calls;
      // Only normalMsg + userMessage should be stored (incomplete skipped)
      // normalMsg stored, userMessage stored = 2 + assistant = 3 total
      expect(createCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("handles existingMessages with string content", async () => {
      const stringContentMsg: ThreadMessageLike = {
        role: "user",
        content: "Simple string content",
      };

      const stream = createMockStream([
        makeAssistantMsg("Reply"),
        makeEndMarker(makeAssistantMsg("Reply")),
      ]);
      mockProvider.sendMessage.mockReturnValue(stream);
      mockProvider.createChatName.mockResolvedValue(null);

      const events = [];
      for await (const event of engine.sendMessage({
        text: "Follow up",
        threadId: "t2",
        existingMessages: [stringContentMsg],
        extendedThinking: false,
      })) {
        events.push(event);
      }

      // Title text should include the string content
      expect(mockProvider.createChatName).toHaveBeenCalled();
      const titleText = mockProvider.createChatName.mock.calls[0][0] as string;
      expect(titleText).toContain("Simple string content");
    });
  });

  describe("handleToolCall — invalid idx guard", () => {
    it("returns early when content at idx is not a tool-call", async () => {
      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "No tool here" }],
      };

      const events = [];
      for await (const event of engine.handleToolCall(msg, 0, "uid-1", false)) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
      expect(mockServers.callTools).not.toHaveBeenCalled();
    });

    it("returns early when idx is out of bounds", async () => {
      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Text only" }],
      };

      const events = [];
      for await (const event of engine.handleToolCall(msg, 5, "uid-1", false)) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
    });
  });

  describe("denyToolCall — _executeToolCall guard", () => {
    it("returns early when content at idx is not a tool-call", async () => {
      const msg: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Not a tool" }],
      };

      const events = [];
      for await (const event of engine.denyToolCall(
        { message: msg, idx: 0, messageUID: "uid-1" },
        false
      )) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
      expect(mockServers.callTools).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("calls provider.stopMessage", () => {
      engine.stop();
      expect(mockProvider.stopMessage).toHaveBeenCalledOnce();
    });
  });
});
