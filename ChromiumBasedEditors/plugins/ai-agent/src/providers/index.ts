import type { ThreadMessageLike } from "@assistant-ui/react";
import type { Model, ProviderType, TMCPItem, TProvider } from "@/lib/types";
import { SYSTEM_PROMPT } from "./Providers.utils";
import {
  type BaseProvider,
  getProvider,
  getSupportedProviderTypes,
  providerRegistry,
} from "./registry";
import type { TData } from "./settings";

export type SendMessageReturnType = AsyncGenerator<
  | ThreadMessageLike
  | {
      isEnd: true;
      responseMessage: ThreadMessageLike;
    }
>;

class Provider {
  currentProvider?: BaseProvider;
  currentProviderInfo?: TProvider;
  currentProviderType?: ProviderType;

  setCurrentProvider = (provider?: TProvider) => {
    if (!provider) {
      this.currentProvider = undefined;
      this.currentProviderInfo = undefined;
      this.currentProviderType = undefined;
      return;
    }

    this.currentProviderInfo = provider;
    this.currentProvider = getProvider(provider.type);
    this.currentProviderType = this.currentProvider ? provider.type : undefined;

    if (this.currentProvider) {
      this.currentProvider.setProvider(provider);
      this.currentProvider.setSystemPrompt(SYSTEM_PROMPT);
    }
  };

  setCurrentProviderModel = (modelKey: string) => {
    if (!this.currentProvider) return;

    this.currentProvider.setModelKey(modelKey);
  };

  setCurrentProviderTools = (tools: TMCPItem[]) => {
    if (!this.currentProvider) return;

    this.currentProvider.setTools(tools);
  };

  setCurrentProviderPrevMessages = (prevMessages: ThreadMessageLike[]) => {
    if (!this.currentProvider) return;

    this.currentProvider.setPrevMessages(prevMessages);
  };

  getCurrentProviderModel = () => {
    if (!this.currentProvider) return;

    return this.currentProvider.modelKey;
  };

  createChatName = async (message: string) => {
    if (!this.currentProvider) return "";

    const title = await this.currentProvider.createChatName(message);

    return title.includes("</think>")
      ? title.split("</think>")[1].slice(0, 128)
      : title.slice(0, 128);
  };

  sendMessage = (
    messages: ThreadMessageLike[]
  ): SendMessageReturnType | undefined => {
    if (!this.currentProvider) return;

    return this.currentProvider.sendMessage(messages);
  };

  sendMessageAfterToolCall = (
    message: ThreadMessageLike
  ): SendMessageReturnType | undefined => {
    if (!this.currentProvider) return;

    return this.currentProvider.sendMessageAfterToolCall(message);
  };

  stopMessage = () => {
    if (!this.currentProvider) return;

    this.currentProvider.stopMessage();
  };

  getProvidersInfo = () => {
    return getSupportedProviderTypes().map((type) => {
      const p = providerRegistry[type];
      return {
        type,
        name: p.getName(),
        baseUrl: p.getBaseUrl(),
      };
    });
  };

  getProviderInfo = (type: ProviderType) => {
    const p = getProvider(type);
    if (!p) {
      return { name: "", baseUrl: "" };
    }
    return {
      type,
      name: p.getName(),
      baseUrl: p.getBaseUrl(),
    };
  };

  checkNewProvider = (type: ProviderType, data: TData) => {
    const p = getProvider(type);
    if (!p) return false;
    return p.checkProvider(data);
  };

  getProvidersModels = async (providers: TProvider[]) => {
    const models = new Map<string, Model[]>();

    const validProviders = providers.filter((p) => getProvider(p.type));

    const actions = validProviders.map((p) => {
      const providerInstance = providerRegistry[p.type];
      return providerInstance.getProviderModels({
        url: p.baseUrl,
        apiKey: p.key,
      });
    });

    const fetchedModels = await Promise.allSettled(actions);

    validProviders.forEach((provider, index) => {
      const model = fetchedModels[index];
      if (
        model.status === "fulfilled" &&
        model.value &&
        model.value.length > 0
      ) {
        models.set(provider.name, model.value);
      }
    });

    return models;
  };
}

const provider = new Provider();

export { provider };
