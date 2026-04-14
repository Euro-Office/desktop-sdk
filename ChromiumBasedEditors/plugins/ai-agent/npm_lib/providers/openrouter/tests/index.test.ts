import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRouterProvider } from "../index";
import { openrouterInfo } from "../info";

// Mock fetch for checkProvider tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Use vi.hoisted to ensure mocks are available when vi.mock is hoisted
const { modelsListMock, chatCreateMock } = vi.hoisted(() => ({
  modelsListMock: vi.fn(),
  chatCreateMock: vi.fn(),
}));

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: chatCreateMock } };
      models = { list: modelsListMock };
    },
  };
});

describe("OpenRouterProvider", () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    provider = new OpenRouterProvider();
    vi.clearAllMocks();
    mockFetch.mockReset();
    modelsListMock.mockReset();
    chatCreateMock.mockReset();
  });

  // ==========================================================================
  // Provider Info (overridden from OpenAI)
  // ==========================================================================

  describe("getName", () => {
    it("should return OpenRouter name", () => {
      expect(provider.getName()).toBe(openrouterInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return OpenRouter base URL", () => {
      expect(provider.getBaseUrl()).toBe(openrouterInfo.baseUrl);
    });
  });

  // ==========================================================================
  // checkProvider (uses fetch, not SDK)
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful API call", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await provider.checkProvider({
        apiKey: "valid-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/models/user",
        expect.objectContaining({
          headers: { Authorization: "Bearer valid-key" },
        })
      );
    });

    it("should return emptyKey error when no API key provided", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 400 });

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toEqual({
        field: "key",
        message: "Empty key",
      });
    });

    it("should return invalidKey error on 401", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return invalidUrl error on other errors", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      const result = await provider.checkProvider({
        apiKey: "valid-key",
        url: "https://invalid.url",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });

    it("should return connectionFailed on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await provider.checkProvider({
        apiKey: "valid-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });
  });

  // ==========================================================================
  // getProviderModels (different filters from OpenAI)
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return all models mapped with openrouter provider", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "openai/gpt-5.1" },
            { id: "anthropic/claude-sonnet-4.5" },
            { id: "unknown-model" },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toHaveLength(3);
      expect(result.every((m) => m.provider === "openrouter")).toBe(true);
      expect(result.map((m) => m.id)).toContain("unknown-model");
    });

    it("should use model.id as name", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "openai/gpt-5.2" }],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("openai/gpt-5.2");
      expect(result[0].name).toBe("openai/gpt-5.2");
    });

    it("should mark reasoning models", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "openai/gpt-5.2" },
            { id: "anthropic/claude-haiku-4.5" },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toHaveLength(2);
      const reasoning = result.find((m) => m.id === "openai/gpt-5.2");
      const nonReasoning = result.find(
        (m) => m.id === "anthropic/claude-haiku-4.5"
      );
      expect(reasoning?.reasoning).toBe(true);
      expect(nonReasoning?.reasoning).toBe(false);
    });

    it("should default to Chat for models with no modality", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "some-model" }],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities).toBe(0x01); // Chat
    });

    it("should default to Chat for empty modality string", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "model-1",
              architecture: { modality: "" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities).toBe(0x01); // Chat
    });

    it("should detect text->text as Chat", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "chat-model",
              architecture: { modality: "text->text" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities).toBe(0x01); // Chat
    });

    it("should detect text+image->text as Chat+Vision", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "vision-model",
              architecture: { modality: "text+image->text" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities & 0x01).toBeTruthy(); // Chat
      expect(result[0].capabilities & 0x80).toBeTruthy(); // Vision
    });

    it("should detect text+audio->text as Chat+Audio", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "audio-model",
              architecture: { modality: "text+audio->text" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities & 0x01).toBeTruthy(); // Chat
      expect(result[0].capabilities & 0x08).toBeTruthy(); // Audio
    });

    it("should detect embedding modality as Embeddings", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "embed-model",
              architecture: { modality: "text->embedding" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities).toBe(0x04); // Embeddings
    });

    it("should detect image->image as Image", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "image-edit-model",
              architecture: { modality: "image->image" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities & 0x02).toBeTruthy(); // Image
    });

    it("should detect image->text as Chat+Vision (image-only input)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "image-to-text",
              architecture: { modality: "image->text" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities & 0x01).toBeTruthy(); // Chat
      expect(result[0].capabilities & 0x80).toBeTruthy(); // Vision
    });

    it("should detect audio->text as Chat+Audio (audio-only input)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "audio-to-text",
              architecture: { modality: "audio->text" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities & 0x01).toBeTruthy(); // Chat
      expect(result[0].capabilities & 0x08).toBeTruthy(); // Audio
    });

    it("should detect embedding in input as Embeddings", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "embed-model",
              architecture: { modality: "embedding->text" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities).toBe(0x04); // Embeddings
    });

    it("should handle modality without arrow separator", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "no-arrow",
              architecture: { modality: "text" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      // output is undefined, so modOut is [], falls through to Chat
      expect(result[0].capabilities).toBe(0x01); // Chat
    });

    it("should fallback to Chat for unknown modality patterns", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "unknown-modality",
              architecture: { modality: "something->something" },
            },
          ],
        }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result[0].capabilities).toBe(0x01); // Chat fallback
    });

    it("should use default URL when not provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/models",
        expect.any(Object),
      );
    });

    it("should not include auth header when no apiKey", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await provider.getProviderModels({
        apiKey: "",
        url: "https://openrouter.ai/api/v1",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: {} }),
      );
    });

    it("should handle response without data field", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toEqual([]);
    });

    it("should return empty array when response has no models", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Inheritance from OpenAI (verify methods exist)
  // ==========================================================================

  describe("inherited methods", () => {
    it("should have setProvider from OpenAI", () => {
      expect(provider.setProvider).toBeDefined();
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
  });
});
