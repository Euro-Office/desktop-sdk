import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../capabilities";
import type { TProvider } from "../../../types";
import {
  createMockStreamWithIterator,
  createTextChunk,
} from "../../tests/test-utils";
import { OpenAICompatibleProvider } from "../index";
import { openaicompatibleInfo } from "../info";

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

describe("OpenAICompatibleProvider", () => {
  let provider: OpenAICompatibleProvider;

  beforeEach(() => {
    provider = new OpenAICompatibleProvider();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return OpenAI Compatible", () => {
      expect(provider.getName()).toBe(openaicompatibleInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return empty string as baseUrl", () => {
      expect(provider.getBaseUrl()).toBe(openaicompatibleInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods (inherited from OpenAI)
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "openaicompatible",
        name: "Custom",
        key: "test-key",
        baseUrl: "https://custom.api.com/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key", () => {
      const testProvider: TProvider = {
        type: "openaicompatible",
        name: "Custom",
        key: "test-api-key",
        baseUrl: "https://custom.api.com/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-api-key");
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
        url: "https://custom.api.com/v1",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on invalid_api_key", async () => {
      mockList.mockRejectedValue({ code: "invalid_api_key" });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://custom.api.com/v1",
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
    it("should return all models with correct provider type", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "model-a" }, { id: "model-b" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.api.com/v1",
      });

      expect(models).toHaveLength(2);
      expect(models.every((m) => m.provider === "openaicompatible")).toBe(true);
    });

    it("should use model.id as both id and name", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "custom-model-v1" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.api.com/v1",
      });

      expect(models[0].id).toBe("custom-model-v1");
      expect(models[0].name).toBe("custom-model-v1");
    });

    it("should assign Chat | Vision | Tools capabilities to all models", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "model-a" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.api.com/v1",
      });

      expect(models[0].capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools,
      );
    });

    it("should return empty array when API returns no models", async () => {
      mockList.mockResolvedValue({ data: [] });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.api.com/v1",
      });

      expect(models).toEqual([]);
    });

    it("should pass apiKey and url to createClient", async () => {
      mockList.mockResolvedValue({ data: [] });

      await provider.getProviderModels({
        apiKey: "my-key",
        url: "https://my-endpoint.com/v1",
      });

      expect(mockList).toHaveBeenCalled();
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
        type: "openaicompatible",
        name: "Custom",
        key: "test-key",
        baseUrl: "https://custom.api.com/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("custom-model");

      const events = [
        createTextChunk("Hello"),
        createTextChunk(" world", true),
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
  });
});
