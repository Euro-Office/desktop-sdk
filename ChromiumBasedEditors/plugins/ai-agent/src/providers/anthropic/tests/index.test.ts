import type {
  RawContentBlockDeltaEvent,
  RawContentBlockStartEvent,
  RawMessageStartEvent,
  RawMessageStopEvent,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import { AnthropicProvider } from "../index";
import { anthropicInfo } from "../info";

// =============================================================================
// Mock Helpers
// =============================================================================

type MockClient = {
  messages: { create: ReturnType<typeof vi.fn> };
  models: { list: ReturnType<typeof vi.fn> };
};

let mockClient: MockClient;

// Shared mock configuration for models.list
const modelsListMock = vi.fn();

const createMockStream = (events: RawMessageStreamEvent[]) => {
  const controller = { abort: vi.fn() };

  async function* generator() {
    for (const event of events) {
      yield event;
    }
  }

  return Object.assign(generator(), { controller });
};

const createMessageStartEvent = (): RawMessageStartEvent =>
  ({
    type: "message_start",
    message: {
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [],
      model: "claude-3-opus",
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  }) as unknown as RawMessageStartEvent;

const createContentBlockStartEvent = (
  index: number,
  blockType: "text" | "tool_use"
): RawContentBlockStartEvent =>
  ({
    type: "content_block_start",
    index,
    content_block:
      blockType === "text"
        ? { type: "text", text: "" }
        : { type: "tool_use", id: "tool_123", name: "test_tool", input: {} },
  }) as RawContentBlockStartEvent;

const createTextDeltaEvent = (
  index: number,
  text: string
): RawContentBlockDeltaEvent =>
  ({
    type: "content_block_delta",
    index,
    delta: { type: "text_delta", text },
  }) as RawContentBlockDeltaEvent;

const createMessageStopEvent = (): RawMessageStopEvent => ({
  type: "message_stop",
});

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn(function (this: MockClient) {
    this.messages = { create: vi.fn() };
    this.models = { list: modelsListMock };
    mockClient = this;
  });

  return { default: MockAnthropic };
});

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
    vi.clearAllMocks();
    modelsListMock.mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getBaseUrl", () => {
    it("should return anthropic base URL", () => {
      expect(provider.getBaseUrl()).toBe(anthropicInfo.baseUrl);
    });
  });

  describe("getName", () => {
    it("should return anthropic name", () => {
      expect(provider.getName()).toBe(anthropicInfo.name);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider with key and baseUrl", () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://custom.api.com",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe("https://custom.api.com");
      expect(provider.apiKey).toBe("test-key");
    });

    it("should create client when setting provider", () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
    });

    it("should handle provider without key", () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "",
        baseUrl: "https://api.anthropic.com",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.apiKey).toBeUndefined();
    });

    it("should handle provider without baseUrl", () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.url).toBeUndefined();
    });
  });

  describe("setPrevMessages", () => {
    it("should convert and set previous messages", () => {
      const messages: ThreadMessageLike[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];

      provider.setPrevMessages(messages);

      expect(provider.prevMessages).toHaveLength(2);
    });
  });

  describe("setTools", () => {
    it("should convert and set tools", () => {
      const tools = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { properties: {} },
        },
      ];

      provider.setTools(tools);

      expect(provider.tools).toHaveLength(1);
      expect(provider.tools[0]).toMatchObject({
        name: "test_tool",
        description: "A test tool",
      });
    });
  });

  // ==========================================================================
  // Model & System Prompt
  // ==========================================================================

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("claude-3-opus");

      expect(provider.modelKey).toBe("claude-3-opus");
    });
  });

  describe("setSystemPrompt", () => {
    it("should set system prompt", () => {
      provider.setSystemPrompt("You are a helpful assistant");

      expect(provider.systemPrompt).toBe("You are a helpful assistant");
    });
  });

  // ==========================================================================
  // Stop Flag
  // ==========================================================================

  describe("stopMessage", () => {
    it("should not throw when called", () => {
      expect(() => provider.stopMessage()).not.toThrow();
    });
  });

  // ==========================================================================
  // sendMessage
  // ==========================================================================

  describe("sendMessage", () => {
    it("should return early if no client", async () => {
      // Provider without client
      const gen = provider.sendMessage([{ role: "user", content: "Hi" }]);
      const result = await gen.next();

      expect(result.done).toBe(true);
    });

    it("should stream text response", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        createContentBlockStartEvent(0, "text"),
        createTextDeltaEvent(0, "Hello"),
        createTextDeltaEvent(0, " world"),
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      const results: ThreadMessageLike[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        if ("isEnd" in msg && msg.isEnd) {
          results.push(msg.responseMessage);
        } else {
          results.push(msg as ThreadMessageLike);
        }
      }

      expect(results.length).toBeGreaterThan(0);
      expect(mockClient.messages.create).toHaveBeenCalledOnce();
    });

    it("should handle stop flag during stream", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      // Create a stream that yields events slowly
      const mockStream = {
        controller: { abort: vi.fn() },
        async *[Symbol.asyncIterator]() {
          yield createMessageStartEvent();
          yield createContentBlockStartEvent(0, "text");
          // After this, stopMessage is called
          yield createTextDeltaEvent(0, "Hello");
        },
      };

      mockClient.messages.create.mockResolvedValue(mockStream);

      const results: unknown[] = [];
      let eventCount = 0;

      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
        eventCount++;
        // Trigger stop after second event
        if (eventCount === 2) {
          provider.stopMessage();
        }
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle afterToolCall flow", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        createContentBlockStartEvent(0, "text"),
        createTextDeltaEvent(0, "Continued response"),
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Previous content" }],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([], true, existingMessage)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle afterToolCall with string responseMessage content", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      // Using string content to trigger the early return in pushToHistorySliced (line 74)
      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([], true, existingMessage)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle afterToolCall with string originalMessage content", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      // Stream adds content, making responseMessage.content an array
      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        createContentBlockStartEvent(0, "text"),
        createTextDeltaEvent(0, "New content"),
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      // Original message has string content to trigger line 75
      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: "string content",
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([], true, existingMessage)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle unknown event types", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        { type: "unknown_event" } as unknown as RawMessageStreamEvent,
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should enable thinking mode for thinking-capable models", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("claude-sonnet-4-5-20241022"); // Thinking-capable model

      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        createContentBlockStartEvent(0, "text"),
        createTextDeltaEvent(0, "Response"),
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage(
        [{ role: "user", content: "Hi" }],
        false,
        undefined,
        true // withThinking=true
      )) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          thinking: {
            type: "enabled",
            budget_tokens: 10000,
          },
          max_tokens: 16000,
        })
      );
    });

    it("should handle errors gracefully", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      mockClient.messages.create.mockRejectedValue(new Error("API Error"));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
      }

      expect(results).toHaveLength(1);
      const errorResult = results[0] as {
        isEnd: boolean;
        responseMessage: ThreadMessageLike;
      };
      expect(errorResult.isEnd).toBe(true);
      expect(errorResult.responseMessage.status?.type).toBe("incomplete");
    });
  });

  // ==========================================================================
  // sendMessageAfterToolCall
  // ==========================================================================

  describe("sendMessageAfterToolCall", () => {
    it("should return early for string content", async () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: "Just text",
      };

      const generator = provider.sendMessageAfterToolCall(message);
      const result = await generator.next();

      expect(result.done).toBe(true);
    });

    it("should return early when no tool calls exist", async () => {
      const message: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Just text" }],
      };

      const generator = provider.sendMessageAfterToolCall(message);
      const result = await generator.next();

      expect(result.done).toBe(true);
    });

    it("should process tool call result and continue stream", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        createContentBlockStartEvent(0, "text"),
        createTextDeltaEvent(0, "Based on the tool result"),
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check that" },
          {
            type: "tool-call",
            toolCallId: "tool_abc123",
            toolName: "get_weather",
            args: { city: "NYC" },
            argsText: '{"city":"NYC"}',
            result: "Sunny, 72°F",
          },
        ],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessageAfterToolCall(message)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(provider.prevMessages.length).toBeGreaterThan(0);
    });

    it("should handle tool call with undefined toolCallId", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      const events: RawMessageStreamEvent[] = [
        createMessageStartEvent(),
        createContentBlockStartEvent(0, "text"),
        createTextDeltaEvent(0, "Response"),
        createMessageStopEvent(),
      ];

      mockClient.messages.create.mockResolvedValue(createMockStream(events));

      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: undefined as unknown as string,
            toolName: "test_tool",
            args: {},
            argsText: "{}",
            result: "result",
          },
        ],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessageAfterToolCall(message)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // createChatName
  // ==========================================================================

  describe("createChatName", () => {
    it("should return empty string if no client", async () => {
      const result = await provider.createChatName("test message");

      expect(result).toBe("");
    });

    it("should return title from API response", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      mockClient.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Generated Title" }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Generated Title");
    });

    it("should fallback to truncated message on error", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      mockClient.messages.create.mockRejectedValue(new Error("API Error"));

      const result = await provider.createChatName("test message");

      expect(result).toBe("");
    });

    it("should fallback to truncated message when no text in response", async () => {
      const testProvider: TProvider = {
        type: "anthropic",
        name: "Anthropic",
        key: "test-key",
        baseUrl: "https://api.anthropic.com",
      };
      provider.setProvider(testProvider);

      mockClient.messages.create.mockResolvedValue({
        content: [],
      });

      const longMessage = "This is a very long message that exceeds 25 chars";
      const result = await provider.createChatName(longMessage);

      expect(result).toBe(longMessage.substring(0, 25));
    });
  });

  // ==========================================================================
  // checkProvider
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful API call", async () => {
      modelsListMock.mockResolvedValue({ data: [] });

      const result = await provider.checkProvider({
        apiKey: "valid-key",
        url: "https://api.anthropic.com",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on 401", async () => {
      modelsListMock.mockRejectedValue({
        status: 401,
        message: "Unauthorized",
      });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://api.anthropic.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return invalidUrl error on 404", async () => {
      modelsListMock.mockRejectedValue({ status: 404, message: "Not Found" });

      const result = await provider.checkProvider({
        apiKey: "valid-key",
        url: "https://invalid.url.com",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });

    it("should return emptyKey error when no API key provided", async () => {
      modelsListMock.mockRejectedValue(new Error("Generic error"));

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://api.anthropic.com",
      });

      expect(result).toEqual({
        field: "key",
        message: "Empty key",
      });
    });

    it("should return invalidKey error for unknown errors with key", async () => {
      modelsListMock.mockRejectedValue(new Error("Unknown error"));

      const result = await provider.checkProvider({
        apiKey: "some-key",
        url: "https://api.anthropic.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return invalidUrl error on network/connection error with cause", async () => {
      // Simulates fetch error with empty cause (unreachable URL)
      modelsListMock.mockRejectedValue({ cause: {} });

      const result = await provider.checkProvider({
        apiKey: "valid-key",
        url: "https://unreachable.invalid",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return filtered and mapped models", async () => {
      // Use model IDs that match the filters in anthropicInfo
      modelsListMock.mockResolvedValue({
        data: [
          { id: "claude-haiku-4-5-20241022", display_name: "Claude Haiku" },
          { id: "claude-sonnet-4-5-20241022", display_name: "Claude Sonnet" },
          { id: "other-model", display_name: "Other Model" },
        ],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.anthropic.com",
      });

      expect(result.length).toBe(2);
      expect(result.every((m) => m.provider === "anthropic")).toBe(true);
      expect(result.map((m) => m.id)).toContain("claude-haiku-4-5-20241022");
      expect(result.map((m) => m.id)).toContain("claude-sonnet-4-5-20241022");
      expect(result.map((m) => m.id)).not.toContain("other-model");
    });

    it("should use display_name from API", async () => {
      modelsListMock.mockResolvedValue({
        data: [
          {
            id: "claude-haiku-4-5-20241022",
            display_name: "Custom Display Name",
          },
        ],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.anthropic.com",
      });

      expect(result[0].name).toBe("Custom Display Name");
    });

    it("should handle API errors gracefully", async () => {
      modelsListMock.mockRejectedValue(new Error("API Error"));

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.anthropic.com",
      });

      expect(result).toEqual([]);
    });

    it("should return empty array when no models match filters", async () => {
      modelsListMock.mockResolvedValue({
        data: [
          { id: "unknown-model-1", display_name: "Unknown 1" },
          { id: "unknown-model-2", display_name: "Unknown 2" },
        ],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.anthropic.com",
      });

      expect(result).toEqual([]);
    });
  });
});
