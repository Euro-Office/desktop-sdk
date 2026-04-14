import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../capabilities";
import type { TProvider } from "../../../types";
import {
  createMockStreamWithIterator,
  createTextChunk,
} from "../../tests/test-utils";
import { GroqProvider } from "../index";
import { groqInfo } from "../info";

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

describe("GroqProvider", () => {
  let provider: GroqProvider;

  beforeEach(() => {
    provider = new GroqProvider();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return Groq", () => {
      expect(provider.getName()).toBe(groqInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return Groq API URL", () => {
      expect(provider.getBaseUrl()).toBe(groqInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods (inherited from OpenAI)
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "groq",
        name: "Groq",
        key: "test-key",
        baseUrl: "https://api.groq.com/openai/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key", () => {
      const testProvider: TProvider = {
        type: "groq",
        name: "Groq",
        key: "test-api-key",
        baseUrl: "https://api.groq.com/openai/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-api-key");
    });
  });

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("llama-3.3-70b-versatile");

      expect(provider.modelKey).toBe("llama-3.3-70b-versatile");
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
        url: "https://api.groq.com/openai/v1",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on invalid_api_key", async () => {
      mockList.mockRejectedValue({ code: "invalid_api_key" });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://api.groq.com/openai/v1",
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
        url: "https://api.groq.com/openai/v1",
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
    it("should return models from API with correct provider type", async () => {
      mockList.mockResolvedValue({
        data: [
          { id: "llama-3.3-70b-versatile" },
          { id: "mixtral-8x7b-32768" },
        ],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(2);
      expect(models.every((m) => m.provider === "groq")).toBe(true);
    });

    it("should use model.id as both id and name", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "llama-3.3-70b-versatile" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].id).toBe("llama-3.3-70b-versatile");
      expect(models[0].name).toBe("llama-3.3-70b-versatile");
    });

    it("should filter out whisper models", async () => {
      mockList.mockResolvedValue({
        data: [
          { id: "llama-3.3-70b-versatile" },
          { id: "whisper-large-v3" },
          { id: "whisper-large-v3-turbo" },
          { id: "mixtral-8x7b-32768" },
        ],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(2);
      expect(models.every((m) => !m.id.includes("whisper"))).toBe(true);
    });

    it("should assign Chat | Tools capabilities to regular models", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "llama-3.3-70b-versatile" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools,
      );
    });

    it("should add Vision capability to vision models", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "llama-3.2-90b-vision-preview" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools | CapabilitiesUI.Vision,
      );
    });

    it("should use custom url when provided", async () => {
      mockList.mockResolvedValue({ data: [{ id: "model-1" }] });

      await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.groq.com/v1",
      });

      expect(mockList).toHaveBeenCalled();
    });

    it("should use default baseUrl when url is empty", async () => {
      mockList.mockResolvedValue({ data: [{ id: "model-1" }] });

      await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(mockList).toHaveBeenCalled();
    });

    it("should return empty array when no models (after filtering)", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "whisper-large-v3" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toEqual([]);
    });
  });

  // ==========================================================================
  // Inherited Methods
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

    it("should stream messages using OpenAI client", async () => {
      const testProvider: TProvider = {
        type: "groq",
        name: "Groq",
        key: "test-key",
        baseUrl: "https://api.groq.com/openai/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.3-70b-versatile");

      const events = [
        createTextChunk("Hello"),
        createTextChunk(" from Groq", true),
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
        type: "groq",
        name: "Groq",
        key: "test-key",
        baseUrl: "https://api.groq.com/openai/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("llama-3.3-70b-versatile");

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Test Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Test Title");
    });
  });
});
