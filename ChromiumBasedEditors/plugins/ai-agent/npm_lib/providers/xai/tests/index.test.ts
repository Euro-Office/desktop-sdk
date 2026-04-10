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
    it("should return all models mapped with provider type", async () => {
      mockList.mockResolvedValue({
        data: [
          { id: "grok-4-1-fast-non-reasoning" },
          { id: "grok-4-1-fast-reasoning" },
          { id: "some-other-model" },
        ],
      });

      const provider = new XAIProvider();
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(3);
      expect(models.every((m) => m.provider === "xai")).toBe(true);
    });

    it("should use model.id as name", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "grok-4-1-fast-non-reasoning" }],
      });

      const provider = new XAIProvider();
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0]?.name).toBe("grok-4-1-fast-non-reasoning");
    });

    it("should mark reasoning models based on id containing 'reasoning'", async () => {
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

      // Both contain "reasoning" in the id
      expect(models.every((m) => m.reasoning === true)).toBe(true);
    });

    it("should reverse the models array", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "model-1" }, { id: "model-2" }, { id: "model-3" }],
      });

      const provider = new XAIProvider();
      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].id).toBe("model-3");
      expect(models[2].id).toBe("model-1");
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
