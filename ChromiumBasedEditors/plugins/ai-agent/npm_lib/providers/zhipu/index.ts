import { CapabilitiesUI } from "../../capabilities";
import type { Model } from "../../types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { zhipuInfo } from "./info";

const FALLBACK_MODELS: Model[] = [
  {
    id: "glm-4",
    name: "glm-4",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-0520",
    name: "glm-4-0520",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-air",
    name: "glm-4-air",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-airx",
    name: "glm-4-airx",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-flash",
    name: "glm-4-flash",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-plus",
    name: "glm-4-plus",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-long",
    name: "glm-4-long",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "glm-4-alltools",
    name: "glm-4-alltools",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Chat | CapabilitiesUI.Tools,
  },
  {
    id: "cogview-3",
    name: "cogview-3",
    provider: "zhipu",
    capabilities: CapabilitiesUI.Image,
  },
];

class ZhipuProvider extends OpenAIProvider {
  getName = (): string => zhipuInfo.name;

  getBaseUrl = (): string => zhipuInfo.baseUrl;

  getProviderModels = async (data: TData): Promise<Model[]> => {
    try {
      const client = this.createClient(
        data.apiKey,
        data.url || zhipuInfo.baseUrl
      );

      const response = (await client.models.list()).data;

      return response.map((model) => {
        const id = model.id.toLowerCase();

        let capabilities = CapabilitiesUI.Chat | CapabilitiesUI.Tools;
        if (id.includes("cogview") || id.includes("image")) {
          capabilities = CapabilitiesUI.Image;
        }

        return {
          id: model.id,
          name: model.id,
          provider: "zhipu" as const,
          capabilities,
        };
      });
    } catch {
      return FALLBACK_MODELS;
    }
  };
}

const zhipuProvider = new ZhipuProvider();

export { ZhipuProvider, zhipuProvider };
