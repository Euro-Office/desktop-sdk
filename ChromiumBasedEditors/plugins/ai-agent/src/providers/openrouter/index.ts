import type { Model } from "@/lib/types";
import type { TData, TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { OpenAIProvider } from "../openai";
import { openrouterInfo } from "./info";

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

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = this.createClient(data.apiKey, data.url);
    const response = (await client.models.list()).data;

    return response
      .filter((model) => openrouterInfo.modelFilters.includes(model.id))
      .map((model) => ({
        id: openrouterInfo.reasoningModels.includes(model.id)
          ? `${model.id}-thinking`
          : model.id,
        name: openrouterInfo.modelNames[model.id] || model.id.toUpperCase(),
        provider: "openrouter" as const,
      }));
  };
}

const openrouterProvider = new OpenRouterProvider();

export { OpenRouterProvider, openrouterProvider };
