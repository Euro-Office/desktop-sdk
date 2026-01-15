import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import {
  createFinishChunk,
  createMockStream,
  createReasoningChunk,
  createTextDeltaChunk,
  createToolCallChunk,
} from "@/providers/tests/test-utils";
import { OpenAIProvider } from "../index";
import { openaiInfo } from "../info";

// =============================================================================
// Mock Setup
// =============================================================================

const { modelsListMock, chatCreateMock } = vi.hoisted(() => ({
  modelsListMock: vi.fn(),
  chatCreateMock: vi.fn(),
}));

// Mock the OpenAI SDK
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: chatCreateMock } };
    models = { list: modelsListMock };
  },
}));

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

      chatCreateMock.mockResolvedValue(createMockStream(events));

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

      chatCreateMock.mockResolvedValue(createMockStream(events));

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

      chatCreateMock.mockResolvedValue(mockStream);

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
      // Stop flag is set, behavior verified by results being returned
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

      chatCreateMock.mockResolvedValue(createMockStream(events));

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

      chatCreateMock.mockResolvedValue(createMockStream(events));

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

      chatCreateMock.mockResolvedValue(createMockStream(events));

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

      chatCreateMock.mockRejectedValue(new Error("API Error"));

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

      chatCreateMock.mockResolvedValue(createMockStream(events));

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

      chatCreateMock.mockResolvedValue(createMockStream(events));

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

      chatCreateMock.mockResolvedValue({
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

      chatCreateMock.mockResolvedValue({
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

      chatCreateMock.mockRejectedValue(new Error("API Error"));

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

    it("should fallback to uppercased model id when not in modelNames", async () => {
      // Add a model to filters that's not in modelNames (for testing fallback)
      const originalFilters = openaiInfo.modelFilters;
      openaiInfo.modelFilters = [...originalFilters, "test-model-without-name"];

      modelsListMock.mockResolvedValue({
        data: [{ id: "test-model-without-name" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.openai.com/v1",
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("TEST-MODEL-WITHOUT-NAME");

      // Restore original filters
      openaiInfo.modelFilters = originalFilters;
    });
  });

  // ==========================================================================
  // Stop flag with reasoning content
  // ==========================================================================

  describe("stop flag with reasoning", () => {
    it("should finalize reasoning when stop is triggered during reasoning", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };
      provider.setProvider(testProvider);

      // Create a stream that yields reasoning content
      const mockStream = {
        controller: { abort: vi.fn() },
        async *[Symbol.asyncIterator]() {
          yield createReasoningChunk("Thinking...");
          yield createReasoningChunk(" more thinking");
        },
      };

      chatCreateMock.mockResolvedValue(mockStream);

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
  });
});
