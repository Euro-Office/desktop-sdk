import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import { OllamaProvider } from "../index";
import { ollamaInfo } from "../info";

// =============================================================================
// Mock Helpers
// =============================================================================

// Shared mock functions for all Ollama instances
const mockChat = vi.fn();
const mockList = vi.fn();
const mockAbort = vi.fn();

/**
 * Creates a mock async iterator stream for Ollama responses.
 */
const createMockStream = (
  events: Array<{ message: { content: string }; done: boolean }>
) => {
  async function* generator() {
    for (const event of events) {
      yield event;
    }
  }
  return generator();
};

/**
 * Creates a text chunk for streaming.
 */
const createTextChunk = (content: string, done = false) => ({
  message: { content },
  done,
});

// Mock the Ollama SDK
vi.mock("ollama/browser", () => {
  const MockOllama = vi.fn(function (
    this: Record<string, ReturnType<typeof vi.fn>>
  ) {
    this.chat = mockChat;
    this.list = mockList;
    this.abort = mockAbort;
  });

  return { Ollama: MockOllama };
});

describe("OllamaProvider", () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider();
    vi.clearAllMocks();
    mockChat.mockReset();
    mockList.mockReset();
    mockAbort.mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return provider name", () => {
      expect(provider.getName()).toBe(ollamaInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return base URL", () => {
      expect(provider.getBaseUrl()).toBe(ollamaInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key when provided", () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "test-key",
        baseUrl: "http://localhost:11434",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-key");
    });

    it("should set URL when provided", () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://custom:8080",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe("http://custom:8080");
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
        type: "string",
        function: { name: "get_weather" },
      });
    });
  });

  // ==========================================================================
  // Model & System Prompt
  // ==========================================================================

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("llama3");

      expect(provider.modelKey).toBe("llama3");
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
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama3");

      const events = [
        createTextChunk("Hello"),
        createTextChunk("Hello world"),
        createTextChunk("Hello world!", true),
      ];

      mockChat.mockResolvedValue(createMockStream(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(mockChat).toHaveBeenCalledOnce();
    });

    it("should handle tool call in response", async () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama3");

      const toolJson = '{"name":"get_weather","args":{"city":"NYC"}}';
      const events = [
        createTextChunk("Let me check"),
        createTextChunk(`Let me check<TOOL_CALL>${toolJson}</TOOL_CALL>`, true),
      ];

      mockChat.mockResolvedValue(createMockStream(events));

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
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama3");

      const events = [createTextChunk("Hello"), createTextChunk("Hello world")];

      mockChat.mockResolvedValue(createMockStream(events));

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
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama3");

      const events = [
        createTextChunk("Based on the result"),
        createTextChunk("Based on the result, it's sunny.", true),
      ];

      mockChat.mockResolvedValue(createMockStream(events));

      const existingMessage: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "123",
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
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);

      mockChat.mockRejectedValue(new Error("Connection failed"));

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
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama3");

      const events = [
        createTextChunk("Based on the tool result"),
        createTextChunk("Based on the tool result, it's sunny!", true),
      ];

      mockChat.mockResolvedValue(createMockStream(events));

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
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama3");

      mockChat.mockResolvedValue({
        message: { content: "Generated Title" },
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Generated Title");
    });

    it("should fallback to truncated message when content is null", async () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama3");

      mockChat.mockResolvedValue({
        message: { content: null },
      });

      const longMessage = "This is a very long message that exceeds 25 chars";
      const result = await provider.createChatName(longMessage);

      expect(result).toBe(longMessage.substring(0, 25));
    });

    it("should return empty string on error", async () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);

      mockChat.mockRejectedValue(new Error("API Error"));

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
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({ models: [] });

      const result = await provider.checkProvider({
        url: "http://localhost:11434",
      });

      expect(result).toBe(true);
    });

    it("should return invalidUrl error on failure", async () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);

      mockList.mockRejectedValue(new Error("Connection refused"));

      const result = await provider.checkProvider({
        url: "http://invalid:11434",
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
    it("should return all local models", async () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({
        models: [
          { model: "llama3:latest", name: "llama3:latest" },
          { model: "mistral:latest", name: "mistral:latest" },
        ],
      });

      const result = await provider.getProviderModels({
        url: "http://localhost:11434",
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: "llama3:latest",
        provider: "ollama",
      });
    });

    it("should use modelNames mapping if available", async () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({
        models: [{ model: "test-model", name: "test-model" }],
      });

      const result = await provider.getProviderModels({
        url: "http://localhost:11434",
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test-model");
    });

    it("should return empty array when no models available", async () => {
      const testProvider: TProvider = {
        type: "ollama",
        name: "Ollama",
        key: "",
        baseUrl: "http://localhost:11434",
      };
      provider.setProvider(testProvider);

      mockList.mockResolvedValue({ models: [] });

      const result = await provider.getProviderModels({
        url: "http://localhost:11434",
      });

      expect(result).toEqual([]);
    });
  });
});
