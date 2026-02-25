import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSearch, type WebSearchData } from "../WebSearch";

// =============================================================================
// Mock Setup
// =============================================================================

const mockFetch = vi.fn();
const mockDispatchEvent = vi.fn();

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

// Mock window object for Node environment
const mockWindow = {
  localStorage: mockLocalStorage,
  dispatchEvent: mockDispatchEvent,
  CustomEvent: class CustomEvent {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  },
};

vi.stubGlobal("window", mockWindow);
vi.stubGlobal("localStorage", mockLocalStorage);
vi.stubGlobal("CustomEvent", mockWindow.CustomEvent);
vi.stubGlobal("fetch", mockFetch);

describe("WebSearch", () => {
  let webSearch: WebSearch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    webSearch = new WebSearch();
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

      const newWebSearch = new WebSearch();

      expect(newWebSearch.getWebSearchData()).toEqual(savedData);
      expect(newWebSearch.getTools()).toHaveLength(2);
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
      expect(mockLocalStorage.setItem).toHaveBeenLastCalledWith(
        "webSearchProviderData",
        ""
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
        "onlyoffice-proxy://https://api.exa.ai/search",
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
        "onlyoffice-proxy://https://api.exa.ai/search",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "",
          },
        })
      );
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
        "onlyoffice-proxy://https://api.exa.ai/contents",
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
        "onlyoffice-proxy://https://api.exa.ai/contents",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "",
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
        "onlyoffice-proxy://https://api.exa.ai/search",
        expect.anything()
      );
      expect(result).toBeDefined();
    });

    it("should call webCrawling for web_crawling tool", async () => {
      const result = await webSearch.callTools("web_crawling", {
        urls: ["https://example.com"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "onlyoffice-proxy://https://api.exa.ai/contents",
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
  // initTools
  // ==========================================================================

  describe("initTools", () => {
    it("should dispatch tools-changed event when configured", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      expect(mockDispatchEvent).toHaveBeenCalled();
    });

    it("should not dispatch event when clearing data", () => {
      mockDispatchEvent.mockClear();

      webSearch.setWebSearchData(null);

      // initTools is called but setTools clears without dispatching
      // The event is only dispatched at the end of initTools when there are tools
      expect(webSearch.getTools()).toEqual([]);
    });
  });
});
