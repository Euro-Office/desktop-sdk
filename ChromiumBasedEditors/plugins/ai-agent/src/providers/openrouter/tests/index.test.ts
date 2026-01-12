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
    it("should return filtered models with openrouter provider", async () => {
      modelsListMock.mockResolvedValue({
        data: [
          { id: "openai/gpt-5.1" },
          { id: "anthropic/claude-sonnet-4.5" },
          { id: "unknown-model" },
        ],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result.every((m) => m.provider === "openrouter")).toBe(true);
      expect(result.map((m) => m.id)).not.toContain("unknown-model");
    });

    it("should use modelNames mapping for display names", async () => {
      modelsListMock.mockResolvedValue({
        data: [{ id: "openai/gpt-5.2" }],
      });

      const result = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://openrouter.ai/api/v1",
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("openai/gpt-5.2-thinking"); // Reasoning model gets -thinking suffix
      expect(result[0].name).toBe(openrouterInfo.modelNames["openai/gpt-5.2"]);
    });

    it("should return empty array when no models match filters", async () => {
      modelsListMock.mockResolvedValue({
        data: [{ id: "unknown-model-1" }, { id: "unknown-model-2" }],
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
