import type { ChatEventBus } from "../../events";
import type { PlatformAdapter } from "../../platform/types";
import type { SettingsAdapter } from "../../settings/types";
import type { TMCPItem } from "../../types";

const WEB_SEARCH_DATA = "webSearchProviderData";

export type WebSearchData = {
  provider: string;
  key: string;
  baseUrl?: string;
  isCloudProvider?: boolean;
} | null;

class WebSearch {
  private tools: TMCPItem[];

  private webSearchData: WebSearchData = null;

  constructor(
    private settings: SettingsAdapter,
    private platform: PlatformAdapter,
    private eventBus: ChatEventBus
  ) {
    this.tools = [];

    const data = this.settings.get(WEB_SEARCH_DATA);

    if (data) {
      try {
        this.webSearchData = JSON.parse(data);
      } catch {
        this.webSearchData = null;
      }
    } else {
      this.webSearchData = null;
    }

    this.initTools();
  }

  /** Use platform fetchProxy if available, otherwise standard fetch */
  private platformFetch = (
    url: string,
    init?: RequestInit
  ): Promise<Response> => {
    const proxy = this.platform.fetchProxy;
    return proxy ? proxy(url, init) : fetch(url, init);
  };

  setWebSearchData = (data: WebSearchData) => {
    this.webSearchData = data;
    if (data) {
      this.settings.set(WEB_SEARCH_DATA, JSON.stringify(data));
    } else {
      this.settings.remove(WEB_SEARCH_DATA);
    }
    this.initTools();
  };

  getWebSearchData = () => {
    return this.webSearchData;
  };

  setTools = (tools: TMCPItem[]) => {
    this.tools = tools;
  };

  getTools = () => {
    return [...this.tools];
  };

  webSearch = async (args: Record<string, unknown>) => {
    if (
      this.webSearchData?.isCloudProvider ||
      this.webSearchData?.provider === "ONLYOFFICE"
    ) {
      try {
        const baseUrl = this.webSearchData.isCloudProvider
          ? this.webSearchData.provider
          : (this.webSearchData.baseUrl ?? "");
        const searchUrl = new URL("/api/2.0/ai/web-search/v1/search", baseUrl);
        const response = await fetch(`${searchUrl.href}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.webSearchData.key}`,
          },
          body: JSON.stringify({ query: args.query, numResults: 5 }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        console.error("WebSearch error:", e);
        return JSON.stringify({ error: e });
      }
    }
    if (this.webSearchData?.provider === "Exa") {
      try {
        const response = await this.platformFetch("https://api.exa.ai/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.webSearchData?.key ?? "",
          },
          body: JSON.stringify({
            query: args.query,
            text: true,
            numResults: 5,
            livecrawl: "preferred",
          }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        console.error("WebSearch error:", e);
        return JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return JSON.stringify(args);
  };

  webCrawling = async (args: Record<string, unknown>) => {
    if (
      this.webSearchData?.isCloudProvider ||
      this.webSearchData?.provider === "ONLYOFFICE"
    ) {
      try {
        const baseUrl = this.webSearchData.isCloudProvider
          ? this.webSearchData.provider
          : (this.webSearchData.baseUrl ?? "");
        const crawlUrl = new URL("/api/2.0/ai/web-search/v1/contents", baseUrl);
        const response = await fetch(`${crawlUrl.href}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.webSearchData.key}`,
          },
          body: JSON.stringify({
            url: (args.urls as string[])[0],
          }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        console.error(e);
        return JSON.stringify({ error: e });
      }
    }
    if (this.webSearchData?.provider === "Exa") {
      try {
        const response = await this.platformFetch("https://api.exa.ai/contents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.webSearchData?.key ?? "",
          },
          body: JSON.stringify({
            urls: args.urls,
            text: true,
          }),
        });

        if (!response.ok) {
          return JSON.stringify({
            error: response.status,
            message: `Network error: ${response.status}`,
          });
        }

        const parsedData = await response.json();
        const data = parsedData.error
          ? { error: parsedData.error }
          : parsedData.results;

        return JSON.stringify({ data });
      } catch (e) {
        console.error(e);
        return JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return JSON.stringify(args);
  };

  callTools = async (name: string, args: Record<string, unknown>) => {
    if (name === "web_search") {
      return await this.webSearch(args);
    }

    if (name === "web_crawling") {
      return await this.webCrawling(args);
    }
  };

  initTools = () => {
    if (!this.webSearchData) {
      this.setTools([]);

      return;
    }

    this.setTools([
      {
        name: "web_search",
        description:
          "The search endpoint lets you intelligently search the web and extract contents from the results.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The query string for the search.",
            },
          },
        },
      },
      {
        name: "web_crawling",
        description:
          "Get the full page contents, summaries, and metadata for a list of URLs.",
        inputSchema: {
          type: "object",
          properties: {
            urls: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of URLs to crawl",
            },
          },
        },
      },
    ]);

    this.eventBus.emit("tools-changed");
  };

  getWebSearchEnabled = () => {
    return !!this.webSearchData;
  };
}

export { WebSearch };
