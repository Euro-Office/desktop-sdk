import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import {
  createAsyncGenerator,
  createMessage,
  createMistralFinishEvent,
  createMistralTextDeltaEvent,
  createMistralToolCallEvent,
  createTestProvider,
  createToolCallPart,
} from "@/providers/tests/test-utils";
import { MistralProvider } from "../index";
import { mistralInfo } from "../info";

// =============================================================================
// Mock Setup
// =============================================================================

let _mockClient = {} as MockClient;

type MockClient = {
  chat: {
    stream: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
  };
  models: { list: ReturnType<typeof vi.fn> };
};

const modelsListMock = vi.fn();
const chatStreamMock = vi.fn();
const chatCompleteMock = vi.fn();

// Mock the Mistral SDK
vi.mock("@mistralai/mistralai", () => ({
  Mistral: vi.fn(function (this: MockClient) {
    this.chat = {
      stream: chatStreamMock,
      complete: chatCompleteMock,
    };
    this.models = { list: modelsListMock };
    _mockClient = this;
  }),
}));

describe("MistralProvider", () => {
  let provider: MistralProvider;

  beforeEach(() => {
    provider = new MistralProvider();
    vi.clearAllMocks();
    modelsListMock.mockReset();
    chatStreamMock.mockReset();
    chatCompleteMock.mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getBaseUrl", () => {
    it("should return Mistral base URL", () => {
      expect(provider.getBaseUrl()).toBe(mistralInfo.baseUrl);
    });
  });

  describe("getName", () => {
    it("should return Mistral name", () => {
      expect(provider.getName()).toBe(mistralInfo.name);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider with key and baseUrl", () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe("https://api.mistral.ai");
      expect(provider.apiKey).toBe("test-key");
    });

    it("should create client when setting provider", () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
    });

    it("should handle provider without key", () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "",
        baseUrl: "https://api.mistral.ai",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.apiKey).toBeUndefined();
    });

    it("should handle provider without baseUrl", () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
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
        createMessage("user", "Hello"),
        createMessage("assistant", "Hi there!"),
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
        type: "function",
        function: {
          name: "test_tool",
          description: "A test tool",
        },
      });
    });
  });

  // ==========================================================================
  // Model & System Prompt
  // ==========================================================================

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("mistral-large-latest");

      expect(provider.modelKey).toBe("mistral-large-latest");
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
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      const events = [
        createMistralTextDeltaEvent("Hello"),
        createMistralTextDeltaEvent(" world"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

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
      expect(chatStreamMock).toHaveBeenCalledOnce();
    });

    it("should handle tool call in stream", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);
      provider.setTools([
        {
          name: "get_weather",
          description: "Get weather",
          inputSchema: { properties: {} },
        },
      ]);

      const events = [
        createMistralToolCallEvent("tool_123", "get_weather", '{"city":"NYC"}'),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "What's the weather?" },
      ])) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);

      const lastResult = results[results.length - 1] as {
        isEnd?: boolean;
        responseMessage?: { content: Array<{ type: string }> };
      };

      if (lastResult.isEnd && lastResult.responseMessage) {
        const toolCall = lastResult.responseMessage.content.find(
          (c) => c.type === "tool-call"
        );
        expect(toolCall).toBeDefined();
      }
    });

    it("should handle stop flag during stream", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield createMistralTextDeltaEvent("Hello");
          yield createMistralTextDeltaEvent(" there");
        },
      };

      chatStreamMock.mockResolvedValue(mockStream);

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

    it("should handle afterToolCall flow", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      const events = [
        createMistralTextDeltaEvent("Based on the weather"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ type: "text", text: "Let me check" }],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([], true, existingMessage)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle afterToolCall with string responseMessage content", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      const events = [createMistralFinishEvent()];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

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
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      const events = [
        createMistralTextDeltaEvent("New content"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

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

    it("should handle errors gracefully", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      chatStreamMock.mockRejectedValue(new Error("API Error"));

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
    });

    it("should skip events without choices", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      const events = [
        { data: { choices: [] } },
        { data: {} },
        createMistralTextDeltaEvent("Hello"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should use reasoning model when withThinking is true and model matches", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("mistral-small-latest");

      const events = [
        createMistralTextDeltaEvent("Thinking..."),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage(
        [{ role: "user", content: "Think about this" }],
        false,
        undefined,
        true // withThinking=true
      )) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(chatStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "magistral-small-latest",
        })
      );
    });

    it("should use original model when withThinking is true but model does not match reasoning levels", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("mistral-custom-model");

      const events = [
        createMistralTextDeltaEvent("Response"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage(
        [{ role: "user", content: "Question" }],
        false,
        undefined,
        true // withThinking=true
      )) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(chatStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "mistral-custom-model",
        })
      );
    });

    it("should use original model when withThinking is false", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("mistral-small-latest");

      const events = [
        createMistralTextDeltaEvent("Response"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage(
        [{ role: "user", content: "Hi" }],
        false,
        undefined,
        false // withThinking=false
      )) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(chatStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "mistral-small-latest",
        })
      );
    });

    it("should use medium reasoning model when model includes medium", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("mistral-medium-latest");

      const events = [
        createMistralTextDeltaEvent("Response"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

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
      expect(chatStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "magistral-medium-latest",
        })
      );
    });

    it("should use large reasoning model when model includes large", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("mistral-large-latest");

      const events = [
        createMistralTextDeltaEvent("Response"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

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
      // large maps to magistral-medium-latest based on info.ts
      expect(chatStreamMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "magistral-medium-latest",
        })
      );
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
      provider.setProvider(
        createTestProvider("mistral", {
          baseUrl: "https://api.mistral.ai",
        }) as TProvider
      );

      const events = [
        createMistralTextDeltaEvent("The weather is sunny"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const message = {
        role: "assistant" as const,
        content: [
          { type: "text" as const, text: "Let me check" },
          createToolCallPart({
            toolCallId: "tool_abc123",
            toolName: "get_weather",
            args: { city: "NYC" },
            argsText: '{"city":"NYC"}',
            result: "Sunny, 72F",
          }),
        ],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessageAfterToolCall(message)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(provider.prevMessages.length).toBeGreaterThan(0);
    });

    it("should handle tool call with object result", async () => {
      provider.setProvider(
        createTestProvider("mistral", {
          baseUrl: "https://api.mistral.ai",
        }) as TProvider
      );

      const events = [
        createMistralTextDeltaEvent("Done"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const message = {
        role: "assistant" as const,
        content: [
          createToolCallPart({
            toolCallId: "tool_obj",
            toolName: "get_data",
            result: { temperature: 72, condition: "sunny" },
          }),
        ],
      };

      const results: unknown[] = [];
      for await (const msg of provider.sendMessageAfterToolCall(message)) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle tool call with undefined toolCallId", async () => {
      provider.setProvider(
        createTestProvider("mistral", {
          baseUrl: "https://api.mistral.ai",
        }) as TProvider
      );

      const events = [
        createMistralTextDeltaEvent("Response"),
        createMistralFinishEvent(),
      ];

      chatStreamMock.mockResolvedValue(createAsyncGenerator(events));

      const message = {
        role: "assistant" as const,
        content: [
          {
            ...createToolCallPart({ result: "result" }),
            toolCallId: undefined as unknown as string,
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
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      chatCompleteMock.mockResolvedValue({
        choices: [{ message: { content: "Generated Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Generated Title");
    });

    it("should truncate long titles to 25 characters", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      chatCompleteMock.mockResolvedValue({
        choices: [
          {
            message: {
              content: "This is a very long title that exceeds 25 characters",
            },
          },
        ],
      });

      const result = await provider.createChatName("test message");

      expect(result.length).toBeLessThanOrEqual(25);
    });

    it("should fallback to truncated message when no content", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      chatCompleteMock.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      const longMessage = "This is a very long message that exceeds 25 chars";
      const result = await provider.createChatName(longMessage);

      expect(result).toBe(longMessage.substring(0, 25));
    });

    it("should return empty string on error", async () => {
      const testProvider: TProvider = {
        type: "mistral",
        name: "Mistral",
        key: "test-key",
        baseUrl: "https://api.mistral.ai",
      };
      provider.setProvider(testProvider);

      chatCompleteMock.mockRejectedValue(new Error("API Error"));

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
        url: "https://api.mistral.ai",
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
        url: "https://api.mistral.ai",
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
        url: "https://api.mistral.ai",
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
        url: "https://api.mistral.ai",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return invalidUrl error on network error with cause", async () => {
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

    it("should return invalidUrl error on status 0", async () => {
      modelsListMock.mockRejectedValue({ status: 0 });

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
      modelsListMock.mockResolvedValue({
        data: [
          { id: "mistral-large-latest" },
          { id: "mistral-small-latest" },
          { id: "other-model" },
        ],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result.length).toBe(2);
      expect(result.every((m) => m.provider === "mistral")).toBe(true);
      expect(result.map((m) => m.id)).toContain("mistral-large-latest");
      expect(result.map((m) => m.id)).toContain("mistral-small-latest");
      expect(result.map((m) => m.id)).not.toContain("other-model");
    });

    it("should use modelNames mapping for display names", async () => {
      modelsListMock.mockResolvedValue({
        data: [{ id: "mistral-large-latest" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result[0].name).toBe("Mistral Large");
    });

    it("should handle API errors gracefully", async () => {
      modelsListMock.mockRejectedValue(new Error("API Error"));

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result).toEqual([]);
    });

    it("should return empty array when no models match filters", async () => {
      modelsListMock.mockResolvedValue({
        data: [{ id: "unknown-model-1" }, { id: "unknown-model-2" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result).toEqual([]);
    });

    it("should handle empty response data", async () => {
      modelsListMock.mockResolvedValue({ data: null });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result).toEqual([]);
    });

    it("should return all models when filters are empty", async () => {
      const originalFilters = [...mistralInfo.modelFilters];
      mistralInfo.modelFilters.length = 0;

      modelsListMock.mockResolvedValue({
        data: [{ id: "any-model-1" }, { id: "any-model-2" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result).toHaveLength(2);

      // Restore filters
      mistralInfo.modelFilters.push(...originalFilters);
    });

    it("should use model id as name when not in modelNames", async () => {
      const originalFilters = [...mistralInfo.modelFilters];
      mistralInfo.modelFilters.length = 0;

      modelsListMock.mockResolvedValue({
        data: [{ id: "custom-model-id" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result[0].name).toBe("custom-model-id");

      // Restore filters
      mistralInfo.modelFilters.push(...originalFilters);
    });

    it("should handle model with undefined id", async () => {
      const originalFilters = [...mistralInfo.modelFilters];
      mistralInfo.modelFilters.length = 0;

      modelsListMock.mockResolvedValue({
        data: [{ id: undefined }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.mistral.ai",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("");
      expect(result[0].name).toBe("Unknown");

      // Restore filters
      mistralInfo.modelFilters.push(...originalFilters);
    });
  });
});
