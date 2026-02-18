import type { Model } from "@/lib/types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { deepseekInfo } from "./info";

/**
 * DeepSeek provider - extends OpenAI since DeepSeek API is OpenAI-compatible.
 */
class DeepSeekProvider extends OpenAIProvider {
  getName = (): string => deepseekInfo.name;

  getBaseUrl = (): string => deepseekInfo.baseUrl;

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = this.createClient(
      data.apiKey,
      data.url || deepseekInfo.baseUrl
    );

    try {
      const response = (await client.models.list()).data;

      const models: Model[] =
        deepseekInfo.modelFilters.length > 0
          ? response
              .filter((model) => deepseekInfo.modelFilters.includes(model.id))
              .map((model) => ({
                id: model.id,
                name: deepseekInfo.modelNames[model.id] || model.id,
                provider: "deepseek" as const,
                reasoning: model.id.includes("reasoner"),
              }))
          : response.map((model) => ({
              id: model.id,
              name: model.id,
              provider: "deepseek" as const,
              reasoning: model.id.includes("reasoner"),
            }));

      return models.reverse();
    } catch {
      return [];
    }
  };
}

const deepseekProvider = new DeepSeekProvider();

export { DeepSeekProvider, deepseekProvider };
