import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "@/lib/types";
import { DeepSeekProvider } from "../index";
import { deepseekInfo } from "../info";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock OpenAI client
const mockCreate = vi.fn();
const mockList = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    models = { list: mockList };
  },
}));

// Mock window.AscSimpleRequest
const mockCreateRequest = vi.fn();

beforeEach(() => {
  mockList.mockReset();
  mockList.mockResolvedValue({ data: [] });
  mockCreateRequest.mockReset();
  mockCreate.mockReset();

  // Setup window.AscSimpleRequest mock
  (globalThis as unknown as { window: unknown }).window = {
    AscSimpleRequest: {
      createRequest: mockCreateRequest,
    },
  };
});

/**
 * Creates a mock async iterator stream for OpenAI responses.
 */
const createMockStream = (
  events: Array<{
    choices: Array<{
      delta: { content?: string; tool_calls?: unknown[] };
      finish_reason?: string | null;
    }>;
  }>
) => {
  async function* generator() {
    for (const event of events) {
      yield event;
    }
  }
  return {
    [Symbol.asyncIterator]: generator,
    controller: { abort: vi.fn() },
  };
};

const createTextChunk = (content: string, finished = false) => ({
  choices: [
    {
      delta: { content },
      finish_reason: finished ? "stop" : null,
    },
  ],
});

describe("DeepSeekProvider", () => {
  let provider: DeepSeekProvider;

  beforeEach(() => {
    provider = new DeepSeekProvider();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return DeepSeek", () => {
      expect(provider.getName()).toBe(deepseekInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return DeepSeek API URL", () => {
      expect(provider.getBaseUrl()).toBe(deepseekInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods (inherited from OpenAI)
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key", () => {
      const testProvider: TProvider = {
        type: "deepseek",
        name: "DeepSeek",
        key: "test-api-key",
        baseUrl: "https://api.deepseek.com",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-api-key");
    });
  });

  describe("setModelKey", () => {
    it("should set model key", () => {
      provider.setModelKey("deepseek-chat");

      expect(provider.modelKey).toBe("deepseek-chat");
    });
  });

  describe("setSystemPrompt", () => {
    it("should set system prompt", () => {
      provider.setSystemPrompt("You are a helpful assistant");

      expect(provider.systemPrompt).toBe("You are a helpful assistant");
    });
  });

  // ==========================================================================
  // checkProvider
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful API call", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseStatus: number }) => void }) => {
          opts.complete({ responseStatus: 200 });
        }
      );

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://api.deepseek.com",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey error on 401", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseStatus: number }) => void }) => {
          opts.complete({ responseStatus: 401 });
        }
      );

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://api.deepseek.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return emptyKey error when no API key provided", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseStatus: number }) => void }) => {
          opts.complete({ responseStatus: 400 });
        }
      );

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://api.deepseek.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return invalidUrl error on network error", async () => {
      mockCreateRequest.mockImplementation((opts: { error: () => void }) => {
        opts.error();
      });

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://invalid-url.com",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });

    it("should use default base URL when url not provided", async () => {
      mockCreateRequest.mockImplementation(
        (opts: {
          url: string;
          complete: (e: { responseStatus: number }) => void;
        }) => {
          expect(opts.url).toBe(`${deepseekInfo.baseUrl}/models`);
          opts.complete({ responseStatus: 200 });
        }
      );

      await provider.checkProvider({
        apiKey: "test-key",
        url: "",
      });
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return models matching filter", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseText: string }) => void }) => {
          opts.complete({
            responseText: JSON.stringify({
              data: [
                { id: "deepseek-chat", name: "DeepSeek Chat" },
                { id: "deepseek-coder", name: "DeepSeek Coder" },
                { id: "other-model", name: "Other" },
              ],
            }),
          });
        }
      );

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      // Should only include models in modelFilters
      const filteredModels = models.filter((m) =>
        deepseekInfo.modelFilters.includes(m.id)
      );
      expect(filteredModels.length).toBe(models.length);
    });

    it("should return all models when filter is empty", async () => {
      // Temporarily store original filter
      const originalFilters = [...deepseekInfo.modelFilters];
      deepseekInfo.modelFilters.length = 0;

      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseText: string }) => void }) => {
          opts.complete({
            responseText: JSON.stringify({
              data: [
                { id: "deepseek-chat", name: "DeepSeek Chat" },
                { id: "deepseek-coder", name: "DeepSeek Coder" },
              ],
            }),
          });
        }
      );

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models).toHaveLength(2);

      // Restore original filter
      deepseekInfo.modelFilters.push(...originalFilters);
    });

    it("should set provider type to deepseek", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseText: string }) => void }) => {
          opts.complete({
            responseText: JSON.stringify({
              data: [{ id: "deepseek-chat", name: "DeepSeek Chat" }],
            }),
          });
        }
      );

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0]?.provider).toBe("deepseek");
    });

    it("should use custom URL when provided", async () => {
      mockCreateRequest.mockImplementation(
        (opts: {
          url: string;
          complete: (e: { responseText: string }) => void;
        }) => {
          opts.complete({
            responseText: JSON.stringify({ data: [] }),
          });
        }
      );

      await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://custom.deepseek.com",
      });

      expect(mockCreateRequest).toHaveBeenCalled();
      expect(mockCreateRequest.mock.calls[0][0].url).toBe(
        "https://custom.deepseek.com/models"
      );
    });

    it("should use modelNames mapping when available", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseText: string }) => void }) => {
          opts.complete({
            responseText: JSON.stringify({
              data: [{ id: "deepseek-chat", name: "DeepSeek Chat" }],
            }),
          });
        }
      );

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      // Should use mapped name if exists, otherwise use model.id
      if (deepseekInfo.modelNames["deepseek-chat"]) {
        expect(models[0].name).toBe(deepseekInfo.modelNames["deepseek-chat"]);
      } else {
        expect(models[0].name).toBe("deepseek-chat");
      }
    });

    it("should reverse the models array", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { complete: (e: { responseText: string }) => void }) => {
          opts.complete({
            responseText: JSON.stringify({
              data: [
                { id: "model-1", name: "Model 1" },
                { id: "model-2", name: "Model 2" },
                { id: "model-3", name: "Model 3" },
              ],
            }),
          });
        }
      );

      // Temporarily clear filters to get all models
      const originalFilters = [...deepseekInfo.modelFilters];
      deepseekInfo.modelFilters.length = 0;

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "",
      });

      expect(models[0].id).toBe("model-3");
      expect(models[2].id).toBe("model-1");

      // Restore filters
      deepseekInfo.modelFilters.push(...originalFilters);
    });

    it("should handle error responses", async () => {
      mockCreateRequest.mockImplementation(
        (opts: { error: (e: Error) => void }) => {
          opts.error(new Error("Network error"));
        }
      );

      await expect(
        provider.getProviderModels({
          apiKey: "test-key",
          url: "",
        })
      ).rejects.toThrow("Network error");
    });
  });

  // ==========================================================================
  // Inherited Methods (verify they work)
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
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("deepseek-chat");

      const events = [
        createTextChunk("Hello"),
        createTextChunk(" from DeepSeek", true),
      ];

      mockCreate.mockResolvedValue(createMockStream(events));

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
        type: "deepseek",
        name: "DeepSeek",
        key: "test-key",
        baseUrl: "https://api.deepseek.com",
      };
      provider.setProvider(testProvider);
      provider.setModelKey("deepseek-chat");

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Test Title" } }],
      });

      const result = await provider.createChatName("test message");

      expect(result).toBe("Test Title");
    });
  });
});
