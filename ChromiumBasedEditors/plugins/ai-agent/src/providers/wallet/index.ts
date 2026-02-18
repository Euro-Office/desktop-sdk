import type {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
} from "openai/resources/chat/completions";
import type { Model, TProvider } from "@/lib/types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { walletInfo } from "./info";

type WalletModel = {
  modelId: string;
  providerId: number;
  providerTitle: string;
};

class WalletProvider extends OpenAIProvider {
  getName = (): string => walletInfo.name;

  getBaseUrl = (): string => walletInfo.baseUrl;

  setProvider = (provider: TProvider): void => {
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const walletUrl = `onlyoffice-proxy://${baseUrl}/api/2.0/ai/openai/-1/v1`;

    this.provider = provider;
    this.client = this.createClient(provider.key, walletUrl);

    if (provider.key) this.setApiKey(provider.key);
    this.setUrl(walletUrl);
  };

  async getStream(
    systemMessage: ChatCompletionSystemMessageParam,
    convertedMessages: ChatCompletionMessageParam[],
    withThinking?: boolean
  ) {
    const url = this.url;

    const modelThinking = this.modelKey.includes("-thinking");
    const model = modelThinking
      ? this.modelKey.replace("-thinking", "")
      : this.modelKey;

    const reasoning_effort =
      withThinking && modelThinking ? "medium" : undefined;

    const messages = [
      systemMessage,
      ...this.prevMessages,
      ...convertedMessages,
    ];

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
    };

    if (this.tools.length > 0) {
      body.tools = this.tools;
    }

    if (reasoning_effort) {
      body.reasoning_effort = reasoning_effort;
    }

    const abortController = new AbortController();

    const res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    const contentType = res.headers.get("content-type") || "";
    const isSSE = contentType.includes("text/event-stream");

    if (!res.ok || !res.body || !isSSE) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.error?.message) {
          throw new Error(json.error.message);
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error(
            `Wallet API error (${res.status}): ${text.slice(0, 200)}`
          );
        }
        throw e;
      }
      throw new Error(`Wallet API error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const asyncIterable = {
      controller: abortController,
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") return;

              try {
                const parsed = JSON.parse(data);

                // Handle error responses inside SSE
                if (parsed.error) {
                  throw new Error(
                    parsed.error.message || "Unknown wallet error"
                  );
                }

                yield parsed;
              } catch (e) {
                if (e instanceof SyntaxError) {
                  // Skip malformed chunks
                  continue;
                }
                throw e;
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      },
    };

    return asyncIterable as unknown as Awaited<
      ReturnType<OpenAIProvider["getStream"]>
    >;
  }

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const baseUrl = (data.url || "").replace(/\/+$/, "");
    const headers: HeadersInit = data.apiKey
      ? { Authorization: `Bearer ${data.apiKey}` }
      : {};

    const response = await fetch(
      `onlyoffice-proxy://${baseUrl}/api/2.0/ai/chats/models?provider=-1`,
      { headers }
    );

    const json = await response.json();
    const models: WalletModel[] = json.response ?? json;

    return models.map((model) => ({
      id: model.modelId,
      name: model.modelId,
      provider: "wallet" as const,
    }));
  };
}

const walletProvider = new WalletProvider();

export { WalletProvider, walletProvider };
