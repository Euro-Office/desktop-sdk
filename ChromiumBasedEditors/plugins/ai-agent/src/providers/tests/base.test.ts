import type { ThreadMessageLike } from "@assistant-ui/react";
import { describe, expect, it } from "vitest";
import type { Model, TMCPItem, TProvider } from "@/lib/types";
import { AbstractBaseProvider, type TData } from "../base";

// Concrete implementation for testing
class TestProvider extends AbstractBaseProvider<
  unknown,
  ThreadMessageLike,
  { apiKey?: string; baseURL?: string }
> {
  setProvider(_provider: TProvider): void {
    // Intentionally empty for testing
  }
  setPrevMessages(_prevMessages: ThreadMessageLike[]): void {
    // Intentionally empty for testing
  }
  setTools(_tools: TMCPItem[]): void {
    // Intentionally empty for testing
  }
  async createChatName(_message: string): Promise<string> {
    return "";
  }
  async *sendMessage(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // Intentionally empty for testing
  }
  async *sendMessageAfterToolCall(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    // Intentionally empty for testing
  }
  getName(): string {
    return "Test Provider";
  }
  getBaseUrl(): string {
    return "https://test.com";
  }
  async checkProvider(_data: TData): Promise<boolean> {
    return true;
  }
  async getProviderModels(_data: TData): Promise<Model[]> {
    return [];
  }
}

describe("AbstractBaseProvider", () => {
  describe("setModelKey", () => {
    it("should set model key", () => {
      const provider = new TestProvider();
      provider.setModelKey("test-model");

      expect(provider.modelKey).toBe("test-model");
    });
  });

  describe("setSystemPrompt", () => {
    it("should set system prompt", () => {
      const provider = new TestProvider();
      provider.setSystemPrompt("You are a helpful assistant");

      expect(provider.systemPrompt).toBe("You are a helpful assistant");
    });
  });

  describe("stopMessage", () => {
    it("should set stop flag to true", () => {
      const provider = new TestProvider();
      provider.stopMessage();

      expect(provider.stopFlag).toBe(true);
    });
  });

  describe("setApiKey", () => {
    it("should set api key", () => {
      const provider = new TestProvider();
      provider.setApiKey("test-key");

      expect(provider.apiKey).toBe("test-key");
    });

    it("should update client apiKey if client exists", () => {
      const provider = new TestProvider();
      provider.client = { apiKey: "old-key", baseURL: "url" };

      provider.setApiKey("new-key");

      expect(provider.apiKey).toBe("new-key");
      expect(provider.client.apiKey).toBe("new-key");
    });

    it("should not throw if client does not have apiKey property", () => {
      const provider = new TestProvider();
      provider.client = { baseURL: "url" };

      expect(() => provider.setApiKey("new-key")).not.toThrow();
      expect(provider.apiKey).toBe("new-key");
    });

    it("should not throw if client is undefined", () => {
      const provider = new TestProvider();
      provider.client = undefined;

      expect(() => provider.setApiKey("new-key")).not.toThrow();
      expect(provider.apiKey).toBe("new-key");
    });
  });

  describe("setUrl", () => {
    it("should set url", () => {
      const provider = new TestProvider();
      provider.setUrl("https://new-url.com");

      expect(provider.url).toBe("https://new-url.com");
    });

    it("should update client baseURL if client exists", () => {
      const provider = new TestProvider();
      provider.client = { apiKey: "key", baseURL: "old-url" };

      provider.setUrl("https://new-url.com");

      expect(provider.url).toBe("https://new-url.com");
      expect(provider.client.baseURL).toBe("https://new-url.com");
    });

    it("should not throw if client does not have baseURL property", () => {
      const provider = new TestProvider();
      provider.client = { apiKey: "key" };

      expect(() => provider.setUrl("https://new-url.com")).not.toThrow();
      expect(provider.url).toBe("https://new-url.com");
    });

    it("should not throw if client is undefined", () => {
      const provider = new TestProvider();
      provider.client = undefined;

      expect(() => provider.setUrl("https://new-url.com")).not.toThrow();
      expect(provider.url).toBe("https://new-url.com");
    });
  });

  describe("initial state", () => {
    it("should have default values", () => {
      const provider = new TestProvider();

      expect(provider.modelKey).toBe("");
      expect(provider.systemPrompt).toBe("");
      expect(provider.apiKey).toBeUndefined();
      expect(provider.url).toBeUndefined();
      expect(provider.provider).toBeUndefined();
      expect(provider.client).toBeUndefined();
      expect(provider.tools).toEqual([]);
      expect(provider.prevMessages).toEqual([]);
      expect(provider.stopFlag).toBe(false);
    });
  });

  describe("concrete methods", () => {
    it("should call getName", () => {
      const provider = new TestProvider();
      expect(provider.getName()).toBe("Test Provider");
    });

    it("should call getBaseUrl", () => {
      const provider = new TestProvider();
      expect(provider.getBaseUrl()).toBe("https://test.com");
    });

    it("should call checkProvider", async () => {
      const provider = new TestProvider();
      const result = await provider.checkProvider({
        url: "url",
        apiKey: "key",
      });
      expect(result).toBe(true);
    });

    it("should call getProviderModels", async () => {
      const provider = new TestProvider();
      const result = await provider.getProviderModels({
        url: "url",
        apiKey: "key",
      });
      expect(result).toEqual([]);
    });
  });
});
