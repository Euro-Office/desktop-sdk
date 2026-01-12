import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import { LMStudioProvider } from "../index";
import { lmStudioInfo } from "../info";

// =============================================================================
// Mock Helpers
// =============================================================================

// Shared mock functions for OpenAI client
const mockCreate = vi.fn();
const mockList = vi.fn();

/**
 * Creates a mock async iterator stream for OpenAI responses.
 */
const createMockStream = (
  events: Array<{
    choices: Array<{
      delta: { content?: string; tool_calls?: unknown[] };
      finish_reason?: string | null;
    }>;
  }>
) => {
  async function* generator() {
    for (const event of events) {
      yield event;
    }
  }
  return {
    [Symbol.asyncIterator]: generator,
    controller: { abort: vi.fn() },
  };
};

/**
 * Creates a text chunk for streaming.
 */
const createTextChunk = (content: string, finished = false) => ({
  choices: [
    {
      delta: { content },
      finish_reason: finished ? "stop" : null,
    },
  ],
});

// Mock the OpenAI SDK
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: {
    chat: { completions: { create: typeof mockCreate } };
    models: { list: typeof mockList };
  }) {
    this.chat = {
      completions: {
        create: mockCreate,
      },
    };
    this.models = {
      list: mockList,
    };
  });

  return { default: MockOpenAI };
});

describe("LMStudioProvider", () => {
  let provider: LMStudioProvider;

  beforeEach(() => {
    provider = new LMStudioProvider();
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockList.mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return provider name", () => {
      expect(provider.getName()).toBe(lmStudioInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return base URL with /v1 endpoint", () => {
      expect(provider.getBaseUrl()).toBe("http://localhost:1234/v1");
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create OpenAI client", () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should use default key 'lm-studio' when no key provided", () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("lm-studio");
    });

    it("should set URL when provided", () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://custom:8080/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe("http://custom:8080/v1");
    });

    it("should use custom key when provided", () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "custom-key",
        baseUrl: "http://localhost:1234/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("custom-key");
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
    it("should convert and set tools to OpenAI format", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get weather",
          inputSchema: { type: "object", properties: {} },
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
      provider.setModelKey("llama-3.1-8b");

      expect(provider.modelKey).toBe("llama-3.1-8b");
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
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.1-8b");

      const events = [
        createTextChunk("Hello"),
        createTextChunk(" world"),
        createTextChunk("!", true),
      ];

      mockCreate.mockResolvedValue(createMockStream(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it("should handle tool call in response", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.1-8b");

      const events = [
        {
          choices: [
            {
              delta: {
                content: "Let me check",
                tool_calls: [
                  {
                    id: "call_123",
                    type: "function",
                    function: {
                      name: "get_weather",
                      arguments: '{"city":"NYC"}',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {},
              finish_reason: "tool_calls",
            },
          ],
        },
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
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.1-8b");

      const events = [createTextChunk("Hello"), createTextChunk(" world")];

      mockCreate.mockResolvedValue(createMockStream(events));

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
    });

    it("should handle errors gracefully", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockCreate.mockRejectedValue(new Error("Connection failed"));

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
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.1-8b");

      const events = [
        createTextChunk("Based on the tool result"),
        createTextChunk(", it's sunny!", true),
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
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.1-8b");

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Generated Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Generated Title");
    });

    it("should fallback to truncated message when content is null", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.1-8b");

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const longMessage = "This is a very long message that exceeds 25 chars";
      const result = await provider.createChatName(longMessage);

      expect(result).toBe(longMessage.substring(0, 25));
    });

    it("should return empty string on error", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
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
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({ data: [{ id: "model1" }] });

      const result = await provider.checkProvider({
        url: "http://localhost:1234/v1",
      });

      expect(result).toBe(true);
    });

    it("should return error when no models loaded", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({ data: [] });

      const result = await provider.checkProvider({
        url: "http://localhost:1234/v1",
      });

      expect(result).toEqual({
        field: "url",
        message: "No models loaded in LM Studio",
      });
    });

    it("should return invalidUrl error on failure", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockRejectedValue(new Error("Connection refused"));

      const result = await provider.checkProvider({
        url: "http://invalid:1234/v1",
      });

      expect(result).toEqual({
        field: "url",
        message: "Connection refused",
      });
    });

    it("should handle non-Error objects", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockRejectedValue("String error");

      const result = await provider.checkProvider({
        url: "http://invalid:1234/v1",
      });

      expect(result).toEqual({
        field: "url",
        message: "Failed to connect to LM Studio",
      });
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return all local models", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({
        data: [
          { id: "llama-3.1-8b", object: "model" },
          { id: "mistral-7b", object: "model" },
        ],
      });

      const result = await provider.getProviderModels({
        url: "http://localhost:1234/v1",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: "llama-3.1-8b",
        provider: "lm-studio",
      });
    });

    it("should use modelNames mapping if available", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({
        data: [{ id: "test-model", object: "model" }],
      });

      const result = await provider.getProviderModels({
        url: "http://localhost:1234/v1",
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test-model");
    });

    it("should return empty array on error", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockRejectedValue(new Error("Connection failed"));

      const result = await provider.getProviderModels({
        url: "http://localhost:1234/v1",
      });

      expect(result).toEqual([]);
    });

    it("should return empty array when no models available", async () => {
      const testProvider: TProvider = {
        type: "lm-studio",
        name: "LM Studio",
        key: "",
        baseUrl: "http://localhost:1234/v1",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({ data: [] });

      const result = await provider.getProviderModels({
        url: "http://localhost:1234/v1",
      });

      expect(result).toEqual([]);
    });
  });
});
