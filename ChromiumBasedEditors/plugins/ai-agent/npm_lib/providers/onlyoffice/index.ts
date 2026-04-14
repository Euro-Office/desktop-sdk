import type {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
} from "openai/resources/chat/completions";
import type { Model, TProvider } from "@/lib/types";
import { getErrorCode, ProviderErrors } from "../errors";
import type { TData, TErrorData } from "../base";
import { OpenAIProvider } from "../openai";
import { onlyOfficeInfo } from "./info";

const ONLYOFFICE_PROVIDER_ID = -1;

type OnlyOfficeModel = {
  modelId: string;
  providerId: number;
  providerTitle: string;
};

class OnlyOfficeProvider extends OpenAIProvider {
  getName = (): string => onlyOfficeInfo.name;

  getBaseUrl = (): string => onlyOfficeInfo.baseUrl;

  setProvider = (provider: TProvider): void => {
    const baseUrl = provider.baseUrl.replace(/\/+$/, "");
    const onlyOfficeUrl = `${baseUrl}/api/2.0/ai/openai/${ONLYOFFICE_PROVIDER_ID}/v1`;

    this.provider = provider;
    this.client = this.createClient(provider.key, onlyOfficeUrl);

    if (provider.key) this.setApiKey(provider.key);
    this.setUrl(onlyOfficeUrl);
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
        Accept: "text/event-stream",
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
            `ONLYOFFICE API error (${res.status}): ${text.slice(0, 200)}`
          );
        }
        throw e;
      }
      throw new Error(`ONLYOFFICE API error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const asyncIterable = {
      controller: abortController,
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            let value: Uint8Array | undefined;
            let done: boolean;

            try {
              ({ value, done } = await reader.read());
            } catch {
              // Network error after stream ends — ignore
              break;
            }

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
                    parsed.error.message || "Unknown ONLYOFFICE error"
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
      `${baseUrl}/api/2.0/ai/chats/models?provider=${ONLYOFFICE_PROVIDER_ID}`,
      { headers }
    );

    const json = await response.json();
    const models: OnlyOfficeModel[] = json.response ?? json;

    return models.map((model) => ({
      id: model.modelId,
      name: model.modelId,
      provider: "onlyoffice" as const,
    }));
  };

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    try {
      await this.getProviderModels(data);
      return true;
    } catch (error) {
      const errorCode = getErrorCode(error);
      const isInvalidKey = errorCode === "invalid_api_key";
      if (isInvalidKey) return ProviderErrors.invalidKey();

      if (errorCode === 404) {
        return ProviderErrors.invalidUrl();
      }

      return data.apiKey
        ? ProviderErrors.invalidKey()
        : ProviderErrors.emptyKey();
    }
  };
}

const onlyOfficeProvider = new OnlyOfficeProvider();

export { OnlyOfficeProvider, onlyOfficeProvider };
