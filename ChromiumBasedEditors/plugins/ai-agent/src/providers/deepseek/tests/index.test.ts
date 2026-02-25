import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import {
  createMockStreamWithIterator,
  createTextChunk,
} from "@/providers/tests/test-utils";
import { DeepSeekProvider } from "../index";
import { deepseekInfo } from "../info";

// =============================================================================
// Mock Setup
// =============================================================================

const mockCreate = vi.fn();
const mockList = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    models = { list: mockList };
  },
}));

beforeEach(() => {
  mockList.mockReset();
  mockList.mockResolvedValue({ data: [] });
  mockCreate.mockReset();
});

// DeepSeek-specific reasoning chunk (simpler format for mocks)
const createReasoningChunk = (reasoning_content: string) => ({
  choices: [
    {
      delta: { reasoning_content },
      finish_reason: null,
    },
  ],
});

describe("DeepSeekProvider", () => {
  let provider: DeepSeekProvider;

  beforeEach(() => {
    provider = new DeepSeekProvider();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return DeepSeek", () => {
      expect(provider.getName()).toBe(deepseekInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return DeepSeek API URL", () => {
      expect(provider.getBaseUrl()).toBe(deepseekInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods (inherited from OpenAI)
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key", () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-api-key",
        baseUrl: "https://api.deepseek.com",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-api-key");
    });
  });

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("deepseek-chat");

      expect(provider.modelKey).toBe("deepseek-chat");
    });
  });

  describe("setSystemPrompt", () => {
    it("should set system prompt", () => {
      provider.setSystemPrompt("You are a helpful assistant");

      expect(provider.systemPrompt).toBe("You are a helpful assistant");
    });
  });

  // ==========================================================================
  // checkProvider (inherited from OpenAI)
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful API call", async () => {
      mockList.mockResolvedValue({ data: [] });

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://api.deepseek.com",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on invalid_api_key", async () => {
      mockList.mockRejectedValue({ code: "invalid_api_key" });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://api.deepseek.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return invalidUrl error on connection error", async () => {
      mockList.mockRejectedValue({ message: "Connection error." });

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://invalid-url.com",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });

    it("should return emptyKey error when no API key provided", async () => {
      mockList.mockRejectedValue(new Error("Unauthorized"));

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://api.deepseek.com",
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
    it("should return models matching filter", async () => {
      mockList.mockResolvedValue({
        data: [
          { id: "deepseek-chat" },
          { id: "deepseek-coder" },
          { id: "other-model" },
        ],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      // Should only include models in modelFilters
      const filteredModels = models.filter((m) =>
        deepseekInfo.modelFilters.includes(m.id)
      );
      expect(filteredModels.length).toBe(models.length);
    });

    it("should return all models when filter is empty", async () => {
      // Temporarily store original filter
      const originalFilters = [...deepseekInfo.modelFilters];
      deepseekInfo.modelFilters.length = 0;

      mockList.mockResolvedValue({
        data: [{ id: "deepseek-chat" }, { id: "deepseek-coder" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(2);

      // Restore original filter
      deepseekInfo.modelFilters.push(...originalFilters);
    });

    it("should set provider type to deepseek", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "deepseek-chat" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0]?.provider).toBe("deepseek");
    });

    it("should use modelNames mapping when available", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "deepseek-chat" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      // Should use mapped name if exists, otherwise use model.id
      if (deepseekInfo.modelNames["deepseek-chat"]) {
        expect(models[0].name).toBe(deepseekInfo.modelNames["deepseek-chat"]);
      } else {
        expect(models[0].name).toBe("deepseek-chat");
      }
    });

    it("should reverse the models array", async () => {
      // Temporarily clear filters to get all models
      const originalFilters = [...deepseekInfo.modelFilters];
      deepseekInfo.modelFilters.length = 0;

      mockList.mockResolvedValue({
        data: [{ id: "model-1" }, { id: "model-2" }, { id: "model-3" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].id).toBe("model-3");
      expect(models[2].id).toBe("model-1");

      // Restore filters
      deepseekInfo.modelFilters.push(...originalFilters);
    });

    it("should return empty array on error", async () => {
      mockList.mockRejectedValue(new Error("Network error"));

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toEqual([]);
    });
  });

  // ==========================================================================
  // Inherited Methods (verify they work)
  // ==========================================================================

  describe("inherited methods", () => {
    it("should have sendMessage from OpenAI", () => {
      expect(provider.sendMessage).toBeDefined();
    });

    it("should have sendMessageAfterToolCall from OpenAI", () => {
      expect(provider.sendMessageAfterToolCall).toBeDefined();
    });

    it("should have createChatName from OpenAI", () => {
      expect(provider.createChatName).toBeDefined();
    });

    it("should have setPrevMessages from OpenAI", () => {
      expect(provider.setPrevMessages).toBeDefined();
    });

    it("should have setTools from OpenAI", () => {
      expect(provider.setTools).toBeDefined();
    });

    it("should stream messages using OpenAI client", async () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("deepseek-chat");

      const events = [
        createTextChunk("Hello"),
        createTextChunk(" from DeepSeek", true),
      ];

      mockCreate.mockResolvedValue(createMockStreamWithIterator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Hi" },
      ])) {
        results.push(msg);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should create chat name using OpenAI client", async () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("deepseek-chat");

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Test Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Test Title");
    });
  });

  // ==========================================================================
  // Reasoning Content (DeepSeek thinking mode)
  // ==========================================================================

  describe("reasoning content", () => {
    it("should handle reasoning_content in stream", async () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("deepseek-reasoner");

      const events = [
        createReasoningChunk("Let me think..."),
        createReasoningChunk(" about this problem."),
        createTextChunk("Here is my answer"),
        createTextChunk(".", true),
      ];

      mockCreate.mockResolvedValue(createMockStreamWithIterator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Solve this" },
      ])) {
        results.push(msg);
      }

      // Should have results with reasoning and text parts
      expect(results.length).toBeGreaterThan(0);

      // Check the final message has reasoning content
      const lastResult = results[results.length - 1] as {
        isEnd?: boolean;
        responseMessage?: { content: Array<{ type: string; text: string }> };
      };

      if (lastResult.isEnd && lastResult.responseMessage) {
        const content = lastResult.responseMessage.content;
        const reasoningPart = content.find((p) => p.type === "reasoning");
        const textPart = content.find((p) => p.type === "text");

        expect(reasoningPart).toBeDefined();
        expect(reasoningPart?.text).toContain("Let me think");
        expect(textPart).toBeDefined();
        expect(textPart?.text).toContain("Here is my answer");
      }
    });

    it("should finalize reasoning with parentId when text starts", async () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("deepseek-reasoner");

      const events = [
        createReasoningChunk("Thinking..."),
        createTextChunk("Answer", true),
      ];

      mockCreate.mockResolvedValue(createMockStreamWithIterator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Test" },
      ])) {
        results.push(msg);
      }

      const lastResult = results[results.length - 1] as {
        isEnd?: boolean;
        responseMessage?: {
          content: Array<{ type: string; text: string; parentId?: string }>;
        };
      };

      if (lastResult.isEnd && lastResult.responseMessage) {
        const reasoningPart = lastResult.responseMessage.content.find(
          (p) => p.type === "reasoning"
        );
        expect(reasoningPart?.parentId).toBeDefined();
      }
    });

    it("should add empty text part when stream ends with only reasoning", async () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("deepseek-reasoner");

      const events = [
        createReasoningChunk("Just thinking..."),
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ];

      mockCreate.mockResolvedValue(createMockStreamWithIterator(events));

      const results: unknown[] = [];
      for await (const msg of provider.sendMessage([
        { role: "user", content: "Test" },
      ])) {
        results.push(msg);
      }

      const lastResult = results[results.length - 1] as {
        isEnd?: boolean;
        responseMessage?: { content: Array<{ type: string; text: string }> };
      };

      if (lastResult.isEnd && lastResult.responseMessage) {
        const content = lastResult.responseMessage.content;
        const textPart = content.find((p) => p.type === "text");

        // Should have an empty text part added
        expect(textPart).toBeDefined();
        expect(textPart?.text).toBe("");
      }
    });
  });
});
