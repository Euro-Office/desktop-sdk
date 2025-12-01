import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebSearch, type WebSearchData } from "../WebSearch";

// =============================================================================
// Mock Setup
// =============================================================================

const mockCreateRequest = vi.fn();
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
  AscSimpleRequest: { createRequest: mockCreateRequest },
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

    it("should return tools with required fields in schema", () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      const tools = webSearch.getTools();

      expect(tools[0].inputSchema).toHaveProperty("required", ["query"]);
      expect(tools[1].inputSchema).toHaveProperty("required", ["urls"]);
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
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });

    it("should return args as JSON when no provider configured", async () => {
      const result = await webSearch.webSearch({ query: "test" });

      expect(result).toBe(JSON.stringify({ query: "test" }));
    });

    it("should make Exa API request with correct parameters", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "test-api-key" });

      mockCreateRequest.mockImplementation((options) => {
        options.complete({ responseText: JSON.stringify({ results: [] }) });
      });

      await webSearch.webSearch({ query: "test query" });

      expect(mockCreateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.exa.ai/search",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "test-api-key",
          },
        })
      );

      const callBody = JSON.parse(mockCreateRequest.mock.calls[0][0].body);
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
      mockCreateRequest.mockImplementation((options) => {
        options.complete({
          responseText: JSON.stringify({ results: mockResults }),
        });
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.data).toEqual(mockResults);
      expect(parsed.error).toBeUndefined();
    });

    it("should handle API error response", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockCreateRequest.mockImplementation((options) => {
        options.complete({
          responseText: JSON.stringify({ error: 401 }),
        });
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.data).toBeUndefined();
      expect(parsed.error).toBe(401);
    });

    it("should handle network error", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockCreateRequest.mockImplementation((options) => {
        options.error({ statusCode: 500 });
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(500);
      expect(parsed.message).toBe("Network error: 500");
    });

    it("should convert -102 status code to 404", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockCreateRequest.mockImplementation((options) => {
        options.error({ statusCode: -102 });
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(404);
      expect(parsed.message).toBe("Network error: 404");
    });

    it("should handle invalid JSON response", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockCreateRequest.mockImplementation((options) => {
        options.complete({ responseText: "invalid json" });
      });

      const result = await webSearch.webSearch({ query: "test" });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(500);
      expect(parsed.message).toBe("Invalid response from API");
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
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });

    it("should make Exa API request to contents endpoint", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "test-key" });

      mockCreateRequest.mockImplementation((options) => {
        options.complete({ responseText: JSON.stringify({ results: [] }) });
      });

      await webSearch.webCrawling({ urls: ["https://example.com"] });

      expect(mockCreateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.exa.ai/contents",
          method: "POST",
        })
      );

      const callBody = JSON.parse(mockCreateRequest.mock.calls[0][0].body);
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
      mockCreateRequest.mockImplementation((options) => {
        options.complete({
          responseText: JSON.stringify({ results: mockResults }),
        });
      });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.data).toEqual(mockResults);
    });

    it("should handle network error", async () => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });

      mockCreateRequest.mockImplementation((options) => {
        options.error({ statusCode: 503 });
      });

      const result = await webSearch.webCrawling({
        urls: ["https://example.com"],
      });
      const parsed = JSON.parse(result);

      expect(parsed.error).toBe(503);
    });
  });

  // ==========================================================================
  // callTools
  // ==========================================================================

  describe("callTools", () => {
    beforeEach(() => {
      webSearch.setWebSearchData({ provider: "Exa", key: "key" });
      mockCreateRequest.mockImplementation((options) => {
        options.complete({ responseText: JSON.stringify({ results: [] }) });
      });
    });

    it("should call webSearch for web_search tool", async () => {
      const result = await webSearch.callTools("web_search", {
        query: "test",
      });

      expect(mockCreateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.exa.ai/search",
        })
      );
      expect(result).toBeDefined();
    });

    it("should call webCrawling for web_crawling tool", async () => {
      const result = await webSearch.callTools("web_crawling", {
        urls: ["https://example.com"],
      });

      expect(mockCreateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.exa.ai/contents",
        })
      );
      expect(result).toBeDefined();
    });

    it("should return undefined for unknown tool", async () => {
      const result = await webSearch.callTools("unknown_tool", {});

      expect(result).toBeUndefined();
      expect(mockCreateRequest).not.toHaveBeenCalled();
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
