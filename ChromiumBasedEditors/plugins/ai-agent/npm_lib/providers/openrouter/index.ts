import { CapabilitiesUI } from "../../capabilities";
import type { Model } from "../../types";
import type { TData, TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { OpenAIProvider } from "../openai";
import { openrouterInfo } from "./info";

type OpenRouterModel = {
  id: string;
  architecture?: {
    modality?: string;
  };
  context_length?: number;
};

/**
 * OpenRouter provider - extends OpenAI since it uses the same SDK.
 * Only overrides methods that differ from OpenAI.
 */
class OpenRouterProvider extends OpenAIProvider {
  // ============================================
  // Provider Info (different from OpenAI)
  // ============================================

  getName = (): string => openrouterInfo.name;

  getBaseUrl = (): string => openrouterInfo.baseUrl;

  // ============================================
  // Provider Validation (uses fetch instead of SDK)
  // ============================================

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    try {
      const response = await fetch(`${data.url}/models/user`, {
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
        },
      });

      if (!response.ok) {
        if (!data.apiKey) return ProviderErrors.emptyKey();
        if (response.status === 401) return ProviderErrors.invalidKey();
        return ProviderErrors.invalidUrl();
      }

      return true;
    } catch {
      return ProviderErrors.connectionFailed();
    }
  };

  // ============================================
  // Model Fetching (different filters)
  // ============================================

  private checkModelCapabilities = (model: OpenRouterModel): number => {
    const modality = model.architecture?.modality ?? "";
    if (!modality) return CapabilitiesUI.Chat;

    const [input, output] = modality.split("->");
    const modIn = input?.split("+") ?? [];
    const modOut = output?.split("+") ?? [];

    if (modIn.includes("embedding") || modOut.includes("embedding")) {
      return CapabilitiesUI.Embeddings;
    }

    let caps = 0;

    if (modOut.includes("text")) {
      if (
        modIn.includes("text") ||
        modIn.includes("image") ||
        modIn.includes("audio")
      ) {
        caps |= CapabilitiesUI.Chat;
      }
      if (modIn.includes("image")) caps |= CapabilitiesUI.Vision;
      if (modIn.includes("audio")) caps |= CapabilitiesUI.Audio;
    }
    if (modOut.includes("image") && modIn.includes("image")) {
      caps |= CapabilitiesUI.Image;
    }

    return caps || CapabilitiesUI.Chat;
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const url = data.url || openrouterInfo.baseUrl;
    const response = await fetch(`${url}/models`, {
      headers: data.apiKey ? { Authorization: `Bearer ${data.apiKey}` } : {},
    });
    const json = await response.json();
    const models: OpenRouterModel[] = json.data ?? [];

    return models.map((model) => ({
      id: model.id,
      name: model.id,
      provider: "openrouter" as const,
      reasoning: openrouterInfo.reasoningModels.includes(model.id),
      capabilities: this.checkModelCapabilities(model),
    }));
  };
}

const openrouterProvider = new OpenRouterProvider();

export { OpenRouterProvider, openrouterProvider };
