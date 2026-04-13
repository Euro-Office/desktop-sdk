import { CapabilitiesUI } from "../../capabilities";
import type { Model } from "../../types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { groqInfo } from "./info";

class GroqProvider extends OpenAIProvider {
  getName = (): string => groqInfo.name;

  getBaseUrl = (): string => groqInfo.baseUrl;

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = this.createClient(data.apiKey, data.url || groqInfo.baseUrl);

    const response = (await client.models.list()).data;

    const models: Model[] = response
      .filter((m) => {
        const id = m.id.toLowerCase();
        return !id.includes("whisper");
      })
      .map((model) => {
        const id = model.id.toLowerCase();

        let capabilities = CapabilitiesUI.Chat | CapabilitiesUI.Tools;
        if (id.includes("vision")) {
          capabilities |= CapabilitiesUI.Vision;
        }

        return {
          id: model.id,
          name: model.id,
          provider: "groq" as const,
          capabilities,
        };
      });

    return models;
  };
}

const groqProvider = new GroqProvider();

export { GroqProvider, groqProvider };
