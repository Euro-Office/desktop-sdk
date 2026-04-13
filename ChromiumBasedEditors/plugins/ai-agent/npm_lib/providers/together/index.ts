import { CapabilitiesUI } from "../../capabilities";
import type { Model } from "../../types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { togetherInfo } from "./info";

type TogetherModel = {
  id: string;
  type?: string;
};

/**
 * Together provider - extends OpenAI since it uses the same SDK.
 * Only overrides methods that differ from OpenAI.
 */
class TogetherProvider extends OpenAIProvider {
  // ============================================
  // Provider Info (different from OpenAI)
  // ============================================

  getName = (): string => togetherInfo.name;

  getBaseUrl = (): string => togetherInfo.baseUrl;

  // ============================================
  // Model Fetching (different filters)
  // ============================================

  private checkModelCapabilities = (model: TogetherModel): number => {
    const id = model.id.toLowerCase();

    if (model.type === "chat") {
      let caps = CapabilitiesUI.Chat;
      if (id.includes("vision")) caps |= CapabilitiesUI.Vision;
      return caps;
    }
    if (model.type === "image") return CapabilitiesUI.Image;
    if (model.type === "embedding") return CapabilitiesUI.Embeddings;
    if (model.type === "code") return CapabilitiesUI.Chat;
    if (model.type === "rerank") return CapabilitiesUI.None;

    return CapabilitiesUI.Chat;
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const response = await fetch(`${data.url}/models`, {
      headers: {
        Authorization: `Bearer ${data.apiKey}`,
      },
    });

    const models: TogetherModel[] = await response.json();

    return models.map((model) => ({
      id: model.id,
      name: model.id,
      provider: "together" as const,
      capabilities: this.checkModelCapabilities(model),
    }));
  };
}

const togetherProvider = new TogetherProvider();

export { TogetherProvider, togetherProvider };
