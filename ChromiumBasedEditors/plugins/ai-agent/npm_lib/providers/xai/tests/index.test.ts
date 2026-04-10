import { beforeEach, describe, expect, it, vi } from "vitest";
import { XAIProvider } from "../index";
import { xaiInfo } from "../info";

// Mock OpenAI client
const mockList = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
    models = { list: mockList };
  },
}));

beforeEach(() => {
  mockList.mockReset();
  mockList.mockResolvedValue({ data: [] });
});

describe("XAIProvider", () => {
  describe("getName", () => {
    it("should return xAI", () => {
      const provider = new XAIProvider();
      expect(provider.getName()).toBe("xAI");
    });
  });

  describe("getBaseUrl", () => {
    it("should return xAI API URL", () => {
      const provider = new XAIProvider();
      expect(provider.getBaseUrl()).toBe("https://api.x.ai/v1");
    });
  });

  describe("getProviderModels", () => {
    it("should return models matching filter", async () => {
      mockList.mockResolvedValue({
        data: [
          { id: "grok-4-1-fast-non-reasoning" },
          { id: "grok-4-1-fast-reasoning" },
        ],
      });

      const provider = new XAIProvider();
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      // Should only include models in modelFilters
      expect(models).toHaveLength(2);
      expect(models.map((m) => m.id)).toEqual(
        expect.arrayContaining([
          "grok-4-1-fast-non-reasoning",
          "grok-4-1-fast-reasoning",
        ])
      );
    });

    it("should return all models when filter is empty", async () => {
      // Temporarily store original filter
      const originalFilters = [...xaiInfo.modelFilters];
      xaiInfo.modelFilters.length = 0;

      mockList.mockResolvedValue({
        data: [
          { id: "grok-4-1-fast-non-reasoning" },
          { id: "grok-3" },
          { id: "some-other-model" },
        ],
      });

      const provider = new XAIProvider();
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(3);

      // Restore original filter
      xaiInfo.modelFilters.push(...originalFilters);
    });

    it("should set provider type to xai", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "grok-4-1-fast-non-reasoning" }],
      });

      const provider = new XAIProvider();
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0]?.provider).toBe("xai");
    });

    // it("should use model id as name", async () => {
    //   mockList.mockResolvedValue({
    //     data: [{ id: "grok-4-1-fast-non-reasoning" }],
    //   });

    //   const provider = new XAIProvider();
    //   const models = await provider.getProviderModels({
    //     apiKey: "test-key",
    //     url: "",
    //   });

    //   expect(models[0]?.name).toBe("grok-4-1-fast-non-reasoning");
    // });

    it("should return empty array on error", async () => {
      mockList.mockRejectedValue(new Error("API error"));

      const provider = new XAIProvider();
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toEqual([]);
    });

    it("should use custom URL when provided", async () => {
      mockList.mockResolvedValue({ data: [] });

      const provider = new XAIProvider();
      await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.x.ai/v1",
      });

      expect(mockList).toHaveBeenCalled();
    });
  });

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const provider = new XAIProvider();
      provider.setProvider({
        type: "xai",
        name: "xAI",
        key: "test-key",
        baseUrl: "https://api.x.ai/v1",
      });

      expect(provider.getName()).toBe("xAI");
    });
  });
});
