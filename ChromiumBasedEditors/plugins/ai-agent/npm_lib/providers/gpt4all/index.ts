import { CapabilitiesUI } from "../../capabilities";
import type { Model, TProvider } from "../../types";
import type { TData, TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { OpenAIProvider } from "../openai";
import { gpt4allInfo } from "./info";

class GPT4AllProvider extends OpenAIProvider {
  getName = (): string => gpt4allInfo.name;

  getBaseUrl = (): string => gpt4allInfo.baseUrl;

  setProvider = (provider: TProvider): void => {
    this.provider = provider;
    const apiKey = provider.key || "gpt4all";
    this.client = this.createClient(
      apiKey,
      provider.baseUrl || gpt4allInfo.baseUrl
    );

    this.setApiKey(apiKey);
    if (provider.baseUrl) this.setUrl(provider.baseUrl);
  };

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    try {
      const client = this.createClient(
        "gpt4all",
        data.url || gpt4allInfo.baseUrl
      );
      await client.models.list();
      return true;
    } catch {
      return ProviderErrors.invalidUrl();
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    try {
      const client = this.createClient(
        "gpt4all",
        data.url || gpt4allInfo.baseUrl
      );

      const response = (await client.models.list()).data;

      const defaultCaps =
        CapabilitiesUI.Chat | CapabilitiesUI.Vision | CapabilitiesUI.Tools;

      return response.map((model) => ({
        id: model.id,
        name: model.id,
        provider: "gpt4all" as const,
        capabilities: defaultCaps,
      }));
    } catch {
      return [];
    }
  };
}

const gpt4allProvider = new GPT4AllProvider();

export { GPT4AllProvider, gpt4allProvider };
