import { CapabilitiesUI } from "../../capabilities";
import type { Model } from "../../types";
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

    const models: Model[] = response.map((model) => {
      let capabilities: number;

      if (model.id.includes("vision")) {
        capabilities = CapabilitiesUI.Chat | CapabilitiesUI.Vision;
      } else if (model.id.includes("image")) {
        capabilities = CapabilitiesUI.Image;
      } else {
        capabilities = CapabilitiesUI.Chat;
      }

      return {
        id: model.id,
        name: model.id,
        provider: "xai" as const,
        reasoning: model.id.includes("reasoning"),
        capabilities,
      };
    });

    return models.reverse();
  };
}

const xaiProvider = new XAIProvider();

export { XAIProvider, xaiProvider };
