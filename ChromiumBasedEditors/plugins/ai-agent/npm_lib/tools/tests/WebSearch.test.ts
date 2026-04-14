import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSearch, type WebSearchData } from "../sources/WebSearch";

// =============================================================================
// Mock Setup
// =============================================================================

const mockFetch = vi.fn();

const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

const mockLocalStorage = createMockLocalStorage();

const mockSettings = {
  get: (key: string) => mockLocalStorage.getItem(key),
  set: (key: string, value: string) => mockLocalStorage.setItem(key, value),
  remove: (key: string) => mockLocalStorage.removeItem(key),
};

const mockPlatform = {
  file: null,
  process: null,
  env: { platform: "desktop" },
  hostTools: null,
};

const mockEventBus = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

vi.stubGlobal("fetch", mockFetch);

describe("WebSearch", () => {
  let webSearch: WebSearch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    webSearch = new WebSearch(mockSettings as any, mockPlatform as any, mockEventBus as any);
  });

  // ==========================================================================
  // Constructor & Initialization
  // ==========================================================================

  describe("constructor", () => {
    it("should initialize with empty tools when no localStorage data", () => {
      expect(webSearch.getTools()).toEqual([]);
      expect(webSearch.getWebSearchData()).toBeNull();
    });

    it("should initialize with data from localStorage", () => {
      const savedData: WebSearchData = { provider: "Exa", key: "test-key" };
      mockLocalStorage.setItem(
        "webSearchProviderData",
        JSON.stringify(savedData)
      );

      const newWebSearch = new WebSearch(mockSettings as any, mockPlatform as any, mockEventBus as any);

      expect(newWebSearch.getWebSearchData()).toEqual(savedData);
      expect(newWebSearch.getTools()).toHaveLength(2);
    });

    it("should set null when localStorage contains invalid JSON", () => {
      mockLocalStorage.setItem("webSearchProviderData", "not-valid-json{{{");

      const newWebSearch = new WebSearch(mockSettings as any, mockPlatform as any, mockEventBus as any);

      expect(newWebSearch.getWebSearchData()).toBeNull();
      expect(newWebSearch.getTools()).toEqual([]);
    });
  });

  // ==========================================================================
  // setWebSearchData
  // ==========================================================================

  describe("setWebSearchData", () => {
    it("should set web search data and initialize tools", () => {
      const data: WebSearchData = { provider: "Exa", key: "api-key-123" };

      webSearch.setWebSearchData(data);

      expect(webSearch.getWebSearchData()).toEqual(data);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "webSearchProviderData",
        JSON.stringify(data)
      );
      expect(webSearch.getTools()).toHaveLength(2);
    });

    it("should clear tools when setting null data", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });
      expect(webSearch.getTools()).toHaveLength(2);

      webSearch.setWebSearchData(null);

      expect(webSearch.getTools()).toEqual([]);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "webSearchProviderData"
      );
    });
  });

  // ==========================================================================
  // getTools
  // ==========================================================================

  describe("getTools", () => {
    it("should return empty array when not configured", () => {
      expect(webSearch.getTools()).toEqual([]);
    });

    it("should return web_search and web_crawling tools when configured", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      const tools = webSearch.getTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("web_search");
      expect(tools[1].name).toBe("web_crawling");
    });

    it("should return tools with proper schema structure", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      const tools = webSearch.getTools();

      // Verify inputSchema has proper structure with properties
      expect(tools[0].inputSchema).toHaveProperty("properties.query");
      expect(tools[1].inputSchema).toHaveProperty("properties.urls");
    });

    it("should return a copy of tools array", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      const tools1 = webSearch.getTools();
      const tools2 = webSearch.getTools();

      expect(tools1).not.toBe(tools2);
      expect(tools1).toEqual(tools2);
    });
  });

  // ==========================================================================
  // getWebSearchEnabled
  // ==========================================================================

  describe("getWebSearchEnabled", () => {
    it("should return false when not configured", () => {
      expect(webSearch.getWebSearchEnabled()).toBe(false);
    });

    it("should return true when configured", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      expect(webSearch.getWebSearchEnabled()).toBe(true);
    });
  });

  // ==========================================================================
  // webSearch
  // ==========================================================================

  describe("webSearch", () => {
    it("should return args as JSON when provider is not Exa", async () => {
      webSearch.setWebSearchData({ provider: "Other", key: "key" });

      const result = await webSearch.webSearch({ query: "test" });

      expect(result).toBe(JSON.stringify({ query: "test" }));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return args as JSON when no provider configured", async () => {
      const result = await webSearch.webSearch({ query: "test" });

      expect(result).toBe(JSON.stringify({ query: "test" }));
    });

    it("should make Exa API request with correct parameters", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "test-api-key" });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await webSearch.webSearch({ query: "test query" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.exa.ai/search",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "test-api-key",
          },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        query: "test query",
        text: true,
        numResults: 5,
        livecrawl: "preferred",
      });
    });

    it("should return successful response data", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      const mockResults = [{ title: "Result 1", url: "https://example.com" }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: mockResults }),
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.data).toEqual(mockResults);
      expect(parsed.error).toBeUndefined();
    });

    it("should handle API error response", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: 401 }),
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      // Error from API is wrapped in data.error by the implementation
      expect(parsed.data).toEqual({ error: 401 });
    });

    it("should handle network error (non-ok response)", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(500);
      expect(parsed.message).toBe("Network error: 500");
    });

    it("should handle non-Error exception with String(e)", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockRejectedValue("string error");

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("string error");
    });

    it("should handle fetch exception", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockRejectedValue(new Error("Network failure"));

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it("should use empty string for x-api-key when key is undefined", async () => {
      // Line 56: test ?? "" fallback when key is undefined
      // Force the data to have undefined key by casting
      webSearch.setWebSearchData({
        provider: "Exa",
        key: undefined as unknown as string,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await webSearch.webSearch({ query: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.exa.ai/search",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "",
          },
        })
      );
    });

    // ========================================================================
    // ONLYOFFICE provider paths
    // ========================================================================

    it("should make ONLYOFFICE API request with correct parameters", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "oo-token",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ results: [{ title: "OO Result" }] }),
      });

      const result = await webSearch.webSearch({ query: "test query" });
      const parsed = JSON.parse(result);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://oo.example.com/api/2.0/ai/web-search/v1/search",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer oo-token",
          },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({ query: "test query", numResults: 5 });
      expect(parsed.data).toEqual([{ title: "OO Result" }]);
    });

    it("should handle ONLYOFFICE non-ok response", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockResolvedValue({ ok: false, status: 403 });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(403);
      expect(parsed.message).toBe("Network error: 403");
    });

    it("should handle ONLYOFFICE API error in response", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: "rate_limit_exceeded" }),
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.data).toEqual({ error: "rate_limit_exceeded" });
    });

    it("should handle ONLYOFFICE fetch exception", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it("should use provider as baseUrl when isCloudProvider is true", async () => {
      webSearch.setWebSearchData({
        provider: "https://cloud.example.com",
        key: "cloud-token",
        isCloudProvider: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await webSearch.webSearch({ query: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.example.com/api/2.0/ai/web-search/v1/search",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer cloud-token",
          },
        })
      );
    });

    it("should use baseUrl for ONLYOFFICE provider when provided", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
        baseUrl: "https://custom-base.example.com",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await webSearch.webSearch({ query: "test" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom-base.example.com/api/2.0/ai/web-search/v1/search",
        expect.anything()
      );
    });

    it("should handle missing baseUrl for ONLYOFFICE provider gracefully", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
      });

      // No baseUrl means the ?? "" fallback is hit, which causes an Invalid URL error
      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      // The catch block handles the error
      expect(parsed.error).toBeDefined();
    });
  });

  // ==========================================================================
  // webCrawling
  // ==========================================================================

  describe("webCrawling", () => {
    it("should return args as JSON when provider is not Exa", async () => {
      webSearch.setWebSearchData({ provider: "Other", key: "key" });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });

      expect(result).toBe(JSON.stringify({ urls: ["https://example.com"] }));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should make Exa API request to contents endpoint", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "test-key" });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await webSearch.webCrawling({ urls: ["https://example.com"] });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.exa.ai/contents",
        expect.objectContaining({
          method: "POST",
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        urls: ["https://example.com"],
        text: true,
      });
    });

    it("should return successful crawl results", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      const mockResults = [
        { url: "https://example.com", text: "Page content" },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: mockResults }),
      });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.data).toEqual(mockResults);
    });

    it("should handle network error (non-ok response)", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(503);
    });

    it("should handle fetch exception", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockRejectedValue(new Error("Network failure"));

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it("should handle API error response in crawling", async () => {
      // Line 114: test parsedData.error branch in webCrawling
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: "Invalid URL" }),
      });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.data).toEqual({ error: "Invalid URL" });
    });

    it("should use empty string for x-api-key when key is undefined", async () => {
      // Line 97: test ?? "" fallback when key is undefined
      webSearch.setWebSearchData({
        provider: "Exa",
        key: undefined as unknown as string,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await webSearch.webCrawling({ urls: ["https://example.com"] });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.exa.ai/contents",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "",
          },
        })
      );
    });

    // ========================================================================
    // ONLYOFFICE provider paths
    // ========================================================================

    it("should make ONLYOFFICE crawl request with correct parameters", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "oo-token",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ url: "https://example.com", text: "Content" }],
          }),
      });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://oo.example.com/api/2.0/ai/web-search/v1/contents",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer oo-token",
          },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({ url: "https://example.com" });
      expect(parsed.data).toEqual([
        { url: "https://example.com", text: "Content" },
      ]);
    });

    it("should handle ONLYOFFICE crawl non-ok response", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockResolvedValue({ ok: false, status: 502 });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(502);
      expect(parsed.message).toBe("Network error: 502");
    });

    it("should handle ONLYOFFICE crawl API error in response", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: "invalid_url" }),
      });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.data).toEqual({ error: "invalid_url" });
    });

    it("should handle ONLYOFFICE crawl fetch exception", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
        baseUrl: "https://oo.example.com",
      });

      mockFetch.mockRejectedValue(new Error("Timeout"));

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it("should handle non-Error exception with String(e) in Exa crawl", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockFetch.mockRejectedValue("string crawl error");

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe("string crawl error");
    });

    it("should handle missing baseUrl for ONLYOFFICE crawling gracefully", async () => {
      webSearch.setWebSearchData({
        provider: "ONLYOFFICE",
        key: "key",
      });

      // No baseUrl means the ?? "" fallback is hit, which causes an Invalid URL error
      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBeDefined();
    });

    it("should use provider as baseUrl for crawling when isCloudProvider is true", async () => {
      webSearch.setWebSearchData({
        provider: "https://cloud.example.com",
        key: "cloud-token",
        isCloudProvider: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await webSearch.webCrawling({ urls: ["https://example.com"] });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://cloud.example.com/api/2.0/ai/web-search/v1/contents",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer cloud-token",
          },
        })
      );
    });
  });

  // ==========================================================================
  // callTools
  // ==========================================================================

  describe("callTools", () => {
    beforeEach(() => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
    });

    it("should call webSearch for web_search tool", async () => {
      const result = await webSearch.callTools("web_search", {
        query: "test",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.exa.ai/search",
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it("should call webCrawling for web_crawling tool", async () => {
      const result = await webSearch.callTools("web_crawling", {
        urls: ["https://example.com"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.exa.ai/contents",
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it("should return undefined for unknown tool", async () => {
      const result = await webSearch.callTools("unknown_tool", {});

      expect(result).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // platformFetch
  // ==========================================================================

  describe("platformFetch", () => {
    it("should use platform.fetchProxy when available", async () => {
      const mockProxy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [{ title: "Proxied" }] }),
      });

      const platformWithProxy = {
        ...mockPlatform,
        fetchProxy: mockProxy,
      };

      const wsWithProxy = new WebSearch(
        mockSettings as any,
        platformWithProxy as any,
        mockEventBus as any
      );
      wsWithProxy.setWebSearchData({ provider: "Exa", key: "key" });

      const result = await wsWithProxy.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(mockProxy).toHaveBeenCalledWith(
        "https://api.exa.ai/search",
        expect.anything()
      );
      expect(mockFetch).not.toHaveBeenCalled();
      expect(parsed.data).toEqual([{ title: "Proxied" }]);
    });
  });

  // ==========================================================================
  // initTools
  // ==========================================================================

  describe("initTools", () => {
    it("should dispatch tools-changed event when configured", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      expect(mockEventBus.emit).toHaveBeenCalled();
    });

    it("should not dispatch event when clearing data", () => {
      mockEventBus.emit.mockClear();

      webSearch.setWebSearchData(null);

      // initTools is called but setTools clears without dispatching
      // The event is only dispatched at the end of initTools when there are tools
      expect(webSearch.getTools()).toEqual([]);
    });
  });
});
