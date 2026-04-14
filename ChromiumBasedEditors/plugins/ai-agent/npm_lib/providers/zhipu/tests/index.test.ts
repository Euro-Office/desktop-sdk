import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../capabilities";
import type { TProvider } from "../../../types";
import {
  createMockStreamWithIterator,
  createTextChunk,
} from "../../tests/test-utils";
import { ZhipuProvider } from "../index";
import { zhipuInfo } from "../info";

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

describe("ZhipuProvider", () => {
  let provider: ZhipuProvider;

  beforeEach(() => {
    provider = new ZhipuProvider();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return Zhipu", () => {
      expect(provider.getName()).toBe(zhipuInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return Zhipu API URL", () => {
      expect(provider.getBaseUrl()).toBe(zhipuInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods (inherited from OpenAI)
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "zhipu",
        name: "Zhipu",
        key: "test-key",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key", () => {
      const testProvider: TProvider = {
        type: "zhipu",
        name: "Zhipu",
        key: "test-api-key",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-api-key");
    });
  });

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("glm-4");

      expect(provider.modelKey).toBe("glm-4");
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
        url: "https://open.bigmodel.cn/api/paas/v4",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on invalid_api_key", async () => {
      mockList.mockRejectedValue({ code: "invalid_api_key" });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://open.bigmodel.cn/api/paas/v4",
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
        url: "https://open.bigmodel.cn/api/paas/v4",
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
        data: [{ id: "glm-4" }, { id: "glm-4-flash" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(2);
      expect(models.every((m) => m.provider === "zhipu")).toBe(true);
    });

    it("should use model.id as both id and name", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "glm-4-plus" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].id).toBe("glm-4-plus");
      expect(models[0].name).toBe("glm-4-plus");
    });

    it("should assign Chat | Tools capabilities to regular models", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "glm-4" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools,
      );
    });

    it("should assign Image capability to cogview models", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "cogview-3" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].capabilities).toBe(CapabilitiesUI.Image);
    });

    it("should assign Image capability to models with 'image' in id", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "some-image-model" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].capabilities).toBe(CapabilitiesUI.Image);
    });

    it("should detect cogview case-insensitively via lowercase", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "CogView-4" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].capabilities).toBe(CapabilitiesUI.Image);
    });

    it("should use custom url when provided", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "glm-4" }],
      });

      await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.endpoint.com",
      });

      // Verifies no error — client was created with custom URL
      expect(mockList).toHaveBeenCalled();
    });

    it("should use default baseUrl when url is empty", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "glm-4" }],
      });

      await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(mockList).toHaveBeenCalled();
    });

    it("should return fallback models when API call fails", async () => {
      mockList.mockRejectedValue(new Error("Network error"));

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(9);
      expect(models[0].id).toBe("glm-4");
      expect(models[models.length - 1].id).toBe("cogview-3");
      expect(models.every((m) => m.provider === "zhipu")).toBe(true);
    });

    it("should have correct capabilities in fallback models", async () => {
      mockList.mockRejectedValue(new Error("API error"));

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      const chatModels = models.filter((m) => m.id !== "cogview-3");
      const imageModels = models.filter((m) => m.id === "cogview-3");

      expect(
        chatModels.every(
          (m) => m.capabilities === (CapabilitiesUI.Chat | CapabilitiesUI.Tools),
        ),
      ).toBe(true);
      expect(
        imageModels.every(
          (m) => m.capabilities === CapabilitiesUI.Image,
        ),
      ).toBe(true);
    });

    it("should return empty array when API returns no models", async () => {
      mockList.mockResolvedValue({ data: [] });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toEqual([]);
    });

    it("should correctly map multiple models with mixed capabilities", async () => {
      mockList.mockResolvedValue({
        data: [
          { id: "glm-4" },
          { id: "cogview-3" },
          { id: "glm-4-flash" },
          { id: "image-gen-v1" },
        ],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(4);
      expect(models[0].capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools,
      );
      expect(models[1].capabilities).toBe(CapabilitiesUI.Image);
      expect(models[2].capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Tools,
      );
      expect(models[3].capabilities).toBe(CapabilitiesUI.Image);
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

    it("should have setPrevMessages from OpenAI", () => {
      expect(provider.setPrevMessages).toBeDefined();
    });

    it("should have setTools from OpenAI", () => {
      expect(provider.setTools).toBeDefined();
    });

    it("should stream messages using OpenAI client", async () => {
      const testProvider: TProvider = {
        type: "zhipu",
        name: "Zhipu",
        key: "test-key",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("glm-4");

      const events = [
        createTextChunk("Hello"),
        createTextChunk(" from Zhipu", true),
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
        type: "zhipu",
        name: "Zhipu",
        key: "test-key",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("glm-4");

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Test Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Test Title");
    });
  });
});
