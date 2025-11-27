import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import { OpenAIProvider } from "../index";
import { openaiInfo } from "../info";

// =============================================================================
// Mock Helpers
// =============================================================================

type MockClient = {
  chat: { completions: { create: ReturnType<typeof vi.fn> } };
  models: { list: ReturnType<typeof vi.fn> };
};

let mockClient: MockClient;

const modelsListMock = vi.fn();

/**
 * Creates a mock async iterator stream for OpenAI responses.
 */
const createMockStream = (events: ChatCompletionChunk[]) => {
  const controller = { abort: vi.fn() };

  async function* generator() {
    for (const event of events) {
      yield event;
    }
  }

  return Object.assign(generator(), { controller });
};

/**
 * Creates a text delta chunk for streaming.
 */
const createTextDeltaChunk = (content: string): ChatCompletionChunk =>
  ({
    id: "chatcmpl-123",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  }) as ChatCompletionChunk;

/**
 * Creates a tool call delta chunk for streaming.
 */
const createToolCallChunk = (
  toolCallId: string,
  toolName: string,
  args: string
): ChatCompletionChunk =>
  ({
    id: "chatcmpl-123",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: toolCallId,
              type: "function",
              function: { name: toolName, arguments: args },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  }) as ChatCompletionChunk;

/**
 * Creates a finish chunk to end the stream.
 */
const createFinishChunk = (): ChatCompletionChunk =>
  ({
    id: "chatcmpl-123",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "gpt-4",
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  }) as ChatCompletionChunk;

// Mock the OpenAI SDK
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: MockClient) {
    this.chat = { completions: { create: vi.fn() } };
    this.models = { list: modelsListMock };
    mockClient = this;
  });

  return { default: MockOpenAI };
});

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    vi.clearAllMocks();
    modelsListMock.mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return provider name", () => {
      expect(provider.getName()).toBe(openaiInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return base URL", () => {
      expect(provider.getBaseUrl()).toBe(openaiInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider with valid key and baseUrl", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.apiKey).toBe("test-key");
      expect(provider.url).toBe("https://api.openai.com/v1");
    });

    it("should handle provider without key", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.apiKey).toBeUndefined();
    });

    it("should handle provider without baseUrl", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
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
          name: "get_weather",
          description: "Get weather",
          inputSchema: { type: "object" },
        },
      ];

      provider.setTools(tools);

      expect(provider.tools).toHaveLength(1);
      expect(provider.tools[0]).toMatchObject({
        type: "function",
        function: { name: "get_weather" },
      });
    });
  });

  // ==========================================================================
  // Model & System Prompt
  // ==========================================================================

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("gpt-4");

      expect(provider.modelKey).toBe("gpt-4");
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
      const gen = provider.sendMessage([{ role: "user", content: "Hi" }]);
      const result = await gen.next();

      expect(result.done).toBe(true);
    });

    it("should stream text response", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextDeltaChunk("Hello"),
        createTextDeltaChunk(" world"),
        createFinishChunk(),
      ];

      mockClient.chat.completions.create.mockResolvedValue(
        createMockStream(events)
      );

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
      expect(mockClient.chat.completions.create).toHaveBeenCalledOnce();
    });

    it("should handle tool call chunks", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createToolCallChunk("tool_123", "get_weather", '{"city":'),
        createToolCallChunk("", "", '"NYC"}'),
        createFinishChunk(),
      ];

      mockClient.chat.completions.create.mockResolvedValue(
        createMockStream(events)
      );

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "What is the weather?" },
      ])) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle stop flag during stream", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const mockStream = {
        controller: { abort: vi.fn() },
        async *[Symbol.asyncIterator]() {
          yield createTextDeltaChunk("Hello");
          yield createTextDeltaChunk(" world");
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const results: unknown[] = [];
      let eventCount = 0;

      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
        eventCount++;
        if (eventCount === 1) {
          provider.stopMessage();
        }
      }

      expect(results.length).toBeGreaterThan(0);
      expect(mockStream.controller.abort).toHaveBeenCalled();
    });

    it("should handle afterToolCall flow", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextDeltaChunk("Based on the result"),
        createFinishChunk(),
      ];

      mockClient.chat.completions.create.mockResolvedValue(
        createMockStream(events)
      );

      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: { city: "NYC" },
            argsText: '{"city":"NYC"}',
            result: "Sunny, 72°F",
          },
        ],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([], true, existingMessage)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle afterToolCall with string content in response", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [createFinishChunk()];

      mockClient.chat.completions.create.mockResolvedValue(
        createMockStream(events)
      );

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

    it("should filter after tool call content correctly", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextDeltaChunk("New response after tool"),
        createFinishChunk(),
      ];

      mockClient.chat.completions.create.mockResolvedValue(
        createMockStream(events)
      );

      // Original message with tool call and existing text
      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check" },
          {
            type: "tool-call",
            toolCallId: "tool_123",
            toolName: "get_weather",
            args: {},
            argsText: "{}",
            result: "Sunny",
          },
        ],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([], true, existingMessage)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle errors gracefully", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      mockClient.chat.completions.create.mockRejectedValue(
        new Error("API Error")
      );

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
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextDeltaChunk("Based on the tool result"),
        createFinishChunk(),
      ];

      mockClient.chat.completions.create.mockResolvedValue(
        createMockStream(events)
      );

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
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextDeltaChunk("Response"),
        createFinishChunk(),
      ];

      mockClient.chat.completions.create.mockResolvedValue(
        createMockStream(events)
      );

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
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Generated Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Generated Title");
    });

    it("should fallback to truncated message when content is null", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const longMessage = "This is a very long message that exceeds 25 chars";
      const result = await provider.createChatName(longMessage);

      expect(result).toBe(longMessage.substring(0, 25));
    });

    it("should return empty string on error", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      mockClient.chat.completions.create.mockRejectedValue(
        new Error("API Error")
      );

      const result = await provider.createChatName("test message");

      expect(result).toBe("");
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
        url: "https://api.openai.com/v1",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on invalid_api_key error code", async () => {
      modelsListMock.mockRejectedValue({
        code: "invalid_api_key",
        message: "Invalid API Key",
      });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://api.openai.com/v1",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return emptyKey error when no API key provided", async () => {
      modelsListMock.mockRejectedValue(new Error("Generic error"));

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://api.openai.com/v1",
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
        url: "https://api.openai.com/v1",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return filtered and mapped models", async () => {
      modelsListMock.mockResolvedValue({
        data: [{ id: "gpt-4.1" }, { id: "gpt-5" }, { id: "other-model" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.openai.com/v1",
      });

      // Should filter to only models in openaiInfo.modelFilters
      expect(result.every((m) => m.provider === "openai")).toBe(true);
      expect(result.map((m) => m.id)).not.toContain("other-model");
    });

    it("should use modelNames mapping for display names", async () => {
      modelsListMock.mockResolvedValue({
        data: [{ id: "gpt-4.1" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.openai.com/v1",
      });

      if (result.length > 0) {
        expect(result[0].name).toBe(openaiInfo.modelNames["gpt-4.1"]);
      }
    });

    it("should return empty array when no models match filters", async () => {
      modelsListMock.mockResolvedValue({
        data: [{ id: "unknown-model-1" }, { id: "unknown-model-2" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.openai.com/v1",
      });

      expect(result).toEqual([]);
    });
  });
});
