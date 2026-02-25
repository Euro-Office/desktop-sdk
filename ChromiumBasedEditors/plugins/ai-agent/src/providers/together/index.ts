import type { Model } from "@/lib/types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { togetherInfo } from "./info";

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

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const response = await fetch(`${data.url}/models`, {
      headers: {
        Authorization: `Bearer ${data.apiKey}`,
      },
    });

    const models = await response.json();

    return models
      .filter((model: { id: string }) =>
        togetherInfo.modelFilters.includes(model.id)
      )
      .map((model: { id: string }) => ({
        id: model.id,
        name: togetherInfo.modelNames[model.id] || model.id,
        provider: "together" as const,
      }));
  };
}

const togetherProvider = new TogetherProvider();

export { TogetherProvider, togetherProvider };
