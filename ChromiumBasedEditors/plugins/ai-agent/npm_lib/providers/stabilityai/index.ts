import type { ThreadMessageLike } from "@assistant-ui/react";
import { CapabilitiesUI } from "../../capabilities";
import type { Model, TMCPItem, TProvider } from "../../types";
import { AbstractBaseProvider, type TData, type TErrorData } from "../base";
import { mapFetchError } from "../errors";
import { stabilityaiInfo } from "./info";

class StabilityAIProvider extends AbstractBaseProvider<never, never, null> {
  getName = (): string => stabilityaiInfo.name;

  getBaseUrl = (): string => stabilityaiInfo.baseUrl;

  setProvider(provider: TProvider): void {
    this.provider = provider;
    this.apiKey = provider.key;
    this.url = provider.baseUrl;
  }

  // biome-ignore lint/suspicious/noEmptyBlockStatements: image-only provider, no chat history
  setPrevMessages(): void {}
  // biome-ignore lint/suspicious/noEmptyBlockStatements: image-only provider, no tools
  setTools(_tools: TMCPItem[]): void {}

  async createChatName(): Promise<string> {
    return "";
  }

  // biome-ignore lint/correctness/useYield: image-only provider, chat not supported
  async *sendMessage(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    throw new Error("Stability AI does not support chat");
  }

  // biome-ignore lint/correctness/useYield: image-only provider, chat not supported
  async *sendMessageAfterToolCall(): AsyncGenerator<
    ThreadMessageLike | { isEnd: true; responseMessage: ThreadMessageLike }
  > {
    throw new Error("Stability AI does not support chat");
  }

  isSupportStreaming(): boolean {
    return false;
  }

  async imageGeneration(request: {
    prompt: string;
    width?: number;
    height?: number;
  }): Promise<string> {
    const modelId = this.modelKey || "core";

    const modelInfo =
      stabilityaiInfo.models.find((m) => m.id === modelId) ??
      stabilityaiInfo.models[1];

    const url = (this.url || stabilityaiInfo.baseUrl) + modelInfo.endpoint;

    const formData = new FormData();
    formData.append("prompt", request.prompt);
    formData.append("output_format", "png");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Stability AI error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.artifacts?.[0]?.base64) return data.artifacts[0].base64;
    if (data.image) return data.image;

    return "";
  }

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    try {
      const url =
        (data.url || stabilityaiInfo.baseUrl) +
        "/v2beta/stable-image/generate/core";

      const formData = new FormData();
      formData.append("prompt", "test");
      formData.append("output_format", "png");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${data.apiKey}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        return { field: "key", message: "Invalid API key" };
      }

      return true;
    } catch (error) {
      return mapFetchError(error, !!data.apiKey);
    }
  };

  getProviderModels = async (_data: TData): Promise<Model[]> => {
    return stabilityaiInfo.models.map((m) => ({
      id: m.id,
      name: m.name,
      provider: "stabilityai" as const,
      capabilities: CapabilitiesUI.Image,
    }));
  };
}

const stabilityaiProvider = new StabilityAIProvider();

export { StabilityAIProvider, stabilityaiProvider };
