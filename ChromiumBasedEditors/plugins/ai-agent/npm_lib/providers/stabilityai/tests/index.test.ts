import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../capabilities";
import type { TProvider } from "../../../types";
import { StabilityAIProvider } from "../index";
import { stabilityaiInfo } from "../info";

// =============================================================================
// Mock Setup
// =============================================================================

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("StabilityAIProvider", () => {
  let provider: StabilityAIProvider;

  beforeEach(() => {
    provider = new StabilityAIProvider();
    mockFetch.mockReset();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return Stability AI", () => {
      expect(provider.getName()).toBe(stabilityaiInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return Stability AI API URL", () => {
      expect(provider.getBaseUrl()).toBe(stabilityaiInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and API key", () => {
      const testProvider: TProvider = {
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      };

      provider.setProvider(testProvider);

      expect(provider.provider).toBe(testProvider);
      expect(provider.apiKey).toBe("test-key");
    });

    it("should set URL", () => {
      const testProvider: TProvider = {
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://custom.stability.ai",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe("https://custom.stability.ai");
    });
  });

  describe("setPrevMessages", () => {
    it("should be no-op", () => {
      expect(() => provider.setPrevMessages([])).not.toThrow();
    });
  });

  describe("setTools", () => {
    it("should be no-op", () => {
      expect(() => provider.setTools([])).not.toThrow();
    });
  });

  describe("createChatName", () => {
    it("should return empty string", async () => {
      const result = await provider.createChatName("test");
      expect(result).toBe("");
    });
  });

  describe("isSupportStreaming", () => {
    it("should return false", () => {
      expect(provider.isSupportStreaming()).toBe(false);
    });
  });

  // ==========================================================================
  // sendMessage / sendMessageAfterToolCall (not supported)
  // ==========================================================================

  describe("sendMessage", () => {
    it("should throw error", async () => {
      const gen = provider.sendMessage([{ role: "user", content: "Hi" }]);

      await expect(gen.next()).rejects.toThrow(
        "Stability AI does not support chat",
      );
    });
  });

  describe("sendMessageAfterToolCall", () => {
    it("should throw error", async () => {
      const gen = provider.sendMessageAfterToolCall({
        role: "assistant",
        content: [],
      });

      await expect(gen.next()).rejects.toThrow(
        "Stability AI does not support chat",
      );
    });
  });

  // ==========================================================================
  // imageGeneration
  // ==========================================================================

  describe("imageGeneration", () => {
    it("should call fetch with correct URL for core model", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "base64data" }),
      });

      const result = await provider.imageGeneration({ prompt: "a cat" });

      expect(result).toBe("base64data");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should use sd3 model endpoint", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("sd3");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "base64data" }),
      });

      await provider.imageGeneration({ prompt: "a dog" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stability.ai/v2beta/stable-image/generate/sd3",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should fallback to core model for unknown modelKey", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("unknown-model");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "base64data" }),
      });

      await provider.imageGeneration({ prompt: "test" });

      // Fallback is models[1] which is "core"
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should use default modelKey when none set", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      // modelKey defaults to "" which is falsy, so modelId = "core"

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "base64data" }),
      });

      await provider.imageGeneration({ prompt: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should return artifacts base64 when available", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          artifacts: [{ base64: "artifact-base64" }],
        }),
      });

      const result = await provider.imageGeneration({ prompt: "test" });

      expect(result).toBe("artifact-base64");
    });

    it("should return image field when no artifacts", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "image-base64" }),
      });

      const result = await provider.imageGeneration({ prompt: "test" });

      expect(result).toBe("image-base64");
    });

    it("should return empty string when no image data", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await provider.imageGeneration({ prompt: "test" });

      expect(result).toBe("");
    });

    it("should throw on non-ok response", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        provider.imageGeneration({ prompt: "test" }),
      ).rejects.toThrow("Stability AI error: 500 Internal Server Error");
    });

    it("should use default baseUrl when url is not set", async () => {
      provider.apiKey = "test-key";
      provider.url = undefined;
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "data" }),
      });

      await provider.imageGeneration({ prompt: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        expect.any(Object),
      );
    });

    it("should use custom URL when url is set", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "test-key",
        baseUrl: "https://custom.stability.ai",
      });
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "data" }),
      });

      await provider.imageGeneration({ prompt: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom.stability.ai/v2beta/stable-image/generate/core",
        expect.any(Object),
      );
    });

    it("should include Authorization header", async () => {
      provider.setProvider({
        type: "stabilityai",
        name: "Stability AI",
        key: "my-api-key",
        baseUrl: "https://api.stability.ai",
      });
      provider.setModelKey("core");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ image: "data" }),
      });

      await provider.imageGeneration({ prompt: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-api-key",
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // checkProvider
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful API call", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://api.stability.ai",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey on 401 status", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://api.stability.ai",
      });

      expect(result).toEqual({
        field: "key",
        message: "Invalid API key",
      });
    });

    it("should return true on non-401 errors (like 400)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://api.stability.ai",
      });

      // The status check only catches 401; otherwise returns true
      expect(result).toBe(true);
    });

    it("should return error on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://api.stability.ai",
      });

      expect(result).toEqual(
        expect.objectContaining({
          field: expect.any(String),
          message: expect.any(String),
        }),
      );
    });

    it("should return error on network failure with no API key", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://api.stability.ai",
      });

      expect(result).toEqual(
        expect.objectContaining({
          field: expect.any(String),
          message: expect.any(String),
        }),
      );
    });

    it("should use default baseUrl when url is empty", async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      await provider.checkProvider({
        apiKey: "test-key",
        url: "",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        expect.any(Object),
      );
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return static model list", async () => {
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(3);
      expect(models.every((m) => m.provider === "stabilityai")).toBe(true);
      expect(models.every((m) => m.capabilities === CapabilitiesUI.Image)).toBe(
        true,
      );
    });

    it("should include all expected models", async () => {
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      const ids = models.map((m) => m.id);
      expect(ids).toContain("sd3");
      expect(ids).toContain("core");
      expect(ids).toContain("ultra");
    });

    it("should use model name from info", async () => {
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      const sd3 = models.find((m) => m.id === "sd3");
      expect(sd3?.name).toBe("Stable Diffusion 3");
    });
  });
});
