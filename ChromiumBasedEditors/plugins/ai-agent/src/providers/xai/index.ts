import type { Model } from "@/lib/types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { xaiInfo } from "./info";

/**
 * xAI provider - extends OpenAI since xAI API is OpenAI-compatible.
 */
class XAIProvider extends OpenAIProvider {
  getName = (): string => xaiInfo.name;

  getBaseUrl = (): string => xaiInfo.baseUrl;

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = this.createClient(data.apiKey, data.url || xaiInfo.baseUrl);

    const response = (await client.models.list()).data;

    const models: Model[] = response.map((model) => ({
      id: model.id,
      name: model.id,
      provider: "xai" as const,
      reasoning: model.id.includes("reasoning"),
    }));

    return models.reverse();
  };
}

const xaiProvider = new XAIProvider();

export { XAIProvider, xaiProvider };
