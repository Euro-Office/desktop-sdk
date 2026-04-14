import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesUI } from "../../../capabilities";
import type { TProvider } from "../../../types";
import {
  createMockStreamWithIterator,
  createTextChunk,
} from "../../tests/test-utils";
import { GPT4AllProvider } from "../index";
import { gpt4allInfo } from "../info";

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

describe("GPT4AllProvider", () => {
  let provider: GPT4AllProvider;

  beforeEach(() => {
    provider = new GPT4AllProvider();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return GPT4All", () => {
      expect(provider.getName()).toBe(gpt4allInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return GPT4All local URL", () => {
      expect(provider.getBaseUrl()).toBe(gpt4allInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "gpt4all",
        name: "GPT4All",
        key: "",
        baseUrl: "http://localhost:4891/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should use default key 'gpt4all' when no key provided", () => {
      const testProvider: TProvider = {
        type: "gpt4all",
        name: "GPT4All",
        key: "",
        baseUrl: "http://localhost:4891/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("gpt4all");
    });

    it("should use custom key when provided", () => {
      const testProvider: TProvider = {
        type: "gpt4all",
        name: "GPT4All",
        key: "custom-key",
        baseUrl: "http://localhost:4891/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("custom-key");
    });

    it("should set URL when baseUrl is provided", () => {
      const testProvider: TProvider = {
        type: "gpt4all",
        name: "GPT4All",
        key: "",
        baseUrl: "http://custom:5000/v1",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe("http://custom:5000/v1");
    });

    it("should use default baseUrl when not provided", () => {
      const testProvider: TProvider = {
        type: "gpt4all",
        name: "GPT4All",
        key: "",
        baseUrl: "",
      };

      provider.setProvider(testProvider);

      // No URL override set when baseUrl is empty
      expect(provider.provider).toBe(testProvider);
    });
  });

  // ==========================================================================
  // checkProvider
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful API call", async () => {
      mockList.mockResolvedValue({ data: [] });

      const result = await provider.checkProvider({
        apiKey: "",
        url: "http://localhost:4891/v1",
      });

      expect(result).toBe(true);
    });

    it("should return invalidUrl error on connection error", async () => {
      mockList.mockRejectedValue(new Error("Connection refused"));

      const result = await provider.checkProvider({
        apiKey: "",
        url: "http://invalid:4891/v1",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });

    it("should use default baseUrl when url is empty", async () => {
      mockList.mockResolvedValue({ data: [] });

      const result = await provider.checkProvider({
        apiKey: "",
        url: "",
      });

      expect(result).toBe(true);
      expect(mockList).toHaveBeenCalled();
    });

    it("should use custom url when provided", async () => {
      mockList.mockResolvedValue({ data: [] });

      const result = await provider.checkProvider({
        apiKey: "",
        url: "http://custom:5000/v1",
      });

      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return models from API with correct provider type", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "Llama 3.2 3B Instruct" }, { id: "Phi-3 Mini" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "",
        url: "",
      });

      expect(models).toHaveLength(2);
      expect(models.every((m) => m.provider === "gpt4all")).toBe(true);
    });

    it("should use model.id as both id and name", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "Llama 3.2 3B Instruct" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "",
        url: "",
      });

      expect(models[0].id).toBe("Llama 3.2 3B Instruct");
      expect(models[0].name).toBe("Llama 3.2 3B Instruct");
    });

    it("should assign Chat | Vision | Tools capabilities to all models", async () => {
      mockList.mockResolvedValue({
        data: [{ id: "Llama 3.2 3B Instruct" }],
      });

      const models = await provider.getProviderModels({
        apiKey: "",
        url: "",
      });

      expect(models[0].capabilities).toBe(
        CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools,
      );
    });

    it("should return empty array on API error", async () => {
      mockList.mockRejectedValue(new Error("Connection refused"));

      const models = await provider.getProviderModels({
        apiKey: "",
        url: "",
      });

      expect(models).toEqual([]);
    });

    it("should use custom url when provided", async () => {
      mockList.mockResolvedValue({ data: [{ id: "model-1" }] });

      await provider.getProviderModels({
        apiKey: "",
        url: "http://custom:5000/v1",
      });

      expect(mockList).toHaveBeenCalled();
    });

    it("should use default baseUrl when url is empty", async () => {
      mockList.mockResolvedValue({ data: [{ id: "model-1" }] });

      await provider.getProviderModels({
        apiKey: "",
        url: "",
      });

      expect(mockList).toHaveBeenCalled();
    });

    it("should return empty array when API returns no models", async () => {
      mockList.mockResolvedValue({ data: [] });

      const models = await provider.getProviderModels({
        apiKey: "",
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
        type: "gpt4all",
        name: "GPT4All",
        key: "",
        baseUrl: "http://localhost:4891/v1",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("Llama 3.2 3B Instruct");

      const events = [
        createTextChunk("Hello"),
        createTextChunk(" from GPT4All", true),
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
