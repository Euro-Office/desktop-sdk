import type { Model } from "@/lib/types";
import type { TData } from "../base";
import { OpenAIProvider } from "../openai";
import { openaicompatibleInfo } from "./info";

/**
 * OpenAI Compatible provider - extends OpenAI without model filtering.
 * Use this for any OpenAI-compatible API that you want full model access to.
 */
class OpenAICompatibleProvider extends OpenAIProvider {
  // ============================================
  // Provider Info
  // ============================================

  getName = (): string => openaicompatibleInfo.name;

  getBaseUrl = (): string => openaicompatibleInfo.baseUrl;

  // ============================================
  // Model Fetching (no filters - returns all models)
  // ============================================

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const client = this.createClient(data.apiKey, data.url);

    try {
      const response = await client.models.list();

      return response.data.map((model) => ({
        id: model.id,
        name: openaicompatibleInfo.modelNames[model.id] || model.id,
        provider: "openaicompatible" as const,
      }));
    } catch (error) {
      console.error("Failed to fetch OpenAI Compatible models:", error);
      return [];
    }
  };
}

const openaicompatibleProvider = new OpenAICompatibleProvider();

export { OpenAICompatibleProvider, openaicompatibleProvider };
