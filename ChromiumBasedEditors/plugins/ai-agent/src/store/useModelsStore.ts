import { create } from "zustand";
import { CURRENT_MODEL_KEY } from "@/lib/constants";
import type { Model } from "@/lib/types";
import { provider } from "@/providers";

type UseModelsStoreProps = {
  currentModel: Model | null;
  persistedModel: Model | null;

  selectModel: (model: Model) => void;
  setSessionModel: (model: Model | null) => void;

  deleteSelectedModel: () => void;
};

const useModelsStore = create<UseModelsStoreProps>((set) => ({
  currentModel: (() => {
    const saved = localStorage.getItem(CURRENT_MODEL_KEY);

    if (!saved) return null;

    const parsed: Model = JSON.parse(saved);

    provider.setCurrentProviderModel(parsed.id);

    return parsed;
  })(),
  persistedModel: (() => {
    const saved = localStorage.getItem(CURRENT_MODEL_KEY);

    if (!saved) return null;

    const parsed: Model = JSON.parse(saved);

    provider.setCurrentProviderModel(parsed.id);

    return parsed;
  })(),

  selectModel: (model) => {
    set({ currentModel: model, persistedModel: model });
    provider.setCurrentProviderModel(model.id);
    localStorage.setItem(CURRENT_MODEL_KEY, JSON.stringify(model));
  },
  setSessionModel: (model) => {
    set((state) => {
      const nextModel = model ?? state.persistedModel ?? null;
      provider.setCurrentProviderModel(nextModel?.id ?? "");
      return { currentModel: nextModel };
    });
  },

  deleteSelectedModel: () => {
    set({ currentModel: null, persistedModel: null });
    localStorage.removeItem(CURRENT_MODEL_KEY);
    provider.setCurrentProviderModel("");
  },
}));

export default useModelsStore;
