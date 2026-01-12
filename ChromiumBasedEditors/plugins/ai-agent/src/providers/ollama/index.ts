import type { Model, TProvider } from "@/lib/types";
import type { TData, TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { OpenAIProvider } from "../openai";
import { ollamaInfo } from "./info";

class OllamaProvider extends OpenAIProvider {
  setProvider = (provider: TProvider): void => {
    this.provider = provider;
    // Use OpenAI client with Ollama's base URL
    const apiKey = provider.key || "ollama";
    this.client = this.createClient(apiKey, provider.baseUrl);

    this.setApiKey(apiKey);
    if (provider.baseUrl) this.setUrl(provider.baseUrl);
  };

  getName = (): string => ollamaInfo.name;

  getBaseUrl = (): string => ollamaInfo.baseUrl;

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    // Ollama doesn't require an API key, use a dummy value
    const client = this.createClient("ollama", data.url);

    try {
      await client.models.list();
      return true;
    } catch {
      return ProviderErrors.invalidUrl();
    }
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    // Ollama doesn't require an API key, use a dummy value
    const client = this.createClient("ollama", data.url);

    try {
      const response = await client.models.list();

      return response.data.map((model) => ({
        id: model.id,
        name: ollamaInfo.modelNames[model.id] || model.id,
        provider: "ollama" as const,
      }));
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
      return [];
    }
  };
}

const ollamaProvider = new OllamaProvider();

export { OllamaProvider, ollamaProvider };
