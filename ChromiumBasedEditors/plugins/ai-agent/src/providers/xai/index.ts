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

    try {
      const response = (await client.models.list()).data;

      const models: Model[] =
        xaiInfo.modelFilters.length > 0
          ? response
              .filter((model) => xaiInfo.modelFilters.includes(model.id))
              .map((model) => {
                const baseName = xaiInfo.modelNames[model.id] || model.id;

                return {
                  id: model.id,
                  name: baseName,
                  provider: "xai" as const,
                };
              })
          : response.map((model) => ({
              id: model.id,
              name: model.id,
              provider: "xai" as const,
            }));

      return models.reverse();
    } catch {
      return [];
    }
  };
}

const xaiProvider = new XAIProvider();

export { XAIProvider, xaiProvider };
