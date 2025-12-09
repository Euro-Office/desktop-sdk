import type { Model } from "@/lib/types";
import type { TData, TErrorData } from "../base";
import { ProviderErrors } from "../errors";
import { OpenAIProvider } from "../openai";
import { deepseekInfo } from "./info";

/**
 * DeepSeek provider - extends OpenAI since DeepSeek API is OpenAI-compatible.
 */
class DeepSeekProvider extends OpenAIProvider {
  getName = (): string => deepseekInfo.name;

  getBaseUrl = (): string => deepseekInfo.baseUrl;

  checkProvider = async (data: TData): Promise<boolean | TErrorData> => {
    const promiseRes: boolean | TErrorData = await new Promise(
      (resolve, _reject) => {
        window.AscSimpleRequest.createRequest({
          url: `${data.url || deepseekInfo.baseUrl}/models`,
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": data.apiKey || "",
          },
          body: "",
          complete: (e) => {
            if (e.responseStatus === 200) {
              resolve(true);
            }
            if (e.responseStatus === 401) {
              resolve(ProviderErrors.invalidKey());
            }

            if (!data.apiKey) {
              resolve(ProviderErrors.emptyKey());
            }

            resolve(ProviderErrors.invalidUrl());
          },
          error: () => {
            resolve(ProviderErrors.invalidUrl());
          },
        });
      }
    );

    return promiseRes;
  };

  getProviderModels = async (data: TData): Promise<Model[]> => {
    const promiseRes: Model[] = await new Promise((resolve, reject) => {
      window.AscSimpleRequest.createRequest({
        url: `${data.url || deepseekInfo.baseUrl}/models`,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": data.apiKey || "",
        },
        body: "",
        complete: (e) => {
          const response = (JSON.parse(e.responseText) as { data: Model[] })
            .data;

          // Empty filter = show all models
          const models =
            deepseekInfo.modelFilters.length > 0
              ? response.filter((model) =>
                  deepseekInfo.modelFilters.includes(model.id)
                )
              : response;

          resolve(
            models
              .map((model) => ({
                id: model.id,
                name: deepseekInfo.modelNames[model.id] || model.id,
                provider: "deepseek" as const,
              }))
              .reverse()
          );
        },
        error: (e) => {
          reject(e);
        },
      });
    });

    return promiseRes;
  };
}

const deepseekProvider = new DeepSeekProvider();

export { DeepSeekProvider, deepseekProvider };
