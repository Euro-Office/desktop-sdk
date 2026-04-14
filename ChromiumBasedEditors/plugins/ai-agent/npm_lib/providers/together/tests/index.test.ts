import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "../../../types";
import { TogetherProvider } from "../index";
import { togetherInfo } from "../info";

// =============================================================================
// Mock Setup
// =============================================================================

const mockCreate = vi.fn();
const mockList = vi.fn();

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

// Mock fetch for getProviderModels
global.fetch = vi.fn();

describe("TogetherProvider", () => {
  let provider: TogetherProvider;

  beforeEach(() => {
    provider = new TogetherProvider();
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockList.mockReset();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return Together name", () => {
      expect(provider.getName()).toBe(togetherInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return Together base URL", () => {
      expect(provider.getBaseUrl()).toBe(togetherInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods (inherited from OpenAI)
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "together",
        name: "Together",
        key: "test-key",
        baseUrl: "https://api.together.xyz/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key", () => {
      const testProvider: TProvider = {
        type: "together",
        name: "Together",
        key: "test-api-key",
        baseUrl: "https://api.together.xyz/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-api-key");
    });
  });

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo");

      expect(provider.modelKey).toBe(
        "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
      );
    });
  });

  describe("setSystemPrompt", () => {
    it("should set system prompt", () => {
      provider.setSystemPrompt("You are a helpful assistant");

      expect(provider.systemPrompt).toBe("You are a helpful assistant");
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return all models mapped with provider type", async () => {
      const mockResponse = [
        { id: "deepseek-ai/DeepSeek-V3.1" },
        { id: "unknown-model" },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.provider === "together")).toBe(true);
      expect(result.map((m) => m.id)).toContain("unknown-model");
    });

    it("should use model.id as name", async () => {
      const mockResponse = [{ id: "deepseek-ai/DeepSeek-V3.1" }];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].name).toBe("deepseek-ai/DeepSeek-V3.1");
    });

    it("should assign Chat capability to chat type models", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [{ id: "model-chat", type: "chat" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].capabilities & 0x01).toBeTruthy(); // Chat
    });

    it("should add Vision for chat models with 'vision' in id", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "llama-3.2-90b-vision-instruct", type: "chat" },
        ],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].capabilities & 0x80).toBeTruthy(); // Vision
    });

    it("should assign Image capability to image type models", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [{ id: "flux-1-dev", type: "image" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].capabilities).toBe(0x02); // Image
    });

    it("should assign Embeddings capability to embedding type models", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [{ id: "m2-bert-embed", type: "embedding" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].capabilities).toBe(0x04); // Embeddings
    });

    it("should assign Chat capability to code type models", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [{ id: "codellama-13b", type: "code" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].capabilities).toBe(0x01); // Chat
    });

    it("should assign None capability to rerank type models", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [{ id: "rerank-model", type: "rerank" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].capabilities).toBe(0x00); // None
    });

    it("should default to Chat for models with no type", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => [{ id: "unknown-model" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(result[0].capabilities).toBe(0x01); // Chat
    });

    it("should handle fetch errors by throwing", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error")
      );

      await expect(
        provider.getProviderModels({
          apiKey: "test-key",
          url: "https://api.together.xyz/v1",
        })
      ).rejects.toThrow("Network error");
    });

    it("should call fetch with correct parameters", async () => {
      const mockResponse: unknown[] = [];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://api.together.xyz/v1",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.together.xyz/v1/models",
        {
          headers: {
            Authorization: "Bearer test-key",
          },
        }
      );
    });
  });

  // ==========================================================================
  // Inheritance from OpenAI (verify methods exist)
  // ==========================================================================

  describe("inherited methods", () => {
    it("should have checkProvider from OpenAI", () => {
      expect(provider.checkProvider).toBeDefined();
    });

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
  });
});
