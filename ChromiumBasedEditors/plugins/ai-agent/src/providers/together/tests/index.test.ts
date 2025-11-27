import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatCompletionChunk } from "together-ai/resources/chat/completions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import { TogetherProvider } from "../index";
import { togetherInfo } from "../info";

// =============================================================================
// Mock Helpers
// =============================================================================

const mockCreate = vi.fn();
const mockModelsList = vi.fn();

/**
 * Creates a mock async iterator stream for Together responses.
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
const createTextChunk = (content: string): ChatCompletionChunk =>
  ({
    id: "chatcmpl-123",
    object: "chat.completion.chunk",
    created: Date.now(),
    model: "deepseek-ai/DeepSeek-V3.1",
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
    model: "deepseek-ai/DeepSeek-V3.1",
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
    model: "deepseek-ai/DeepSeek-V3.1",
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  }) as ChatCompletionChunk;

// Mock the Together SDK
vi.mock("together-ai", () => {
  const MockTogether = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
    this.models = { list: mockModelsList };
  });

  return { default: MockTogether };
});

describe("TogetherProvider", () => {
  let provider: TogetherProvider;

  beforeEach(() => {
    provider = new TogetherProvider();
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockModelsList.mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return provider name", () => {
      expect(provider.getName()).toBe(togetherInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return base URL", () => {
      expect(provider.getBaseUrl()).toBe(togetherInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key when provided", () => {
      const testProvider: TProvider = {
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-key");
    });

    it("should set URL when provided", () => {
      const testProvider: TProvider = {
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://custom.api.com/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe("https://custom.api.com/v1");
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
      provider.setModelKey("deepseek-ai/DeepSeek-V3.1");

      expect(provider.modelKey).toBe("deepseek-ai/DeepSeek-V3.1");
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
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextChunk("Hello"),
        createTextChunk(" world"),
        createFinishChunk(),
      ];

      mockCreate.mockResolvedValue(createMockStream(events));

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
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it("should handle tool call chunks", async () => {
      const testProvider: TProvider = {
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createToolCallChunk("tool_123", "get_weather", '{"city":'),
        createToolCallChunk("", "", '"NYC"}'),
        createFinishChunk(),
      ];

      mockCreate.mockResolvedValue(createMockStream(events));

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
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      const mockStream = createMockStream([
        createTextChunk("Hello"),
        createTextChunk(" world"),
      ]);

      mockCreate.mockResolvedValue(mockStream);

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
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextChunk("Based on the result"),
        createFinishChunk(),
      ];

      mockCreate.mockResolvedValue(createMockStream(events));

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

    it("should handle errors gracefully", async () => {
      const testProvider: TProvider = {
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      mockCreate.mockRejectedValue(new Error("API Error"));

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
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      const events: ChatCompletionChunk[] = [
        createTextChunk("Based on the tool result"),
        createFinishChunk(),
      ];

      mockCreate.mockResolvedValue(createMockStream(events));

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
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Generated Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Generated Title");
    });

    it("should fallback to truncated message when content is null", async () => {
      const testProvider: TProvider = {
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const longMessage = "This is a very long message that exceeds 25 chars";
      const result = await provider.createChatName(longMessage);

      expect(result).toBe(longMessage.substring(0, 25));
    });

    it("should return empty string on error", async () => {
      const testProvider: TProvider = {
        type: "together",
        name: "TogetherAI",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };
      provider.setProvider(testProvider);

      mockCreate.mockRejectedValue(new Error("API Error"));

      const result = await provider.createChatName("test message");

      expect(result).toBe("");
    });
  });

  // ==========================================================================
  // checkProvider
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful API call", async () => {
      mockModelsList.mockResolvedValue([]);

      const result = await provider.checkProvider({
        apiKey: "valid-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on 401 status", async () => {
      mockModelsList.mockRejectedValue({ status: 401 });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return emptyKey error when no API key provided", async () => {
      mockModelsList.mockRejectedValue(new Error("Generic error"));

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://api.together.xyz/v1",
      });

      expect(result).toEqual({
        field: "key",
        message: "Empty key",
      });
    });

    it("should return invalidKey error for unknown errors with key", async () => {
      mockModelsList.mockRejectedValue(new Error("Unknown error"));

      const result = await provider.checkProvider({
        apiKey: "some-key",
        url: "https://api.together.xyz/v1",
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
    it("should return filtered chat models", async () => {
      mockModelsList.mockResolvedValue([
        {
          id: "deepseek-ai/DeepSeek-V3.1",
          type: "chat",
          display_name: "DeepSeek V3.1",
        },
        { id: "other-model", type: "chat", display_name: "Other" },
      ]);

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      // Should filter to only models in modelFilters
      expect(result.every((m) => m.provider === "together")).toBe(true);
    });

    it("should use modelNames mapping for display names", async () => {
      mockModelsList.mockResolvedValue([
        {
          id: "deepseek-ai/DeepSeek-V3.1",
          type: "chat",
          display_name: "DeepSeek V3.1",
        },
      ]);

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      if (result.length > 0) {
        expect(result[0].name).toBe("DeepSeek V3.1");
      }
    });

    it("should return empty array when no models match filters", async () => {
      mockModelsList.mockResolvedValue([
        { id: "unknown-model", type: "chat", display_name: "Unknown" },
      ]);

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result).toEqual([]);
    });
  });
});
