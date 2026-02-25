import type { ThreadMessageLike } from "@assistant-ui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Model, TProvider } from "@/lib/types";
import { provider } from "../index";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

// Create mock provider instance
const createMockProvider = () => ({
  setProvider: vi.fn(),
  setSystemPrompt: vi.fn(),
  setModelKey: vi.fn(),
  setTools: vi.fn(),
  setPrevMessages: vi.fn(),
  stopMessage: vi.fn(),
  getName: vi.fn(() => "OpenAI"),
  getBaseUrl: vi.fn(() => "https://api.openai.com/v1"),
  checkProvider: vi.fn(async () => true),
  getProviderModels: vi.fn(async () => [
    { id: "gpt-4", name: "GPT-4", provider: "openai" },
  ]),
  sendMessage: vi.fn(async function* () {
    yield { role: "assistant", content: "Test response" };
  }),
  sendMessageAfterToolCall: vi.fn(async function* () {
    yield { role: "assistant", content: "After tool call" };
  }),
  createChatName: vi.fn(async () => "Test Chat"),
  modelKey: "gpt-4",
});

// Mock provider registry
vi.mock("../registry", () => ({
  getProvider: vi.fn((type: string) => {
    if (type === "openai") {
      return createMockProvider();
    }
    return undefined;
  }),
  getSupportedProviderTypes: vi.fn(() => ["openai", "anthropic", "ollama"]),
  providerRegistry: {
    openai: {
      getName: () => "OpenAI",
      getBaseUrl: () => "https://api.openai.com/v1",
      getProviderModels: vi.fn(async () => [
        { id: "gpt-4", name: "GPT-4", provider: "openai" },
      ]),
    },
    anthropic: {
      getName: () => "Anthropic",
      getBaseUrl: () => "https://api.anthropic.com",
      getProviderModels: vi.fn(async () => [
        { id: "claude-3", name: "Claude 3", provider: "anthropic" },
      ]),
    },
    ollama: {
      getName: () => "Ollama",
      getBaseUrl: () => "http://localhost:11434/v1",
      getProviderModels: vi.fn(async () => []),
    },
  },
}));

describe("Provider", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    provider.setCurrentProvider(undefined);
  });

  // ==========================================================================
  // setCurrentProvider
  // ==========================================================================

  describe("setCurrentProvider", () => {
    it("should clear provider when called with undefined", () => {
      provider.setCurrentProvider(undefined);

      expect(provider.currentProvider).toBeUndefined();
      expect(provider.currentProviderInfo).toBeUndefined();
      expect(provider.currentProviderType).toBeUndefined();
    });

    it("should set provider info and instance", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      expect(provider.currentProviderInfo).toBe(testProvider);
      expect(provider.currentProvider).toBeDefined();
      expect(provider.currentProviderType).toBe("openai");
    });

    it("should call setProvider on provider instance", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      expect(provider.currentProvider?.setProvider).toHaveBeenCalledWith(
        testProvider
      );
    });

    it("should set system prompt on provider", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      expect(provider.currentProvider?.setSystemPrompt).toHaveBeenCalled();
    });

    it("should restore model from localStorage", () => {
      const savedModel: Model = {
        id: "gpt-4",
        name: "GPT-4",
        provider: "openai",
      };

      // Store in localStorage before setting provider
      const modelString = JSON.stringify(savedModel);
      localStorageMock.getItem.mockReturnValueOnce(modelString);

      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      // Check that localStorage.getItem was called
      expect(localStorageMock.getItem).toHaveBeenCalledWith("current-model");
      // Check that setModelKey was called with the stored model id
      expect(provider.currentProvider?.setModelKey).toHaveBeenCalledWith(
        "gpt-4"
      );
    });

    it("should handle invalid provider type gracefully", () => {
      const testProvider: TProvider = {
        type: "invalid" as unknown as TProvider["type"],
        name: "Invalid",
        key: "key",
        baseUrl: "url",
      };

      provider.setCurrentProvider(testProvider);

      expect(provider.currentProviderType).toBeUndefined();
    });
  });

  // ==========================================================================
  // setCurrentProviderModel
  // ==========================================================================

  describe("setCurrentProviderModel", () => {
    it("should set model key on current provider", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);
      provider.setCurrentProviderModel("gpt-4");

      expect(provider.currentProvider?.setModelKey).toHaveBeenCalledWith(
        "gpt-4"
      );
    });

    it("should do nothing when no current provider", () => {
      provider.setCurrentProvider(undefined);
      expect(() => provider.setCurrentProviderModel("gpt-4")).not.toThrow();
    });
  });

  // ==========================================================================
  // setCurrentProviderTools
  // ==========================================================================

  describe("setCurrentProviderTools", () => {
    it("should set tools on current provider", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      const tools = [
        { name: "test_tool", description: "Test", inputSchema: {} },
      ];

      provider.setCurrentProvider(testProvider);
      provider.setCurrentProviderTools(tools);

      expect(provider.currentProvider?.setTools).toHaveBeenCalledWith(tools);
    });

    it("should do nothing when no current provider", () => {
      provider.setCurrentProvider(undefined);
      const tools = [
        { name: "test_tool", description: "Test", inputSchema: {} },
      ];
      expect(() => provider.setCurrentProviderTools(tools)).not.toThrow();
    });
  });

  // ==========================================================================
  // setCurrentProviderPrevMessages
  // ==========================================================================

  describe("setCurrentProviderPrevMessages", () => {
    it("should set previous messages on current provider", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      const messages: ThreadMessageLike[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];

      provider.setCurrentProvider(testProvider);
      provider.setCurrentProviderPrevMessages(messages);

      expect(provider.currentProvider?.setPrevMessages).toHaveBeenCalledWith(
        messages
      );
    });

    it("should do nothing when no current provider", () => {
      provider.setCurrentProvider(undefined);
      const messages: ThreadMessageLike[] = [
        { role: "user", content: "Hello" },
      ];
      expect(() =>
        provider.setCurrentProviderPrevMessages(messages)
      ).not.toThrow();
    });
  });

  // ==========================================================================
  // getCurrentProviderModel
  // ==========================================================================

  describe("getCurrentProviderModel", () => {
    it("should return current model key", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      const modelKey = provider.getCurrentProviderModel();
      expect(modelKey).toBe("gpt-4");
    });

    it("should return undefined when no current provider", () => {
      provider.setCurrentProvider(undefined);

      const modelKey = provider.getCurrentProviderModel();
      expect(modelKey).toBeUndefined();
    });
  });

  // ==========================================================================
  // createChatName
  // ==========================================================================

  describe("createChatName", () => {
    it("should create chat name using current provider", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      const name = await provider.createChatName("Hello world");
      expect(name).toBe("Test Chat");
    });

    it("should return empty string when no current provider", async () => {
      provider.setCurrentProvider(undefined);

      const name = await provider.createChatName("Hello world");
      expect(name).toBe("");
    });

    it("should handle titles with thinking tags", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      // Mock createChatName to return thinking tag
      if (provider.currentProvider) {
        vi.mocked(provider.currentProvider.createChatName).mockResolvedValue(
          "<think>Thinking...</think>Final Title"
        );
      }

      const name = await provider.createChatName("Test message");
      expect(name).toBe("Final Title");
    });

    it("should truncate long titles to 128 characters", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      const longTitle = "a".repeat(200);
      if (provider.currentProvider) {
        vi.mocked(provider.currentProvider.createChatName).mockResolvedValue(
          longTitle
        );
      }

      const name = await provider.createChatName("Test message");
      expect(name.length).toBe(128);
    });
  });

  // ==========================================================================
  // sendMessage
  // ==========================================================================

  describe("sendMessage", () => {
    it("should send message using current provider", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      const messages: ThreadMessageLike[] = [
        { role: "user", content: "Hello" },
      ];

      const generator = provider.sendMessage(messages);
      expect(generator).toBeDefined();

      if (generator) {
        const result = await generator.next();
        expect(result.done).toBe(false);
      }
    });

    it("should return undefined when no current provider", () => {
      provider.setCurrentProvider(undefined);

      const messages: ThreadMessageLike[] = [
        { role: "user", content: "Hello" },
      ];

      const generator = provider.sendMessage(messages);
      expect(generator).toBeUndefined();
    });

    it("should pass withThinking parameter", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      const messages: ThreadMessageLike[] = [
        { role: "user", content: "Hello" },
      ];

      provider.sendMessage(messages, true);

      expect(provider.currentProvider?.sendMessage).toHaveBeenCalledWith(
        messages,
        false,
        undefined,
        true
      );
    });
  });

  // ==========================================================================
  // sendMessageAfterToolCall
  // ==========================================================================

  describe("sendMessageAfterToolCall", () => {
    it("should send message after tool call", async () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      const message: ThreadMessageLike = {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call_123",
            toolName: "test_tool",
            args: {},
            result: "result",
          },
        ],
      };

      const generator = provider.sendMessageAfterToolCall(message);
      expect(generator).toBeDefined();
    });

    it("should return undefined when no current provider", () => {
      provider.setCurrentProvider(undefined);

      const message: ThreadMessageLike = {
        role: "assistant",
        content: "test",
      };

      const generator = provider.sendMessageAfterToolCall(message);
      expect(generator).toBeUndefined();
    });

    it("should pass withThinking parameter", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);

      const message: ThreadMessageLike = {
        role: "assistant",
        content: "test",
      };

      provider.sendMessageAfterToolCall(message, true);

      expect(
        provider.currentProvider?.sendMessageAfterToolCall
      ).toHaveBeenCalledWith(message, true);
    });
  });

  // ==========================================================================
  // stopMessage
  // ==========================================================================

  describe("stopMessage", () => {
    it("should call stopMessage on current provider", () => {
      const testProvider: TProvider = {
        type: "openai",
        name: "OpenAI Test",
        key: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      provider.setCurrentProvider(testProvider);
      provider.stopMessage();

      expect(provider.currentProvider?.stopMessage).toHaveBeenCalled();
    });

    it("should do nothing when no current provider", () => {
      provider.setCurrentProvider(undefined);
      expect(() => provider.stopMessage()).not.toThrow();
    });
  });

  // ==========================================================================
  // getProvidersInfo
  // ==========================================================================

  describe("getProvidersInfo", () => {
    it("should return info for all supported providers", () => {
      const info = provider.getProvidersInfo();

      expect(Array.isArray(info)).toBe(true);
      expect(info.length).toBeGreaterThan(0);

      info.forEach((providerInfo) => {
        expect(providerInfo.type).toBeDefined();
        expect(providerInfo.name).toBeDefined();
        expect(providerInfo.baseUrl).toBeDefined();
      });
    });

    it("should include OpenAI in providers list", () => {
      const info = provider.getProvidersInfo();

      const openaiInfo = info.find((p) => p.type === "openai");
      expect(openaiInfo).toBeDefined();
      expect(openaiInfo?.name).toBe("OpenAI");
    });
  });

  // ==========================================================================
  // getProviderInfo
  // ==========================================================================

  describe("getProviderInfo", () => {
    it("should return info for specific provider", () => {
      const info = provider.getProviderInfo("openai");

      expect(info.type).toBe("openai");
      expect(info.name).toBe("OpenAI");
      expect(info.baseUrl).toBe("https://api.openai.com/v1");
    });

    it("should return empty info for invalid provider", () => {
      const info = provider.getProviderInfo(
        "invalid" as unknown as TProvider["type"]
      );

      expect(info.name).toBe("");
      expect(info.baseUrl).toBe("");
    });
  });

  // ==========================================================================
  // checkNewProvider
  // ==========================================================================

  describe("checkNewProvider", () => {
    it("should check provider with valid data", async () => {
      const result = await provider.checkNewProvider("openai", {
        apiKey: "test-key",
        url: "https://api.openai.com/v1",
      });

      expect(result).toBe(true);
    });

    it("should return false for invalid provider type", async () => {
      const result = await provider.checkNewProvider(
        "invalid" as unknown as TProvider["type"],
        {
          apiKey: "test-key",
          url: "url",
        }
      );

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // getProvidersModels
  // ==========================================================================

  describe("getProvidersModels", () => {
    it("should fetch models for all valid providers", async () => {
      const providers: TProvider[] = [
        {
          type: "openai",
          name: "OpenAI",
          key: "key1",
          baseUrl: "https://api.openai.com/v1",
        },
        {
          type: "anthropic",
          name: "Anthropic",
          key: "key2",
          baseUrl: "https://api.anthropic.com",
        },
      ];

      const models = await provider.getProvidersModels(providers);

      expect(models.size).toBeGreaterThan(0);
    });

    it("should filter out invalid providers", async () => {
      const providers: TProvider[] = [
        {
          type: "openai",
          name: "OpenAI",
          key: "key1",
          baseUrl: "https://api.openai.com/v1",
        },
        {
          type: "invalid" as unknown as TProvider["type"],
          name: "Invalid",
          key: "key2",
          baseUrl: "url",
        },
      ];

      const models = await provider.getProvidersModels(providers);

      // Should only have models from valid provider
      expect(models.has("Invalid")).toBe(false);
    });

    it("should handle empty providers array", async () => {
      const models = await provider.getProvidersModels([]);

      expect(models.size).toBe(0);
    });

    it("should handle rejected promises", async () => {
      const providers: TProvider[] = [
        {
          type: "openai",
          name: "OpenAI",
          key: "key1",
          baseUrl: "https://api.openai.com/v1",
        },
      ];

      // Mock to reject
      const registry = await import("../registry");
      vi.mocked(
        registry.providerRegistry.openai.getProviderModels
      ).mockRejectedValue(new Error("Network error"));

      const models = await provider.getProvidersModels(providers);

      // Should handle error gracefully
      expect(models.has("OpenAI")).toBe(false);
    });
  });
});
