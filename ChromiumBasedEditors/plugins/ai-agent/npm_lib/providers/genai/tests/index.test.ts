import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenAIProvider } from "../index";
import { genaiInfo } from "../info";

// Create mock functions that can be configured per test
const mockList = vi.fn();
const mockGenerateContent = vi.fn();
const mockGenerateContentStream = vi.fn();

// Mock GoogleGenAI
vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = {
      list: mockList,
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
    };
  },
}));

// Reset mocks before each test
beforeEach(() => {
  mockList.mockReset();
  mockGenerateContent.mockReset();
  mockGenerateContentStream.mockReset();

  // Default successful mock
  mockList.mockResolvedValue({
    page: Promise.resolve([]),
    hasNextPage: () => false,
    nextPage: vi.fn(),
  });
});

describe("GenAIProvider", () => {
  let provider: GenAIProvider;

  beforeEach(() => {
    provider = new GenAIProvider();
  });

  describe("getName", () => {
    it("should return provider name from info", () => {
      expect(provider.getName()).toBe(genaiInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return base URL from info", () => {
      expect(provider.getBaseUrl()).toBe(genaiInfo.baseUrl);
    });
  });

  describe("setProvider", () => {
    it("should set provider properties", () => {
      const testProvider = {
        type: "genai" as const,
        name: "Test Provider",
        key: "test-api-key",
        baseUrl: "https://test.api.com",
      };

      provider.setProvider(testProvider);

      // Verify internal state by checking that client was recreated
      expect(provider.provider).toEqual(testProvider);
      expect(provider.apiKey).toBe("test-api-key");
      expect(provider.url).toBe("https://test.api.com");
    });
  });

  describe("setApiKey", () => {
    it("should update API key", () => {
      provider.setApiKey("new-api-key");
      expect(provider.apiKey).toBe("new-api-key");
    });
  });

  describe("setUrl", () => {
    it("should update URL", () => {
      provider.setUrl("https://new.api.com");
      expect(provider.url).toBe("https://new.api.com");
    });
  });

  describe("setPrevMessages", () => {
    it("should convert and store previous messages", () => {
      const messages: ThreadMessageLike[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: [{ type: "text", text: "Hi" }] },
      ];

      provider.setPrevMessages(messages);

      expect(provider.prevMessages).toHaveLength(2);
      expect(provider.prevMessages[0].role).toBe("user");
      expect(provider.prevMessages[1].role).toBe("model");
    });
  });

  describe("setTools", () => {
    it("should convert and store tools", () => {
      const tools = [
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { properties: { arg: { type: "string" } } },
        },
      ];

      provider.setTools(tools);

      expect(provider.tools).toHaveLength(1);
      expect(provider.tools[0].name).toBe("test_tool");
    });

    it("should handle empty tools array", () => {
      provider.setTools([]);
      expect(provider.tools).toEqual([]);
    });
  });
});

describe("sendMessage", () => {
  it("should return early when client is not set", async () => {
    const provider = new GenAIProvider();
    const generator = provider.sendMessage([]);
    const result = await generator.next();

    expect(result.done).toBe(true);
  });
});

describe("sendMessageAfterToolCall", () => {
  it("should return for string content", async () => {
    const provider = new GenAIProvider();
    const message: ThreadMessageLike = {
      role: "assistant",
      content: "text content",
    };

    const generator = provider.sendMessageAfterToolCall(message);
    const result = await generator.next();

    expect(result.done).toBe(true);
  });

  it("should return when no tool-call found", async () => {
    const provider = new GenAIProvider();
    const message: ThreadMessageLike = {
      role: "assistant",
      content: [{ type: "text", text: "No tool calls" }],
    };

    const generator = provider.sendMessageAfterToolCall(message);
    const result = await generator.next();

    expect(result.done).toBe(true);
  });
});

describe("checkProvider", () => {
  it("should return true when API key is valid", async () => {
    const provider = new GenAIProvider();

    const result = await provider.checkProvider({
      apiKey: "valid-key",
      url: "",
    });

    expect(result).toBe(true);
  });

  it("should return invalidUrl for empty object error", async () => {
    mockList.mockRejectedValue({});
    const provider = new GenAIProvider();

    const result = await provider.checkProvider({
      apiKey: "key",
      url: "bad-url",
    });

    expect(result).toEqual({ field: "url", message: "Invalid URL" });
  });

  it("should return invalidKey for API key error message", async () => {
    // Use object with message property and extra key to avoid "empty object" detection
    const error = { message: "Invalid API key provided", code: 401 };
    mockList.mockRejectedValue(error);
    const provider = new GenAIProvider();

    const result = await provider.checkProvider({
      apiKey: "bad-key",
      url: "",
    });

    expect(result).toEqual({ field: "key", message: "Invalid API key" });
  });

  it("should return emptyKey when no apiKey provided", async () => {
    // Use object with extra key to avoid "empty object" detection
    const error = { message: "Some error", code: 500 };
    mockList.mockRejectedValue(error);
    const provider = new GenAIProvider();

    const result = await provider.checkProvider({
      apiKey: "",
      url: "",
    });

    expect(result).toEqual({ field: "key", message: "Empty key" });
  });

  it("should return invalidKey for other errors with apiKey", async () => {
    // Use object with extra key to avoid "empty object" detection
    const error = { message: "Unknown error", code: 500 };
    mockList.mockRejectedValue(error);
    const provider = new GenAIProvider();

    const result = await provider.checkProvider({
      apiKey: "some-key",
      url: "",
    });

    expect(result).toEqual({ field: "key", message: "Invalid API key" });
  });
});

describe("getProviderModels", () => {
  it("should return empty array on error", async () => {
    mockList.mockRejectedValue(new Error("API error"));
    const provider = new GenAIProvider();

    const result = await provider.getProviderModels({
      apiKey: "invalid",
      url: "",
    });

    expect(result).toEqual([]);
  });

  it("should return models matching filters", async () => {
    mockList.mockResolvedValue({
      page: Promise.resolve([
        { name: "models/gemini-3-pro-preview", displayName: "Gemini 3 Pro" },
        { name: "models/unknown-model", displayName: "Unknown" },
      ]),
      hasNextPage: () => false,
      nextPage: vi.fn(),
    });
    const provider = new GenAIProvider();

    const result = await provider.getProviderModels({
      apiKey: "valid",
      url: "",
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("gemini-3-pro-preview");
  });

  it("should paginate through all pages", async () => {
    let callCount = 0;
    const nextPageMock = vi.fn().mockResolvedValue([
      {
        name: "models/gemini-3-flash-preview",
        displayName: "Gemini 3 Flash",
      },
    ]);

    mockList.mockResolvedValue({
      page: Promise.resolve([
        { name: "models/gemini-3-pro-preview", displayName: "Gemini 3 Pro" },
      ]),
      hasNextPage: () => {
        callCount++;
        return callCount === 1;
      },
      nextPage: nextPageMock,
    });
    const provider = new GenAIProvider();

    const result = await provider.getProviderModels({
      apiKey: "valid",
      url: "",
    });

    expect(result).toHaveLength(2);
    expect(nextPageMock).toHaveBeenCalled();
  });
});

describe("createChatName", () => {
  it("should return empty string when client is not set", async () => {
    const provider = new GenAIProvider();
    // Don't set provider, so client is undefined

    const result = await provider.createChatName("test message");

    expect(result).toBe("");
  });

  it("should return title from API response", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "Generated Title",
    });
    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const result = await provider.createChatName("test message");

    expect(result).toBe("Generated Title");
  });

  it("should return substring of message when response is null", async () => {
    mockGenerateContent.mockResolvedValue({
      text: null,
    });
    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const result = await provider.createChatName(
      "This is a long test message for title"
    );

    expect(result).toBe("This is a long test messa");
  });

  it("should return empty string on error", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API error"));
    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const result = await provider.createChatName("test");

    expect(result).toBe("");
  });
});

describe("sendMessage with streaming", () => {
  it("should stream responses and yield final message", async () => {
    const chunks = [
      { candidates: [{ content: { parts: [{ text: "Hello" }] } }] },
      { candidates: [{ content: { parts: [{ text: " World" }] } }] },
    ];

    mockGenerateContentStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    });

    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const messages: ThreadMessageLike[] = [{ role: "user", content: "Hi" }];
    const generator = provider.sendMessage(messages);

    const results = [];
    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBeGreaterThan(0);
    const lastResult = results[results.length - 1] as { isEnd: boolean };
    expect(lastResult.isEnd).toBe(true);
  });

  it("should handle errors and yield error response", async () => {
    mockGenerateContentStream.mockRejectedValue(new Error("Stream error"));

    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const generator = provider.sendMessage([{ role: "user", content: "Hi" }]);

    const results = [];
    for await (const result of generator) {
      results.push(result);
    }

    expect(results).toHaveLength(1);
    const errorResult = results[0] as {
      isEnd: boolean;
      responseMessage: ThreadMessageLike;
    };
    expect(errorResult.isEnd).toBe(true);
    expect(errorResult.responseMessage.status?.type).toBe("incomplete");
  });

  it("should use afterToolCall message when provided", async () => {
    mockGenerateContentStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { candidates: [{ content: { parts: [{ text: "Response" }] } }] };
      },
    });

    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const originalMessage: ThreadMessageLike = {
      role: "assistant",
      content: [
        { type: "tool-call", toolCallId: "1", toolName: "test", args: {} },
      ],
    };

    const generator = provider.sendMessage([], true, originalMessage);

    const results = [];
    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBeGreaterThan(0);
  });
});

describe("sendMessageAfterToolCall with tool result", () => {
  it("should process tool call result and continue conversation", async () => {
    mockGenerateContentStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { candidates: [{ content: { parts: [{ text: "Done" }] } }] };
      },
    });

    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const message: ThreadMessageLike = {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "call_123",
          toolName: "get_data",
          args: { id: 1 },
          result: { data: "success" },
        },
      ],
    };

    const generator = provider.sendMessageAfterToolCall(message);
    const results = [];
    for await (const result of generator) {
      results.push(result);
    }

    // Should have added function response to prevMessages
    expect(provider.prevMessages.length).toBeGreaterThan(0);
  });
});

describe("sendMessage stop flag handling", () => {
  it("should handle stop flag and yield early with content", async () => {
    let chunkIndex = 0;
    mockGenerateContentStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { candidates: [{ content: { parts: [{ text: "Hello" }] } }] };
        chunkIndex++;
        yield { candidates: [{ content: { parts: [{ text: " World" }] } }] };
        chunkIndex++;
        yield { candidates: [{ content: { parts: [{ text: "!" }] } }] };
      },
    });

    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const messages: ThreadMessageLike[] = [{ role: "user", content: "Hi" }];
    const generator = provider.sendMessage(messages);

    const results = [];
    // Set stop flag after first chunk using public method
    for await (const result of generator) {
      results.push(result);
      if (chunkIndex === 1) {
        provider.stopMessage();
      }
    }

    // Should have stopped early
    const lastResult = results[results.length - 1] as { isEnd: boolean };
    expect(lastResult.isEnd).toBe(true);
  });

  it("should handle stop flag with string content response", async () => {
    mockGenerateContentStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { candidates: [{ content: { parts: [{ text: "Response" }] } }] };
      },
    });

    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });
    // Set stop flag before starting using public method
    provider.stopMessage();

    const generator = provider.sendMessage([{ role: "user", content: "Hi" }]);
    const results = [];
    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBeGreaterThan(0);
    const lastResult = results[results.length - 1] as { isEnd: boolean };
    expect(lastResult.isEnd).toBe(true);
  });

  it("should add response to prevMessages when stopped with content", async () => {
    let yielded = false;
    mockGenerateContentStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          candidates: [{ content: { parts: [{ text: "Some content" }] } }],
        };
        yielded = true;
        // Long wait that would be interrupted
        yield { candidates: [{ content: { parts: [{ text: " more" }] } }] };
      },
    });

    const provider = new GenAIProvider();
    provider.setProvider({
      type: "genai",
      name: "Test",
      key: "key",
      baseUrl: "",
    });

    const initialLength = provider.prevMessages.length;
    const generator = provider.sendMessage([{ role: "user", content: "Hi" }]);

    for await (const result of generator) {
      if (yielded) {
        provider.stopMessage();
      }
      if ((result as { isEnd?: boolean }).isEnd) break;
    }

    // Should have added both user message and partial response to history
    expect(provider.prevMessages.length).toBeGreaterThan(initialLength);
  });
});
