import type { Model, TProvider } from "@/lib/types";
import type { TData, TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { OpenAIProvider } from "../openai";
import { lmStudioInfo } from "./info";

class LMStudioProvider extends OpenAIProvider {
  setProvider = (provider: TProvider): void => {
    this.provider = provider;
    // Use OpenAI client with LM Studio's base URL
    // LM Studio doesn't require an API key
    const apiKey = provider.key || "lm-studio";
    this.client = this.createClient(apiKey, provider.baseUrl);

    this.setApiKey(apiKey);
    if (provider.baseUrl) this.setUrl(provider.baseUrl);
  };

  getName = (): string => lmStudioInfo.name;

  getBaseUrl = (): string => lmStudioInfo.baseUrl;

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    // LM Studio doesn't require an API key, use a dummy value
    const client = this.createClient("lm-studio", data.url);

    try {
      const response = await client.models.list();

      if (!response.data || response.data.length === 0) {
        return ProviderErrors.invalidUrl("No models loaded in LM Studio");
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to connect to LM Studio";
      return ProviderErrors.invalidUrl(message);
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = this.createClient("lm-studio", data.url);

    try {
      const response = await client.models.list();

      return response.data.map((model) => ({
        id: model.id,
        name: lmStudioInfo.modelNames[model.id] || model.id,
        provider: "lm-studio" as const,
      }));
    } catch (error) {
      console.error("Failed to fetch LM Studio models:", error);
      return [];
    }
  };
}

const lmStudioProvider = new LMStudioProvider();

export { LMStudioProvider, lmStudioProvider };
