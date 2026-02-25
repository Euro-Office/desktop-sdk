import { create } from "zustand";
import {
  CURRENT_PROVIDER_KEY,
  PROVIDERS_LOCAL_STORAGE_KEY,
} from "@/lib/constants";
import type { Model, TProvider } from "@/lib/types";
import { provider } from "@/providers";
import type { TErrorData } from "@/providers/base";

const NAME_EXISTS_ERROR = {
  field: "name" as const,
  message: "Duplicate name",
};

interface ProvidersState {
  providers: TProvider[];
  currentProvider: TProvider | null;
  persistedProvider: TProvider | null;
  providersModels: Map<string, Model[]>;
  fetchProvidersModels: () => Promise<void>;
  setCurrentProvider: (providerInfo: TProvider) => void;
  setSessionProvider: (providerInfo: TProvider | null) => void;
  addProvider: (
    providerInfo: TProvider
  ) => Promise<boolean | TErrorData | undefined>;
  editProvider: (
    providerInfo: TProvider,
    prevName: string
  ) => Promise<boolean | TErrorData | undefined>;
  deleteProvider: (providerInfo: TProvider) => Promise<void>;
}

const useProviders = create<ProvidersState>()((set, get) => ({
  providers: (() => {
    const saved = localStorage.getItem(PROVIDERS_LOCAL_STORAGE_KEY);

    return saved ? JSON.parse(saved) : [];
  })(),
  currentProvider: (() => {
    const saved = localStorage.getItem(CURRENT_PROVIDER_KEY);

    if (!saved) return null;

    const parsed: TProvider = JSON.parse(saved);

    provider.setCurrentProvider(parsed);

    return parsed;
  })(),
  persistedProvider: (() => {
    const saved = localStorage.getItem(CURRENT_PROVIDER_KEY);

    if (!saved) return null;

    const parsed: TProvider = JSON.parse(saved);

    provider.setCurrentProvider(parsed);

    return parsed;
  })(),
  providersModels: new Map<string, Model[]>(),

  fetchProvidersModels: async () => {
    const providers = get().providers;
    const models = await provider.getProvidersModels(providers);

    set({ providersModels: models });
  },

  setCurrentProvider: (providerInfo: TProvider) => {
    provider.setCurrentProvider(providerInfo);
    localStorage.setItem(CURRENT_PROVIDER_KEY, JSON.stringify(providerInfo));
    set({ currentProvider: providerInfo, persistedProvider: providerInfo });
  },
  setSessionProvider: (providerInfo: TProvider | null) => {
    set((state) => {
      const nextProvider = providerInfo ?? state.persistedProvider ?? null;
      provider.setCurrentProvider(nextProvider || undefined);
      return { currentProvider: nextProvider };
    });
  },

  addProvider: async (providerInfo: TProvider) => {
    // Check for duplicate name
    const currentProviders = get().providers;
    const nameExists = currentProviders.some(
      (p) => p.name.toLowerCase() === providerInfo.name.toLowerCase()
    );

    if (nameExists) return NAME_EXISTS_ERROR;

    const checkResult = await provider.checkNewProvider(providerInfo.type, {
      url: providerInfo.baseUrl,
      apiKey: providerInfo.key,
    });

    if (typeof checkResult === "boolean" && checkResult) {
      set((state) => {
        const newProviders = [...state.providers, providerInfo];
        localStorage.setItem(
          PROVIDERS_LOCAL_STORAGE_KEY,
          JSON.stringify(newProviders)
        );
        return { providers: newProviders };
      });
      return true;
    } else {
      return checkResult;
    }
  },

  editProvider: async (providerInfo: TProvider, prevName: string) => {
    // Check for duplicate name (excluding the current provider being edited)
    const currentProviders = get().providers;
    const nameExists = currentProviders.some(
      (p) =>
        p.name.toLowerCase() === providerInfo.name.toLowerCase() &&
        p.baseUrl !== providerInfo.baseUrl &&
        p.key !== providerInfo.key &&
        p.type !== providerInfo.type
    );

    if (nameExists) {
      return NAME_EXISTS_ERROR;
    }

    const checkResult = await provider.checkNewProvider(providerInfo.type, {
      url: providerInfo.baseUrl,
      apiKey: providerInfo.key,
    });

    if (typeof checkResult === "boolean" && checkResult) {
      set((state) => {
        const newProviders = state.providers.map((p) =>
          p.name === prevName ? providerInfo : p
        );
        localStorage.setItem(
          PROVIDERS_LOCAL_STORAGE_KEY,
          JSON.stringify(newProviders)
        );
        return { providers: newProviders };
      });
      return true;
    } else {
      return checkResult;
    }
  },
  deleteProvider: async (providerInfo: TProvider) => {
    set((state) => {
      const newProviders = state.providers.filter(
        (p) => p.name !== providerInfo.name
      );

      const isRemovingPersisted =
        state.persistedProvider?.name === providerInfo.name;

      let nextPersisted = state.persistedProvider;
      let nextCurrent = state.currentProvider;

      if (isRemovingPersisted) {
        nextPersisted = null;
        localStorage.removeItem(CURRENT_PROVIDER_KEY);
      }

      if (state.currentProvider?.name === providerInfo.name) {
        nextCurrent = nextPersisted;
        provider.setCurrentProvider(nextCurrent || undefined);
      }

      localStorage.setItem(
        PROVIDERS_LOCAL_STORAGE_KEY,
        JSON.stringify(newProviders)
      );
      return {
        providers: newProviders,
        currentProvider: nextCurrent,
        persistedProvider: nextPersisted,
      };
    });
  },
}));

export default useProviders;
