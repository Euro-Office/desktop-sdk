import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TProvider } from "../../../types";
import {
  createMockStreamWithIterator,
  createTextChunk,
} from "../../tests/test-utils";
import { OnlyOfficeProvider } from "../index";
import { onlyOfficeInfo } from "../info";

// =============================================================================
// Mock Setup
// =============================================================================

const mockCreate = vi.fn();
const mockList = vi.fn();
const mockFetch = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    models = { list: mockList };
  },
}));

vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockCreate.mockReset();
  mockList.mockReset();
  mockFetch.mockReset();
});

describe("OnlyOfficeProvider", () => {
  let provider: OnlyOfficeProvider;

  beforeEach(() => {
    provider = new OnlyOfficeProvider();
  });

  // ==========================================================================
  // Provider Info
  // ==========================================================================

  describe("getName", () => {
    it("should return ONLYOFFICE", () => {
      expect(provider.getName()).toBe(onlyOfficeInfo.name);
    });
  });

  describe("getBaseUrl", () => {
    it("should return ONLYOFFICE base URL", () => {
      expect(provider.getBaseUrl()).toBe(onlyOfficeInfo.baseUrl);
    });
  });

  // ==========================================================================
  // Setup Methods
  // ==========================================================================

  describe("setProvider", () => {
    it("should set provider and create client", () => {
      const testProvider: TProvider = {
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "test-key",
        baseUrl: "https://docspace.example.com",
      };

      provider.setProvider(testProvider);

      expect(provider.client).toBeDefined();
      expect(provider.provider).toBe(testProvider);
    });

    it("should set API key", () => {
      const testProvider: TProvider = {
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "test-api-key",
        baseUrl: "https://docspace.example.com",
      };

      provider.setProvider(testProvider);

      expect(provider.apiKey).toBe("test-api-key");
    });

    it("should construct correct URL from baseUrl", () => {
      const testProvider: TProvider = {
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "test-key",
        baseUrl: "https://docspace.example.com/",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe(
        "https://docspace.example.com/api/2.0/ai/openai/-1/v1",
      );
    });

    it("should strip trailing slashes from baseUrl", () => {
      const testProvider: TProvider = {
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "test-key",
        baseUrl: "https://docspace.example.com///",
      };

      provider.setProvider(testProvider);

      expect(provider.url).toBe(
        "https://docspace.example.com/api/2.0/ai/openai/-1/v1",
      );
    });

    it("should not set apiKey if key is empty", () => {
      const testProvider: TProvider = {
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "",
        baseUrl: "https://docspace.example.com",
      };

      provider.setProvider(testProvider);

      // setApiKey is not called when key is falsy
      expect(provider.provider).toBe(testProvider);
    });
  });

  // ==========================================================================
  // getStream (SSE-based streaming)
  // ==========================================================================

  describe("getStream", () => {
    const setupProvider = () => {
      provider.setProvider({
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "test-key",
        baseUrl: "https://docspace.example.com",
      });
      provider.setModelKey("gpt-4o");
    };

    it("should make fetch request with correct parameters", async () => {
      setupProvider();

      const sseData = [
        'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}',
        "data: [DONE]",
      ].join("\n");

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "You are helpful" },
        [{ role: "user", content: "Hello" }],
      );

      const results: unknown[] = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/chat/completions"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should throw on non-ok response with error message", async () => {
      setupProvider();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        body: null,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({ error: { message: "Bad request" } }),
      });

      await expect(
        provider.getStream(
          { role: "system", content: "test" },
          [{ role: "user", content: "Hello" }],
        ),
      ).rejects.toThrow("Bad request");
    });

    it("should throw on non-ok response with non-JSON text", async () => {
      setupProvider();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        body: null,
        headers: new Headers({ "content-type": "text/plain" }),
        text: async () => "Internal Server Error",
      });

      await expect(
        provider.getStream(
          { role: "system", content: "test" },
          [{ role: "user", content: "Hello" }],
        ),
      ).rejects.toThrow("ONLYOFFICE API error (500)");
    });

    it("should handle thinking model key", async () => {
      provider.setProvider({
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "test-key",
        baseUrl: "https://docspace.example.com",
      });
      provider.setModelKey("gpt-4o-thinking");

      const sseData = "data: [DONE]\n";
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
        true,
      );

      for await (const _ of stream) {
        // drain
      }

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.model).toBe("gpt-4o");
      expect(body.reasoning_effort).toBe("medium");
    });

    it("should not set reasoning_effort when withThinking is false", async () => {
      provider.setProvider({
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "test-key",
        baseUrl: "https://docspace.example.com",
      });
      provider.setModelKey("gpt-4o-thinking");

      const sseData = "data: [DONE]\n";
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
        false,
      );

      for await (const _ of stream) {
        // drain
      }

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.reasoning_effort).toBeUndefined();
    });

    it("should include tools in request body when set", async () => {
      setupProvider();
      provider.setTools([
        {
          name: "test_tool",
          description: "A test tool",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      const sseData = "data: [DONE]\n";
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
      );

      for await (const _ of stream) {
        // drain
      }

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.tools).toBeDefined();
      expect(body.tools.length).toBe(1);
    });

    it("should handle SSE error responses inside stream", async () => {
      setupProvider();

      const sseData =
        'data: {"error":{"message":"Rate limit exceeded"}}\n\ndata: [DONE]\n';
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
      );

      await expect(async () => {
        for await (const _ of stream) {
          // drain
        }
      }).rejects.toThrow("Rate limit exceeded");
    });

    it("should use 'Unknown ONLYOFFICE error' when error has no message", async () => {
      setupProvider();

      const sseData = 'data: {"error":{}}\n\ndata: [DONE]\n';
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
      );

      await expect(async () => {
        for await (const _ of stream) {
          // drain
        }
      }).rejects.toThrow("Unknown ONLYOFFICE error");
    });

    it("should handle null content-type header", async () => {
      setupProvider();

      const sseData = "data: [DONE]\n";
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        body: readable,
        headers: new Headers(),
        text: async () => "Bad request",
      });

      // content-type is null, so || "" fallback applies, and isSSE is false
      await expect(
        provider.getStream(
          { role: "system", content: "test" },
          [{ role: "user", content: "Hello" }],
        ),
      ).rejects.toThrow();
    });

    it("should handle SSE with empty lines and non-data lines", async () => {
      setupProvider();

      const sseData = [
        "",
        "   ",
        ": comment line",
        "event: ping",
        'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":null}]}',
        "data: [DONE]",
      ].join("\n");

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
      );

      const results: unknown[] = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
    });

    it("should skip malformed JSON in SSE chunks", async () => {
      setupProvider();

      const sseData = [
        "data: {invalid json}",
        'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}',
        "data: [DONE]",
      ].join("\n");

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
      );

      const results: unknown[] = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
    });

    it("should not include Authorization header when no apiKey", async () => {
      provider.setProvider({
        type: "onlyoffice",
        name: "ONLYOFFICE",
        key: "",
        baseUrl: "https://docspace.example.com",
      });
      provider.setModelKey("gpt-4o");

      const sseData = "data: [DONE]\n";
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: readable,
        headers: new Headers({ "content-type": "text/event-stream" }),
      });

      const stream = await provider.getStream(
        { role: "system", content: "test" },
        [{ role: "user", content: "Hello" }],
      );

      for await (const _ of stream) {
        // drain
      }

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBeUndefined();
    });

    it("should throw generic error on non-ok response without body", async () => {
      setupProvider();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        body: null,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => JSON.stringify({}),
      });

      await expect(
        provider.getStream(
          { role: "system", content: "test" },
          [{ role: "user", content: "Hello" }],
        ),
      ).rejects.toThrow("ONLYOFFICE API error: 502");
    });
  });

  // ==========================================================================
  // getProviderModels
  // ==========================================================================

  describe("getProviderModels", () => {
    it("should return models from API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            { modelId: "gpt-4o", providerId: -1, providerTitle: "OO" },
            { modelId: "gpt-3.5", providerId: -1, providerTitle: "OO" },
          ],
        }),
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://docspace.example.com",
      });

      expect(models).toHaveLength(2);
      expect(models.every((m) => m.provider === "onlyoffice")).toBe(true);
      expect(models[0].id).toBe("gpt-4o");
    });

    it("should use model.modelId as both id and name", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            { modelId: "gpt-4o", providerId: -1, providerTitle: "OO" },
          ],
        }),
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://docspace.example.com",
      });

      expect(models[0].id).toBe("gpt-4o");
      expect(models[0].name).toBe("gpt-4o");
    });

    it("should handle response as direct array", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { modelId: "model-1", providerId: -1, providerTitle: "OO" },
        ],
      });

      const models = await provider.getProviderModels({
        apiKey: "test-key",
        url: "https://docspace.example.com",
      });

      expect(models).toHaveLength(1);
    });

    it("should include auth header when apiKey provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: [] }),
      });

      await provider.getProviderModels({
        apiKey: "my-key",
        url: "https://docspace.example.com",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/2.0/ai/chats/models"),
        expect.objectContaining({
          headers: { Authorization: "Bearer my-key" },
        }),
      );
    });

    it("should not include auth header when no apiKey", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: [] }),
      });

      await provider.getProviderModels({
        apiKey: "",
        url: "https://docspace.example.com",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {},
        }),
      );
    });

    it("should handle empty url", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: [] }),
      });

      await provider.getProviderModels({
        apiKey: "key",
        url: "",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/2.0/ai/chats/models?provider=-1",
        expect.any(Object),
      );
    });

    it("should strip trailing slashes from URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: [] }),
      });

      await provider.getProviderModels({
        apiKey: "key",
        url: "https://docspace.example.com///",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://docspace.example.com/api/2.0/ai/chats/models?provider=-1",
        expect.any(Object),
      );
    });
  });

  // ==========================================================================
  // checkProvider
  // ==========================================================================

  describe("checkProvider", () => {
    it("should return true on successful model fetch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: [
            { modelId: "gpt-4o", providerId: -1, providerTitle: "OO" },
          ],
        }),
      });

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://docspace.example.com",
      });

      expect(result).toBe(true);
    });

    it("should return invalidKey on invalid_api_key error", async () => {
      mockFetch.mockRejectedValue({ code: "invalid_api_key" });

      const result = await provider.checkProvider({
        apiKey: "invalid-key",
        url: "https://docspace.example.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return invalidUrl on 404 error", async () => {
      // getErrorCode returns 404 when message is "Connection error."
      mockFetch.mockRejectedValue({ message: "Connection error." });

      const result = await provider.checkProvider({
        apiKey: "test-key",
        url: "https://invalid.example.com",
      });

      expect(result).toEqual({
        field: "url",
        message: expect.any(String),
      });
    });

    it("should return invalidKey when apiKey present and unknown error", async () => {
      mockFetch.mockRejectedValue(new Error("Unknown error"));

      const result = await provider.checkProvider({
        apiKey: "some-key",
        url: "https://docspace.example.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
    });

    it("should return emptyKey when no apiKey and unknown error", async () => {
      mockFetch.mockRejectedValue(new Error("Unknown error"));

      const result = await provider.checkProvider({
        apiKey: "",
        url: "https://docspace.example.com",
      });

      expect(result).toEqual({
        field: "key",
        message: expect.any(String),
      });
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
  });
});
